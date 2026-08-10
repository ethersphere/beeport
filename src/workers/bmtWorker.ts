/// <reference lib="webworker" />

/**
 * Off-main-thread BMT chunking via bee-js {@link MerkleTree}.
 *
 * Main thread reads file slabs (File API) and posts them here; leaf chunks
 * and the file root are returned as wire bytes + content hashes.
 */

import { MerkleTree } from '@ethersphere/bee-js';
import type { Chunk } from 'cafe-utility';

type InMsg =
  | { type: 'reset' }
  | { type: 'append'; data: ArrayBuffer }
  | { type: 'finalize' };

type OutMsg =
  | { type: 'ready' }
  | { type: 'leaf'; chunkBytes: ArrayBuffer; hashBytes: ArrayBuffer }
  | { type: 'appendDone' }
  | { type: 'finalized'; chunkBytes: ArrayBuffer; hashBytes: ArrayBuffer }
  | { type: 'error'; message: string };

let tree: MerkleTree | null = null;

function post(o: OutMsg, transfer?: Transferable[]) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(o, transfer ?? []);
}

function resetTree() {
  tree = new MerkleTree(async (chunk: Chunk) => {
    const built = chunk.build();
    const hash = chunk.hash();
    const chunkBytes = new Uint8Array(built);
    const hashBytes = new Uint8Array(hash);
    post(
      { type: 'leaf', chunkBytes: chunkBytes.buffer, hashBytes: hashBytes.buffer },
      [chunkBytes.buffer, hashBytes.buffer]
    );
  });
}

function wireChunk(chunk: Chunk): { chunkBytes: ArrayBuffer; hashBytes: ArrayBuffer } {
  const built = new Uint8Array(chunk.build());
  const hash = new Uint8Array(chunk.hash());
  return { chunkBytes: built.buffer, hashBytes: hash.buffer };
}

async function handle(msg: InMsg): Promise<void> {
  try {
    if (msg.type === 'reset') {
      resetTree();
      post({ type: 'ready' });
      return;
    }

    if (msg.type === 'append') {
      if (!tree) resetTree();
      await tree!.append(new Uint8Array(msg.data));
      post({ type: 'appendDone' });
      return;
    }

    if (msg.type === 'finalize') {
      if (!tree) {
        post({ type: 'error', message: 'finalize before any append' });
        return;
      }
      const root = await tree.finalize();
      const { chunkBytes, hashBytes } = wireChunk(root);
      post({ type: 'finalized', chunkBytes, hashBytes }, [chunkBytes, hashBytes]);
      tree = null;
    }
  } catch (e) {
    post({
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
    });
  }
}

resetTree();
post({ type: 'ready' });

let handling: Promise<void> = Promise.resolve();

self.onmessage = (ev: MessageEvent<InMsg>) => {
  handling = handling.then(() => handle(ev.data));
};
