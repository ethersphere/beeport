/**
 * Fast presigned postage stamps for self-custody uploads.
 *
 * Replaces bee-js {@link Stamper}'s `stamp()` signing path (`PrivateKey.sign` →
 * cafe-utility BigInt ECDSA) with @noble/secp256k1 and optional Web Worker
 * fan-out. Slot allocation (`buckets`, `maxSlot`) stays compatible with Bee's
 * Stamper semantics — we only swap the cryptography and HTTP transport.
 */

import type { EnvelopeWithBatchId, Stamper } from '@ethersphere/bee-js';
import type { Chunk } from 'cafe-utility';
import { Binary } from 'cafe-utility';
import * as secp from '@noble/secp256k1';
import { hexToBytes, keccak256 } from 'viem';

const ETH_SIGNED_CHUNK_PREFIX = new TextEncoder().encode('\x19Ethereum Signed Message:\n32');

/** Thrown by {@link uploadChunkPresignedFetch}; mirrors axios/Bee fields for {@link classifyAsStampNotReady}. */
export class ChunkUploadHttpError extends Error {
  readonly status?: number;
  readonly responseBody?: unknown;

  constructor(message: string, status?: number, responseBody?: unknown) {
    super(message);
    this.name = 'ChunkUploadHttpError';
    this.status = status;
    this.responseBody = responseBody;
  }
}

function concat2(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function concat4(a: Uint8Array, b: Uint8Array, c: Uint8Array, d: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length + c.length + d.length);
  let o = 0;
  out.set(a, o);
  o += a.length;
  out.set(b, o);
  o += b.length;
  out.set(c, o);
  o += c.length;
  out.set(d, o);
  return out;
}

/**
 * 32-byte digest that `PrivateKey.sign` in bee-js ultimately ECDSA-signs for a
 * chunk stamp payload (same as Ethereum `personal_sign` over a 32-byte hash).
 */
export function ethSignedHashForStampPayload(
  address: Uint8Array,
  batchId: Uint8Array,
  index: Uint8Array,
  timestamp: Uint8Array
): Uint8Array {
  const payload = concat4(address, batchId, index, timestamp);
  const innerHash = hexToBytes(keccak256(payload));
  const personal = concat2(ETH_SIGNED_CHUNK_PREFIX, innerHash);
  return hexToBytes(keccak256(personal));
}

/**
 * Produce the 65-byte (r‖s‖v) signature for {@link ethSignedHashForStampPayload}.
 */
export async function signStampMsgHash(privKey: Uint8Array, msgHash: Uint8Array): Promise<Uint8Array> {
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
  return sig65;
}

type StamperInternals = Stamper & { buckets: Uint32Array; maxSlot: number };

/**
 * Advance the Stamper bucket counter and produce `index` + `timestamp` like
 * {@link Stamper.stamp}, without signing.
 */
export function allocateStampSlot(stamper: Stamper, chunk: Chunk): {
  address: Uint8Array;
  index: Uint8Array;
  timestamp: Uint8Array;
} {
  const s = stamper as StamperInternals;
  const address = chunk.hash();
  const bucket = Binary.uint16ToNumber(address, 'BE');
  const height = s.buckets[bucket];
  if (height >= s.maxSlot) {
    throw new Error('Bucket is full');
  }
  s.buckets[bucket]++;
  const index = Binary.concatBytes(Binary.numberToUint32(bucket, 'BE'), Binary.numberToUint32(height, 'BE'));
  const timestamp = Binary.numberToUint64(BigInt(Date.now()), 'BE');
  return { address, index, timestamp };
}

export async function buildStampEnvelope(
  stamper: Stamper,
  chunk: Chunk,
  issuer: Uint8Array,
  privKeyBytes: Uint8Array,
  pool: StampSignerPool | null
): Promise<EnvelopeWithBatchId> {
  const { address, index, timestamp } = allocateStampSlot(stamper, chunk);
  const batchIdBytes = stamper.batchId.toUint8Array();
  const msgHash = ethSignedHashForStampPayload(address, batchIdBytes, index, timestamp);
  const signature = pool ? await pool.signMsgHash(msgHash) : await signStampMsgHash(privKeyBytes, msgHash);
  return {
    batchId: stamper.batchId,
    index,
    issuer,
    signature,
    timestamp,
  };
}

/** Marshals the presigned envelope the way Bee expects in `swarm-postage-stamp`. */
export function marshaledStampHex(envelope: EnvelopeWithBatchId): string {
  const sig = envelope.signature;
  if (sig.length !== 65) throw new Error('invalid signature length');
  const batchId = envelope.batchId.toUint8Array();
  if (batchId.length !== 32) throw new Error('invalid batch ID length');
  if (envelope.timestamp.length !== 8) throw new Error('invalid timestamp length');
  if (envelope.index.length !== 8) throw new Error('invalid index length');
  return Binary.uint8ArrayToHex(Binary.concatBytes(batchId, envelope.index, envelope.timestamp, sig));
}

function joinUrl(base: string, path: string): string {
  const b = base.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${b}${p}`;
}

function mergeAbortSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  if (!a) return b;
  if (!b) return a;
  if (a.aborted || b.aborted) {
    const c = new AbortController();
    c.abort();
    return c.signal;
  }
  const c = new AbortController();
  const onAbort = () => c.abort();
  a.addEventListener('abort', onAbort);
  b.addEventListener('abort', onAbort);
  return c.signal;
}

/**
 * Lean `POST /chunks` — no axios, no JSON parse on success.
 */
export async function uploadChunkPresignedFetch(
  beeApiBase: string,
  chunkBytes: Uint8Array,
  envelope: EnvelopeWithBatchId,
  opts: { abortSignal?: AbortSignal; timeoutMs: number }
): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  const signal = mergeAbortSignals(opts.abortSignal, ctrl.signal);
  try {
    // Own the bytes for the request body: avoids any edge case where a shared
    // or pooled buffer is mutated before the browser serializes the POST under
    // high concurrency. `keepalive` is off — some browsers mishandle many
    // parallel keepalive uploads to the same origin.
    const body = new Uint8Array(chunkBytes);
    const res = await fetch(joinUrl(beeApiBase, 'chunks'), {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/octet-stream',
        'swarm-postage-stamp': marshaledStampHex(envelope),
      },
      signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      let body: unknown = undefined;
      try {
        body = await res.json();
      } catch {
        try {
          body = await res.text();
        } catch {
          body = undefined;
        }
      }
      const detail =
        body && typeof body === 'object' && 'message' in (body as object)
          ? String((body as { message?: unknown }).message)
          : typeof body === 'string'
            ? body
            : '';
      throw new ChunkUploadHttpError(
        detail
          ? `Request failed with status code ${res.status}: ${detail}`
          : `Request failed with status code ${res.status}`,
        res.status,
        body
      );
    }
    res.body?.cancel().catch(() => {});
  } finally {
    clearTimeout(t);
  }
}

/**
 * Lean `POST /soc/{owner}/{identifier}?sig={sig}` for presigned SOC uploads.
 *
 * The `/chunks` endpoint is for Content-Addressed Chunks: it BMT-hashes the
 * body to get the chunk address and verifies the postage stamp against that
 * address. SOCs need this endpoint instead — Bee assembles the SOC from
 * `(identifier, owner, sig, body)` and validates the stamp against the SOC
 * address (`keccak256(identifier || owner)`), which is what we signed.
 *
 * @param chunkBytes  Inner CAC bytes (`span(8) || payload`). Do NOT include the
 *                    identifier or signature here — those go in the URL.
 * @param ownerHex    Hot-key Ethereum address as 40-char hex (no `0x`).
 * @param identifierHex  32-byte SOC identifier as 64-char hex (no `0x`).
 * @param sigHex      65-byte SOC signature (`r||s||v`) as 130-char hex (no `0x`).
 * @param envelope    Postage envelope built over the SOC address.
 */
export async function uploadSocPresignedFetch(
  beeApiBase: string,
  chunkBytes: Uint8Array,
  ownerHex: string,
  identifierHex: string,
  sigHex: string,
  envelope: EnvelopeWithBatchId,
  opts: { abortSignal?: AbortSignal; timeoutMs: number }
): Promise<void> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
  const signal = mergeAbortSignals(opts.abortSignal, ctrl.signal);
  try {
    const body = new Uint8Array(chunkBytes);
    const url = `${joinUrl(beeApiBase, `soc/${ownerHex}/${identifierHex}`)}?sig=${sigHex}`;
    const res = await fetch(url, {
      method: 'POST',
      body,
      headers: {
        'content-type': 'application/octet-stream',
        'swarm-postage-stamp': marshaledStampHex(envelope),
      },
      signal,
      cache: 'no-store',
    });
    if (!res.ok) {
      let body: unknown = undefined;
      try {
        body = await res.json();
      } catch {
        try {
          body = await res.text();
        } catch {
          body = undefined;
        }
      }
      const detail =
        body && typeof body === 'object' && 'message' in (body as object)
          ? String((body as { message?: unknown }).message)
          : typeof body === 'string'
            ? body
            : '';
      throw new ChunkUploadHttpError(
        detail
          ? `Request failed with status code ${res.status}: ${detail}`
          : `Request failed with status code ${res.status}`,
        res.status,
        body
      );
    }
    res.body?.cancel().catch(() => {});
  } finally {
    clearTimeout(t);
  }
}

function defaultWorkerCount(): number {
  if (typeof navigator === 'undefined') return 2;
  const c = navigator.hardwareConcurrency ?? 4;
  return Math.min(8, Math.max(2, Math.floor(c / 2)));
}

/**
 * Pool of workers that sign {@link ethSignedHashForStampPayload} digests.
 * If workers fail to load (common in dev when `.ts` is served as `video/mp2t`),
 * degrades to {@link signStampMsgHash} on the main thread automatically.
 */
export class StampSignerPool {
  private readonly privKeyBytes: Uint8Array;
  private readonly workers: Worker[] = [];
  private readonly pending = new Map<
    number,
    { resolve: (s: Uint8Array) => void; reject: (e: unknown) => void }
  >();
  private nextId = 1;
  private rr = 0;
  private readonly ready: Promise<void>;
  /** Set when no worker stayed healthy (load error, MIME, etc.). */
  private useMainThread = false;

  constructor(privateKey: Uint8Array, workerCount = defaultWorkerCount()) {
    this.privKeyBytes = new Uint8Array(privateKey);
    const n = Math.max(1, workerCount);
    const url = new URL('../../workers/stampSignerWorker.ts', import.meta.url);
    this.ready = this.startWorkers(url, n, privateKey);
  }

  private async startWorkers(url: URL, n: number, privateKey: Uint8Array): Promise<void> {
    const readyWaits: Promise<void>[] = [];
    try {
      for (let i = 0; i < n; i++) {
        const w = new Worker(url, { type: 'module' });
        const wait = new Promise<void>((resolve, reject) => {
          const to = setTimeout(() => reject(new Error('stamp worker ready timeout')), 15_000);
          const onMsg = (ev: MessageEvent) => {
            if (ev.data?.type === 'ready') {
              clearTimeout(to);
              w.removeEventListener('message', onMsg);
              resolve();
            }
          };
          w.addEventListener('message', onMsg);
          w.addEventListener('error', () => {
            clearTimeout(to);
            reject(new Error('stamp worker load failed'));
          });
        });
        readyWaits.push(wait);
        const pk = privateKey.slice();
        w.postMessage({ type: 'init', privKey: pk.buffer }, [pk.buffer]);
        w.onmessage = (ev: MessageEvent) => this.onWorkerMessage(ev);
        this.workers.push(w);
      }
      await Promise.all(readyWaits);
    } catch {
      this.useMainThread = true;
      for (const w of this.workers) {
        try {
          w.terminate();
        } catch {
          // ignore
        }
      }
      this.workers.length = 0;
    }
  }

  private onWorkerMessage(ev: MessageEvent) {
    const msg = ev.data as {
      type?: string;
      id?: number;
      signature?: ArrayBuffer;
      message?: string;
    };
    if (msg?.type === 'signErr' && msg.id !== undefined) {
      const rec = this.pending.get(msg.id);
      if (!rec) return;
      this.pending.delete(msg.id);
      rec.reject(new Error(msg.message ?? 'stamp worker error'));
      return;
    }
    if (msg?.type !== 'sign' || msg.id === undefined || !msg.signature) return;
    const rec = this.pending.get(msg.id);
    if (!rec) return;
    this.pending.delete(msg.id);
    const sig = new Uint8Array(msg.signature);
    if (sig.length !== 65) {
      rec.reject(new Error('invalid worker signature'));
      return;
    }
    rec.resolve(sig);
  }

  async signMsgHash(msgHash: Uint8Array): Promise<Uint8Array> {
    await this.ready;
    if (this.useMainThread || this.workers.length === 0) {
      return signStampMsgHash(this.privKeyBytes, msgHash);
    }
    const id = this.nextId++;
    const w = this.workers[this.rr++ % this.workers.length];
    const copy = msgHash.slice();
    const p = new Promise<Uint8Array>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
    });
    w.postMessage({ type: 'sign', id, msgHash: copy.buffer }, [copy.buffer]);
    return p;
  }

  terminate(): void {
    for (const w of this.workers) {
      try {
        w.terminate();
      } catch {
        // ignore
      }
    }
    this.workers.length = 0;
    for (const [, rec] of this.pending) {
      rec.reject(new Error('stamp signer pool terminated'));
    }
    this.pending.clear();
  }
}

export function tryCreateStampSignerPool(privateKey: Uint8Array): StampSignerPool | null {
  if (typeof Worker === 'undefined') return null;
  try {
    return new StampSignerPool(privateKey);
  } catch {
    return null;
  }
}
