/**
 * Per-batch issuer state persistence to Swarm via Single Owner Chunks.
 *
 * Why: localStorage is the primary store for the stamper's bucket counters,
 * but it's tied to a single browser. A user who switches browsers / devices
 * loses the counters and risks slot collisions on subsequent uploads.
 *
 * Solution: after every successful upload we encrypt the stamper state, push
 * it to Swarm as a content-addressed blob, and write a Single Owner Chunk
 * pointing at that blob. The SOC is owned by our hot key and lives at a
 * deterministic address derived from the batchId — so any browser holding the
 * same wallet (and therefore the same hot key) can read it back.
 *
 * SOC payload layout v2:
 *
 *   offset  size       field
 *      0     1         version (== 2)
 *      1    32         reference of the encrypted state blob (32-byte Swarm hash)
 *     33     8         savedAt unix-ms (uint64 BE)
 *     41     4         encrypted-blob length in bytes (uint32 BE)
 *     45     2         delta entry count N (uint16 BE)
 *     47    N×3        N × { uint16 BE bucket, uint8 increment }
 *
 * The encrypted blob holds the stamper state as it was BEFORE we stamped any
 * chunk for the save (S₀), exactly as in v1. The delta list captures every
 * `(bucket, increment)` pair consumed by the save itself — the K encrypted-
 * blob chunks plus the 1 SOC chunk. On restore we apply the delta to S₀ to
 * reconstruct the post-save state to the slot. No drift, ever.
 *
 * v1 layout (45 bytes, no delta) is still accepted on read for back-compat
 * with any SOCs written by an earlier build. v1 reads return the pre-save
 * state and the documented drift applies to those only.
 *
 * Encrypted blob layout: `[12-byte AES-GCM nonce] || [gzip(state-json) under
 * AES-256-GCM with the SOC AES key]`. The state-json is `{ buckets: number[]
 * (65536 entries), depth: number }`.
 */

import {
  Bee,
  Identifier,
  Reference,
  Stamper,
  type Chunk as BeeJsCAC,
  type EnvelopeWithBatchId,
} from '@ethersphere/bee-js';
import { Binary, type Chunk } from 'cafe-utility';
import { keccak_256 } from '@noble/hashes/sha3';

import type { DerivedHotKey, PersistedStamperState } from './ClientStamping';
import { uploadDataPresigned } from './ClientSideUpload';
import { uploadChunkPresignedFetch } from './FastPresignedStamp';

/** Stable namespace baked into the SOC identifier. Bumping this orphans every existing issuer-state SOC. */
const PURPOSE = 'beeport.issuerState';

/** Stable namespace baked into the AES-256 key derivation. Bumping this orphans every existing ciphertext. */
const AES_KEY_PURPOSE = 'beeport.issuerState.aes-key.v1';

/** Current SOC payload format version. */
const SOC_PAYLOAD_VERSION = 2;

/** Common fixed prefix for v1 / v2: version + blobRef + savedAt + cipherLen. */
const SOC_PAYLOAD_HEADER_LEN = 1 + 32 + 8 + 4;
/** Additional prefix for v2: u16 entry count. */
const SOC_PAYLOAD_V2_DELTA_HEADER_LEN = 2;
/** Bytes per delta entry: u16 bucket + u8 increment. */
const DELTA_ENTRY_LEN = 3;

const utf8 = new TextEncoder();

// ─── Public API ──────────────────────────────────────────────────────────────

export interface SaveIssuerStateResult {
  /** SOC address (Swarm hash, 0x-prefixed) where the state pointer lives. */
  socAddress: `0x${string}`;
  /** Reference of the encrypted state blob. */
  blobReference: `0x${string}`;
  /** Unix-ms timestamp embedded in the SOC. */
  savedAt: number;
  /** How many on-chain slots this save consumed (encrypted blob chunks + 1 SOC). */
  slotsConsumed: number;
  /** Number of distinct buckets touched by the save (= delta entry count). */
  deltaEntries: number;
}

/**
 * Encrypt the current stamper state, push it to Swarm as a chunked blob, and
 * commit a Single Owner Chunk pointing at it. Idempotent in spirit (later
 * saves overwrite the SOC at the same address).
 *
 * The same `stamper` MUST have been used for the preceding upload — we reuse
 * its bucket counters to stamp both the blob chunks and the SOC chunk itself.
 */
export async function saveIssuerStateToSOC(params: {
  bee: Bee;
  hotKey: DerivedHotKey;
  batchId: string;
  stamper: Stamper;
  abortSignal?: AbortSignal;
}): Promise<SaveIssuerStateResult> {
  const { bee, hotKey, batchId, stamper, abortSignal } = params;

  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batchId for SOC save: ${batchId}`);
  }

  // ── Snapshot pre-save state (S₀). This is what gets encrypted into the
  //    blob. The delta computed below brings it forward to the post-save
  //    state on restore.
  //
  //    `stamper.getState()` returns the LIVE buckets array — we must clone
  //    it before any further stamp() call mutates it.
  const beforeBuckets = new Uint32Array(stamper.getState());

  const json = JSON.stringify({
    buckets: Array.from(beforeBuckets),
    depth: stamper.depth,
  });
  const plaintext = utf8.encode(json);

  // ── Compress + encrypt the snapshot.
  const compressed = await gzip(plaintext);
  const aesKey = await deriveAesKey(hotKey.privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, compressed)
  );
  const blob = concatBytes(iv, ciphertext);

  const issuerAddrBytes = hotKey.signer.publicKey().address().toUint8Array();

  // ── Push the encrypted blob through the same presigned-chunks pipeline
  //    we use for files. Each chunk consumes a slot in the batch and mutates
  //    `stamper`'s buckets. We diff before/after to get the blob delta.
  let blobChunks = 0;
  const blobRef = await uploadDataPresigned(
    blob,
    stamper,
    bee,
    abortSignal,
    () => {
      blobChunks++;
    },
    issuerAddrBytes,
    hotKey.privateKey,
    null
  );
  const afterBlobBuckets = stamper.getState();

  const socIdentifier = computeIssuerStateIdentifier(cleanBatchId);

  const baseBlobDelta = new Map<number, number>();
  for (let b = 0; b < 65536; b++) {
    const inc = afterBlobBuckets[b] - beforeBuckets[b];
    if (inc > 0) baseBlobDelta.set(b, inc);
  }

  const bucketFromRef = (addr: Reference): number =>
    Binary.uint16ToNumber(addr.toUint8Array(), 'BE');

  const maxSlot = 2 ** (stamper.depth - 16);
  const bucketHasCapacity = (b: number): boolean => afterBlobBuckets[b] < maxSlot;

  // The v2 payload embeds the slot-delta list, but the inner CAC address (and
  // thus the postage-stamp bucket — same rule as FastPresignedStamp's
  // allocateStampSlot) depends on those bytes. We need B with
  // bucket(CAC(payload(δ + +1@B))) === B.
  //
  // That B must also have a free slot *after* the encrypted-blob chunks: the SOC
  // line consumes one more in the same bucket hash(inner) picks. Hitting a
  // saturated fixed point is a real failure mode — aggregate "680MB" usage can
  // still be far from the theoretical 2^depth cap — so we scan all fixed
  // points for this payload, then bump `savedAt` (payload bytes change → new
  // inner address) until we find one with headroom.
  const baseSavedAt = Date.now();
  // Each bump is at most one Picard orbit + one exhaustive scan (≤65k CACs).
  const MAX_SAVED_AT_BUMPS = 64;
  let savedAt = baseSavedAt;
  let stampBucket!: number;
  let inner!: BeeJsCAC;
  let resolved = false;

  outer: for (let bump = 0; bump < MAX_SAVED_AT_BUMPS; bump++) {
    savedAt = baseSavedAt + bump;
    let picardB = -1;
    let picardInner: BeeJsCAC;
    const seenStampBuckets = new Set<number>();

    for (let iter = 0; iter < 65536; iter++) {
      if (picardB >= 0) {
        if (seenStampBuckets.has(picardB)) {
          break;
        }
        seenStampBuckets.add(picardB);
      }
      const delta = new Map(baseBlobDelta);
      if (picardB >= 0) {
        delta.set(picardB, (delta.get(picardB) ?? 0) + 1);
      }
      const socPayload = encodeSocPayloadV2({
        blobRef: blobRef.toUint8Array(),
        savedAt,
        cipherLen: blob.length,
        delta,
      });
      picardInner = bee.makeContentAddressedChunk(socPayload);
      const nextB = bucketFromRef(picardInner.address);
      if (nextB === picardB) {
        if (picardB >= 0 && bucketHasCapacity(picardB)) {
          stampBucket = picardB;
          inner = picardInner;
          resolved = true;
          break outer;
        }
        // Fixed point whose bucket is already full — try another B or bump savedAt.
        break;
      }
      picardB = nextB;
    }

    for (let B = 0; B < 65536; B++) {
      const delta = new Map(baseBlobDelta);
      delta.set(B, (delta.get(B) ?? 0) + 1);
      const socPayload = encodeSocPayloadV2({
        blobRef: blobRef.toUint8Array(),
        savedAt,
        cipherLen: blob.length,
        delta,
      });
      inner = bee.makeContentAddressedChunk(socPayload);
      if (bucketFromRef(inner.address) === B && bucketHasCapacity(B)) {
        stampBucket = B;
        resolved = true;
        break outer;
      }
    }
  }

  if (!resolved) {
    throw new Error(
      'SOC issuer-state v2: no fixed-point payload with a free slot in its postage bucket (top up, use a deeper stamp, or reset local state)'
    );
  }

  const finalDelta = new Map(baseBlobDelta);
  finalDelta.set(stampBucket, (finalDelta.get(stampBucket) ?? 0) + 1);
  for (const [, inc] of finalDelta) {
    if (inc > 255) {
      throw new Error('Delta increment exceeds u8 limit (bug or absurdly large save).');
    }
  }

  const soc = inner.toSingleOwnerChunk(new Identifier(socIdentifier), hotKey.signer);
  const envelope = stampSocEnvelope(stamper, inner.address.toUint8Array());
  await uploadChunkPresignedFetch(bee.url, soc.data, envelope, {
    abortSignal,
    timeoutMs: 60_000,
  });

  return {
    socAddress: `0x${soc.address.toHex()}` as `0x${string}`,
    blobReference: `0x${blobRef.toHex()}` as `0x${string}`,
    savedAt,
    slotsConsumed: blobChunks + 1,
    deltaEntries: finalDelta.size,
  };
}

export interface LoadIssuerStateResult {
  /** Reconstructed post-save stamper state (blob state + delta for v2; blob state alone for v1). */
  state: PersistedStamperState;
  /** unix-ms */
  savedAt: number;
  socAddress: `0x${string}`;
  blobReference: `0x${string}`;
  /** SOC payload format version actually seen on disk. */
  payloadVersion: number;
  /** True when delta was applied (v2). False for v1 SOCs that lack delta — those leave a small drift. */
  driftFree: boolean;
}

/**
 * Try to fetch the latest issuer state SOC for `(hotKey, batchId)`. Returns
 * null if no SOC has been written yet OR if Bee can't find the chunk. Decrypt
 * failures are surfaced as exceptions — they imply a key/format mismatch
 * (different wallet, bumped purpose string, etc.) that the caller wants to
 * see.
 */
export async function loadIssuerStateFromSOC(params: {
  bee: Bee;
  hotKey: DerivedHotKey;
  batchId: string;
}): Promise<LoadIssuerStateResult | null> {
  const { bee, hotKey, batchId } = params;

  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batchId for SOC load: ${batchId}`);
  }

  // Compute the SOC's address client-side so we know exactly what we're
  // looking at if it 404s (helps debugging in the console).
  const ownerAddress = hotKey.signer.publicKey().address();
  const identifierBytes = computeIssuerStateIdentifier(cleanBatchId);
  const expectedSocAddress = bee.calculateSingleOwnerChunkAddress(
    new Identifier(identifierBytes),
    ownerAddress
  );

  const reader = bee.makeSOCReader(ownerAddress);
  let soc;
  try {
    soc = await reader.download(new Identifier(identifierBytes));
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }

  const payload = soc.payload.toUint8Array();
  if (payload.length < SOC_PAYLOAD_HEADER_LEN) {
    throw new Error(
      `Issuer-state SOC at ${expectedSocAddress.toHex()} has truncated header (len=${payload.length})`
    );
  }
  const version = payload[0];
  if (version !== 1 && version !== 2) {
    throw new Error(
      `Issuer-state SOC at ${expectedSocAddress.toHex()} has unsupported version ${version}`
    );
  }
  const dv = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  const blobRef = new Reference(payload.slice(1, 33));
  const savedAt = Number(dv.getBigUint64(33, false));

  // Parse the delta list (v2 only). For v1 we leave the delta empty — the
  // documented K-slot drift will apply on the first new upload after restore.
  const delta = new Map<number, number>();
  if (version === 2) {
    if (payload.length < SOC_PAYLOAD_HEADER_LEN + SOC_PAYLOAD_V2_DELTA_HEADER_LEN) {
      throw new Error(
        `Issuer-state SOC v2 at ${expectedSocAddress.toHex()} is missing the delta header`
      );
    }
    const entryCount = dv.getUint16(SOC_PAYLOAD_HEADER_LEN, false);
    const entriesStart = SOC_PAYLOAD_HEADER_LEN + SOC_PAYLOAD_V2_DELTA_HEADER_LEN;
    const expectedLen = entriesStart + entryCount * DELTA_ENTRY_LEN;
    if (payload.length < expectedLen) {
      throw new Error(
        `Issuer-state SOC v2 at ${expectedSocAddress.toHex()} truncated: ` +
          `expected ${expectedLen} bytes for ${entryCount} entries, got ${payload.length}`
      );
    }
    for (let i = 0; i < entryCount; i++) {
      const off = entriesStart + i * DELTA_ENTRY_LEN;
      const bucket = dv.getUint16(off, false);
      const inc = payload[off + 2];
      delta.set(bucket, (delta.get(bucket) ?? 0) + inc);
    }
  }

  // Decrypt the pre-save state (S₀).
  const blob = await bee.downloadData(blobRef);
  const blobBytes = blob.toUint8Array();
  if (blobBytes.length < 12 + 16) {
    throw new Error(`Encrypted state blob is too short (${blobBytes.length} bytes)`);
  }
  const iv = blobBytes.slice(0, 12);
  const ciphertext = blobBytes.slice(12);

  const aesKey = await deriveAesKey(hotKey.privateKey);
  let compressed: Uint8Array;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
    );
  } catch (err) {
    throw new Error(
      `Failed to decrypt issuer-state SOC at ${expectedSocAddress.toHex()} ` +
        '— wrong wallet or AES_KEY_PURPOSE bumped'
    );
  }
  const plaintext = await gunzip(compressed);
  const json = JSON.parse(new TextDecoder().decode(plaintext)) as {
    buckets: number[];
    depth: number;
  };
  if (!Array.isArray(json.buckets) || json.buckets.length !== 65536) {
    throw new Error('Issuer-state SOC payload had malformed buckets array');
  }

  // Apply the delta to recover the exact post-save state.
  const buckets = new Uint32Array(json.buckets);
  for (const [bucket, inc] of delta) {
    buckets[bucket] = buckets[bucket] + inc;
  }

  return {
    state: { buckets, depth: json.depth },
    savedAt,
    socAddress: `0x${expectedSocAddress.toHex()}` as `0x${string}`,
    blobReference: `0x${blobRef.toHex()}` as `0x${string}`,
    payloadVersion: version,
    driftFree: version >= 2,
  };
}

// ─── SOC payload encoder ─────────────────────────────────────────────────────

function encodeSocPayloadV2(args: {
  blobRef: Uint8Array;
  savedAt: number;
  cipherLen: number;
  delta: Map<number, number>;
}): Uint8Array {
  const { blobRef, savedAt, cipherLen, delta } = args;
  if (blobRef.length !== 32) {
    throw new Error(`SOC payload encode: blobRef must be 32 bytes, got ${blobRef.length}`);
  }
  const entries = Array.from(delta.entries()).sort((a, b) => a[0] - b[0]);
  if (entries.length > 0xffff) {
    throw new Error(
      `SOC payload encode: ${entries.length} delta entries exceeds u16 limit`
    );
  }
  const totalLen =
    SOC_PAYLOAD_HEADER_LEN +
    SOC_PAYLOAD_V2_DELTA_HEADER_LEN +
    entries.length * DELTA_ENTRY_LEN;
  // The CAC payload limit is 4096 bytes; in practice K ≪ 1000 so we are
  // nowhere near it, but check defensively.
  if (totalLen > 4096) {
    throw new Error(
      `SOC payload encode: ${totalLen} bytes exceeds the 4 KB CAC payload limit`
    );
  }

  const out = new Uint8Array(totalLen);
  const dv = new DataView(out.buffer);
  out[0] = SOC_PAYLOAD_VERSION;
  out.set(blobRef, 1);
  dv.setBigUint64(33, BigInt(savedAt), false);
  dv.setUint32(41, cipherLen, false);
  dv.setUint16(SOC_PAYLOAD_HEADER_LEN, entries.length, false);
  let off = SOC_PAYLOAD_HEADER_LEN + SOC_PAYLOAD_V2_DELTA_HEADER_LEN;
  for (const [bucket, inc] of entries) {
    dv.setUint16(off, bucket, false);
    out[off + 2] = inc;
    off += DELTA_ENTRY_LEN;
  }
  return out;
}

// ─── Identifier / key derivation helpers ─────────────────────────────────────

/**
 * Stable SOC identifier per batch:  keccak256(PURPOSE || batchIdBytes).
 *
 * Embeds the batch id so ALL of a user's batches use distinct SOC slots and
 * we don't accidentally overwrite one batch's state with another's.
 */
export function computeIssuerStateIdentifier(batchId: string): Uint8Array {
  const idBytes = hexToBytes(stripHex(batchId));
  const purpose = utf8.encode(PURPOSE);
  const buf = new Uint8Array(purpose.length + idBytes.length);
  buf.set(purpose, 0);
  buf.set(idBytes, purpose.length);
  return keccak_256(buf);
}

async function deriveAesKey(privateKey: Uint8Array): Promise<CryptoKey> {
  const purpose = utf8.encode(AES_KEY_PURPOSE);
  const buf = new Uint8Array(purpose.length + privateKey.length);
  buf.set(purpose, 0);
  buf.set(privateKey, purpose.length);
  // SHA-256 over (purpose || privateKey) gives us a 32-byte AES-256 key. We
  // already trust `privateKey` to be high-entropy (derived from a wallet
  // signature), so a single hash is sufficient — no HKDF needed.
  const raw = await crypto.subtle.digest('SHA-256', buf);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// ─── Chunk-stamping bridge for SOC ───────────────────────────────────────────

/** Postage for SOC: use bee-js {@link Stamper.stamp} so the envelope matches Bee's verifier (noble path was rejected for this upload on some gateways). */
function stampSocEnvelope(stamper: Stamper, socAddress: Uint8Array): EnvelopeWithBatchId {
  const fakeChunk = {
    hash: () => socAddress,
    build: () => new Uint8Array(),
    span: 0n,
  } as unknown as Chunk;
  return stamper.stamp(fakeChunk);
}

// ─── Compression + low-level utils ───────────────────────────────────────────

async function gzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function gunzip(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const a of arrs) {
    out.set(a, off);
    off += a.length;
  }
  return out;
}

function stripHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = stripHex(hex);
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string of odd length: ${hex.slice(0, 12)}…`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function isNotFound(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /404|not\s*found|no\s+chunk|does\s+not\s+exist/i.test(msg);
}
