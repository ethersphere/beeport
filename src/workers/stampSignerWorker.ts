/// <reference lib="webworker" />

import * as secp from '@noble/secp256k1';

type InMsg =
  | { type: 'init'; privKey: ArrayBuffer }
  | { type: 'sign'; id: number; msgHash: ArrayBuffer };

type OutMsg =
  | { type: 'ready' }
  | { type: 'sign'; id: number; signature: ArrayBuffer }
  | { type: 'signErr'; id: number; message: string };

let privKey: Uint8Array | null = null;

function post(o: OutMsg, transfer?: Transferable[]) {
  (self as unknown as DedicatedWorkerGlobalScope).postMessage(o, transfer ?? []);
}

async function handle(msg: InMsg): Promise<void> {
  if (msg.type === 'init') {
    privKey = new Uint8Array(msg.privKey);
    post({ type: 'ready' });
    return;
  }
  if (msg.type === 'sign') {
    try {
      if (!privKey) {
        throw new Error('worker not initialized');
      }
      const msgHash = new Uint8Array(msg.msgHash);
      const signed = await secp.sign(msgHash, privKey, {
        der: false,
        recovered: true,
        lowS: true,
      });
      const compact = signed[0] as Uint8Array;
      const recovery = signed[1] as number;
      const sig65 = new Uint8Array(65);
      sig65.set(compact, 0);
      sig65[64] = 27 + recovery;
      post({ type: 'sign', id: msg.id, signature: sig65.buffer }, [sig65.buffer]);
    } catch (e) {
      post({
        type: 'signErr',
        id: msg.id,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
}

self.onmessage = (ev: MessageEvent<InMsg>) => {
  void handle(ev.data);
};
