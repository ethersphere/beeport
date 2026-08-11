import { ChunkBuilder, ChunkEntry } from '../chunk/splitter.cjs';
/**
 * Returns an onIntermediateChunk callback for ChunkSplitter that encodes the
 * redundancy level into bit 7 of span byte 7 whenever the intermediate chunk
 * contains parity refs. Matches Bee's redundancy.EncodeLevel: span[7] = level | 0x80.
 * This allows Bee's joiner to locate parity refs and perform RS reconstruction.
 */
export declare function makeIntermediateChunkHandler(level: number): (chunk: ChunkBuilder, hasParity: boolean) => void;
/**
 * Returns an onBatch callback for ChunkSplitter that:
 *  1. Uploads all data chunks in the batch via onChunk
 *  2. Computes RS parity shards from the data chunk bytes
 *  3. Uploads parity chunks via onChunk
 *  4. Returns the parity ChunkEntry[] for the splitter to include in the parent tree node
 */
export declare function makeErasureBatch(level: number, encrypted: boolean, onChunk: (chunk: ChunkBuilder, key?: Uint8Array) => Promise<void>): (batch: ChunkEntry[]) => Promise<ChunkEntry[]>;
//# sourceMappingURL=batch.d.cts.map