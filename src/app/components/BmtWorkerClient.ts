/**
 * Optional Web Worker wrapper for file BMT chunking ({@link MerkleTree}).
 *
 * File reads stay on the main thread; hashing runs in `bmtWorker.ts`. Falls
 * back to main-thread {@link MerkleTree} when workers are unavailable.
 */

import { MerkleTree } from '@ethersphere/bee-js';
import type { Chunk } from 'cafe-utility';

const FILE_READ_SLAB_BYTES = 1 << 20;
const SINGLE_SHOT_READ_THRESHOLD_BYTES = 64 * 1024 * 1024;

type WorkerOutMsg =
  | { type: 'ready' }
  | { type: 'leaf'; chunkBytes: ArrayBuffer; hashBytes: ArrayBuffer }
  | { type: 'appendDone' }
  | { type: 'finalized'; chunkBytes: ArrayBuffer; hashBytes: ArrayBuffer }
  | { type: 'error'; message: string };

type PendingKind = 'ready' | 'append' | 'finalize';

/** Minimal {@link Chunk} shim from worker wire format. */
export function chunkFromWire(chunkBytes: Uint8Array, hashBytes: Uint8Array): Chunk {
  const body = new Uint8Array(chunkBytes);
  const hash = new Uint8Array(hashBytes);
  return {
    build: () => body,
    hash: () => hash,
  } as Chunk;
}

async function streamOnMainThread(
  slabs: AsyncIterable<Uint8Array>,
  onChunk: (chunk: Chunk) => Promise<void>,
  abortSignal?: AbortSignal
): Promise<Chunk> {
  const tree = new MerkleTree(onChunk);
  for await (const slab of slabs) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    await tree.append(slab);
  }
  return tree.finalize();
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
  let pendingRead: Promise<ArrayBuffer> | null = readSlab(file, 0);
  while (offset < file.size) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    const slabBuf = await pendingRead!;
    offset = Math.min(offset + FILE_READ_SLAB_BYTES, file.size);
    pendingRead = offset < file.size ? readSlab(file, offset) : null;
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    yield new Uint8Array(slabBuf);
  }
}

function readSlab(file: File, offset: number): Promise<ArrayBuffer> {
  const end = Math.min(offset + FILE_READ_SLAB_BYTES, file.size);
  return file.slice(offset, end).arrayBuffer();
}

export class BmtWorkerClient {
  private worker: Worker | null = null;
  private readonly useMainThread: boolean;
  private onLeaf: ((chunk: Chunk) => Promise<void>) | null = null;
  private pending:
    | {
        kind: PendingKind;
        resolve: (msg: WorkerOutMsg) => void;
        reject: (e: Error) => void;
      }
    | null = null;
  private opChain: Promise<void> = Promise.resolve();
  /** Serializes leaf delivery so AsyncQueue.enqueue back-pressure matches main-thread BMT. */
  private leafChain: Promise<void> = Promise.resolve();

  private constructor(worker: Worker | null, useMainThread: boolean) {
    this.worker = worker;
    this.useMainThread = useMainThread;
    if (worker) {
      worker.onmessage = (ev: MessageEvent<WorkerOutMsg>) => this.onWorkerMessage(ev.data);
      worker.onerror = () => this.rejectPending(new Error('BMT worker failed'));
    }
  }

  static async open(): Promise<BmtWorkerClient> {
    const disabled =
      typeof process !== 'undefined' && process.env.NEXT_PUBLIC_BMT_WORKER === 'false';

    if (disabled || typeof Worker === 'undefined') {
      return new BmtWorkerClient(null, true);
    }

    try {
      const worker = new Worker(new URL('../../workers/bmtWorker.ts', import.meta.url), {
        type: 'module',
      });
      const client = new BmtWorkerClient(worker, false);
      await client.waitFor('ready', () => {
        worker.postMessage({ type: 'reset' });
      });
      return client;
    } catch {
      return new BmtWorkerClient(null, true);
    }
  }

  get runsInWorker(): boolean {
    return !this.useMainThread;
  }

  private rejectPending(err: Error) {
    this.pending?.reject(err);
    this.pending = null;
  }

  private onWorkerMessage(msg: WorkerOutMsg) {
    if (msg.type === 'leaf') {
      const handler = this.onLeaf;
      if (handler) {
        const chunk = chunkFromWire(
          new Uint8Array(msg.chunkBytes),
          new Uint8Array(msg.hashBytes)
        );
        this.leafChain = this.leafChain.then(
          () => handler(chunk),
          () => handler(chunk)
        );
      }
      return;
    }

    if (msg.type === 'error') {
      this.rejectPending(new Error(msg.message));
      return;
    }

    const pending = this.pending;
    if (!pending) return;

    if (pending.kind === 'ready' && msg.type === 'ready') {
      pending.resolve(msg);
      this.pending = null;
    } else if (pending.kind === 'append' && msg.type === 'appendDone') {
      pending.resolve(msg);
      this.pending = null;
    } else if (pending.kind === 'finalize' && msg.type === 'finalized') {
      pending.resolve(msg);
      this.pending = null;
    }
  }

  private waitFor(kind: PendingKind, send: () => void): Promise<WorkerOutMsg> {
    if (!this.worker) {
      return Promise.reject(new Error('BMT worker not available'));
    }
    return new Promise((resolve, reject) => {
      this.pending = { kind, resolve, reject };
      send();
    });
  }

  private runSerial<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.opChain.then(fn, fn);
    this.opChain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  }

  private async drainLeaves(): Promise<void> {
    await this.leafChain;
  }

  private async resetWorker(): Promise<void> {
    this.leafChain = Promise.resolve();
    await this.runSerial(() => this.waitFor('ready', () => this.worker!.postMessage({ type: 'reset' })));
  }

  private async appendSlab(slab: Uint8Array): Promise<void> {
    await this.runSerial(async () => {
      const copy = slab.slice();
      await this.waitFor('append', () =>
        this.worker!.postMessage({ type: 'append', data: copy.buffer }, [copy.buffer])
      );
      await this.drainLeaves();
    });
  }

  async streamFileThroughMerkleTree(
    file: File,
    onChunk: (chunk: Chunk) => Promise<void>,
    abortSignal?: AbortSignal
  ): Promise<Chunk> {
    if (this.useMainThread) {
      return streamOnMainThread(readFileSlabs(file, abortSignal), onChunk, abortSignal);
    }

    this.onLeaf = onChunk;
    try {
      await this.resetWorker();
      for await (const slab of readFileSlabs(file, abortSignal)) {
        await this.appendSlab(slab);
      }
      const msg = await this.runSerial(() =>
        this.waitFor('finalize', () => this.worker!.postMessage({ type: 'finalize' }))
      );
      await this.drainLeaves();
      if (msg.type !== 'finalized') {
        throw new Error('unexpected BMT worker response');
      }
      return chunkFromWire(new Uint8Array(msg.chunkBytes), new Uint8Array(msg.hashBytes));
    } finally {
      this.onLeaf = null;
    }
  }

  async streamBytesThroughMerkleTree(
    bytes: Uint8Array,
    onChunk: (chunk: Chunk) => Promise<void>,
    abortSignal?: AbortSignal
  ): Promise<Chunk> {
    if (this.useMainThread) {
      async function* one() {
        yield bytes;
      }
      return streamOnMainThread(one(), onChunk, abortSignal);
    }

    this.onLeaf = onChunk;
    try {
      await this.resetWorker();
      for (let off = 0; off < bytes.length; off += FILE_READ_SLAB_BYTES) {
        if (abortSignal?.aborted) throw new Error('Upload aborted');
        const end = Math.min(off + FILE_READ_SLAB_BYTES, bytes.length);
        await this.appendSlab(bytes.subarray(off, end));
      }
      const msg = await this.runSerial(() =>
        this.waitFor('finalize', () => this.worker!.postMessage({ type: 'finalize' }))
      );
      await this.drainLeaves();
      if (msg.type !== 'finalized') {
        throw new Error('unexpected BMT worker response');
      }
      return chunkFromWire(new Uint8Array(msg.chunkBytes), new Uint8Array(msg.hashBytes));
    } finally {
      this.onLeaf = null;
    }
  }

  terminate(): void {
    this.rejectPending(new Error('BMT worker terminated'));
    try {
      this.worker?.terminate();
    } catch {
      // ignore
    }
    this.worker = null;
  }
}
