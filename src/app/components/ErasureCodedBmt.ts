/**
 * Client-side Swarm erasure coding for the self-custody `/chunks` path.
 *
 * Bee only applies `swarm-redundancy-level` when *it* splits uploads (`/bzz`,
 * `/bytes`). Our uploads already BMT-chunk + stamp in the browser, so we must
 * produce parity CACs ourselves. Encoding happens here; HTTP vs WebSocket is
 * only how those stamped chunks are delivered afterward.
 *
 * Uses vendored `swarm-core` (ChunkSplitter + Reed-Solomon), matching Bee's
 * PAC-scoped EC + span level flag so stock Bee downloaders can reconstruct.
 */

import type { Chunk } from 'cafe-utility';
import { ChunkSplitter, type ChunkBuilder } from 'swarm-core/chunk';
import {
  getMaxShards,
  getParities,
  makeErasureBatch,
  makeIntermediateChunkHandler,
} from 'swarm-core/erasure-coding';

const FILE_READ_SLAB_BYTES = 1 << 20;
const SINGLE_SHOT_READ_THRESHOLD_BYTES = 64 * 1024 * 1024;

/** Adapt swarm-core {@link ChunkBuilder} to cafe-utility {@link Chunk}. */
export function asCafeChunk(builder: ChunkBuilder): Chunk {
  return {
    build: () => builder.build(),
    hash: () => builder.hash().toUint8Array(),
  } as Chunk;
}

/** Rough total CAC count (data + parity + intermediates) for progress UI. */
export function approxChunkCountWithRedundancy(
  byteLength: number,
  redundancyLevel: number
): number {
  const leaves = Math.max(1, Math.ceil(byteLength / 4096));
  if (redundancyLevel <= 0) {
    return leaves + Math.ceil(leaves / 128) + 2;
  }
  const level = Math.min(4, Math.floor(redundancyLevel));
  const maxShards = getMaxShards(level, false);
  let dataAndParity = 0;
  let remaining = leaves;
  while (remaining > 0) {
    const batch = Math.min(maxShards, remaining);
    dataAndParity += batch + getParities(level, batch, false);
    remaining -= batch;
  }
  // Intermediate PAC fan-out is also EC'd; over-estimate like the non-EC path.
  const intermediate = Math.ceil(leaves / Math.max(1, maxShards)) + 2;
  return dataAndParity + intermediate;
}

async function* readFileSlabs(
  file: File,
  abortSignal?: AbortSignal
): AsyncGenerator<Uint8Array> {
  if (file.size <= SINGLE_SHOT_READ_THRESHOLD_BYTES) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    yield new Uint8Array(await file.arrayBuffer());
    return;
  }

  let offset = 0;
  while (offset < file.size) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    const end = Math.min(offset + FILE_READ_SLAB_BYTES, file.size);
    const slab = new Uint8Array(await file.slice(offset, end).arrayBuffer());
    offset = end;
    yield slab;
  }
}

/**
 * Stream raw bytes through an EC-aware Swarm hash tree. Every sealed data and
 * parity chunk is delivered to `onChunk` (already adapted to cafe Chunk).
 * The returned root must still be stamped+uploaded by the caller (same as
 * cafe-utility MerkleTree.finalize()).
 */
export async function streamBytesThroughErasureTree(
  slabs: AsyncIterable<Uint8Array>,
  redundancyLevel: number,
  onChunk: (chunk: Chunk) => Promise<void>,
  abortSignal?: AbortSignal
): Promise<Chunk> {
  const level = Math.max(0, Math.min(4, Math.floor(redundancyLevel)));
  const encrypted = false;

  const onBuilderChunk = async (builder: ChunkBuilder): Promise<void> => {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    await onChunk(asCafeChunk(builder));
  };

  const splitter = new ChunkSplitter(
    makeErasureBatch(level, encrypted, onBuilderChunk),
    level > 0 ? getMaxShards(level, encrypted) : undefined,
    encrypted,
    makeIntermediateChunkHandler(level)
  );

  for await (const slab of slabs) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    await splitter.append(slab);
  }

  const root = await splitter.finalize();
  return asCafeChunk(root);
}

export async function streamFileThroughErasureTree(
  file: File,
  redundancyLevel: number,
  onChunk: (chunk: Chunk) => Promise<void>,
  abortSignal?: AbortSignal
): Promise<Chunk> {
  return streamBytesThroughErasureTree(
    readFileSlabs(file, abortSignal),
    redundancyLevel,
    onChunk,
    abortSignal
  );
}

export async function streamUint8ThroughErasureTree(
  data: Uint8Array,
  redundancyLevel: number,
  onChunk: (chunk: Chunk) => Promise<void>,
  abortSignal?: AbortSignal
): Promise<Chunk> {
  async function* once(): AsyncGenerator<Uint8Array> {
    yield data;
  }
  return streamBytesThroughErasureTree(once(), redundancyLevel, onChunk, abortSignal);
}
