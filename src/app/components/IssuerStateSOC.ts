/**
 * Per-batch issuer state persistence to Swarm via Single Owner Chunks.
 *
 * Why: localStorage is the primary store for the stamper's bucket counters,
 * but it's tied to a single browser. A user who switches browsers / devices
 * loses the counters and risks slot collisions on subsequent uploads.
 *
 * Solution: after every successful upload we encrypt the stamper state, push
 * it to Swarm as a content-addressed blob, and write a Single Owner Chunk
 * pointing at that blob. The SOC is owned by our hot key and lives at an
 * address derived from the batchId and a save INDEX — so any browser holding
 * the same wallet (and therefore the same hot key) can find the latest one.
 * Each save writes index+1 and never overwrites an earlier backup (a chunk
 * rewritten at the same address can be served stale by nodes and gateways).
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
  EthAddress,
  Identifier,
  Reference,
  Signature,
  Stamper,
} from '@ethersphere/bee-js';
import { Binary, type Chunk } from 'cafe-utility';
import { ChunkJoiner } from '@ethersphere/core-sdk/chunk';
import { keccak_256 } from '@noble/hashes/sha3';

import type { DerivedHotKey, PersistedStamperState } from './ClientStamping';
import { uploadDataPresigned } from './ClientSideUpload';
import { buildStampEnvelope, uploadSocPresignedFetch } from './FastPresignedStamp';

/** Stable namespace baked into the SOC identifier. Bumping this orphans every existing issuer-state SOC. */
const PURPOSE = 'beeport.issuerState';

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
  /** Backup index written (0 = first save for this batch). */
  index: number;
  /** How many on-chain slots this save consumed (encrypted blob chunks + 1 SOC). */
  slotsConsumed: number;
  /** Number of distinct buckets touched by the save (= delta entry count). */
  deltaEntries: number;
}

/**
 * Pick the backup index for a save.
 *
 * `wanted` is this browser's last known index + 1. Another device can have
 * written that index (or later ones) since, so check it first: if it exists,
 * merge the newest backup into the live stamper (element-wise max, so this
 * browser never re-uses a slot the other device used) and write after it.
 * A failed check is not fatal: the save goes ahead at `wanted`.
 */
async function resolveSaveIndex(args: {
  bee: Bee;
  hotKey: DerivedHotKey;
  cleanBatchId: string;
  stamper: Stamper;
  wanted?: number;
}): Promise<number> {
  const { bee, hotKey, cleanBatchId, stamper, wanted } = args;
  const ownerAddress = new EthAddress(hotKey.address);
  if (wanted === undefined) {
    return (await findLatestIndex(bee, ownerAddress, cleanBatchId)) + 1;
  }
  let taken: boolean;
  try {
    taken = (await readSocPayloadAt(bee, ownerAddress, cleanBatchId, wanted)) !== null;
  } catch {
    return wanted;
  }
  if (!taken) return wanted;

  const latest = await findLatestIndex(bee, ownerAddress, cleanBatchId, wanted);
  try {
    const remote = await loadIssuerStateFromSOC({
      bee,
      hotKey,
      batchId: cleanBatchId,
      index: latest,
    });
    if (remote) {
      const live = stamper.getState();
      const other = remote.state.buckets;
      for (let b = 0; b < live.length && b < other.length; b++) {
        if (other[b] > live[b]) live[b] = other[b];
      }
    }
  } catch (err) {
    console.warn(
      `[IssuerStateSOC] newer backup at index ${latest} could not be merged before save:`,
      err
    );
  }
  return latest + 1;
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
  /**
   * Backup index to write. Omit to look up the latest on Swarm and write the
   * next one. Callers pass `lastKnownIndex + 1` to skip that lookup.
   */
  index?: number;
}): Promise<SaveIssuerStateResult> {
  const { bee, hotKey, batchId, stamper, abortSignal } = params;

  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batchId for SOC save: ${batchId}`);
  }

  const saveIndex = await resolveSaveIndex({ bee, hotKey, cleanBatchId, stamper, wanted: params.index });

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
  const aesKey = hotKey.socAesKey;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, compressed)
  );
  const blob = concatBytes(iv, ciphertext);

  const issuerAddrBytes = hotKey.issuerAddrBytes;

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
    hotKey.stampPool,
    null
  );
  const afterBlobBuckets = stamper.getState();

  const socIdentifier = computeIssuerStateIdentifier(cleanBatchId, saveIndex);

  const baseBlobDelta = new Map<number, number>();
  for (let b = 0; b < 65536; b++) {
    const inc = afterBlobBuckets[b] - beforeBuckets[b];
    if (inc > 0) baseBlobDelta.set(b, inc);
  }

  // Bee validates the postage stamp against `chunk.Address()` (see
  // `pkg/postage/stamp.go: Valid`). For a SOC, `Chunk()` is built with the
  // SOC address (`pkg/soc/soc.go: Chunk()`), so the stamp signature, the
  // bucket, and the bucket-cap check must all use `soc.address`, not the
  // inner CAC address. The SOC address is `keccak256(identifier || owner)`
  // and is constant for a given (batchId, hotKey) — no fixed-point search
  // is needed (and the previous Picard/exhaustive loop blocked the main
  // thread for seconds on heavily-used stamps).
  const ownerAddress = new EthAddress(hotKey.address);
  const socAddressRef = bee.calculateSingleOwnerChunkAddress(
    new Identifier(socIdentifier),
    ownerAddress
  );
  const socAddressBytes = socAddressRef.toUint8Array();
  const stampBucket = Binary.uint16ToNumber(socAddressBytes, 'BE');

  const maxSlot = 2 ** (stamper.depth - 16);
  if (afterBlobBuckets[stampBucket] >= maxSlot) {
    throw new Error(
      `SOC issuer-state bucket ${stampBucket} is full (${afterBlobBuckets[stampBucket]}/${maxSlot}). ` +
        'The backup chunk for this save lands in that bucket — use a larger storage ' +
        'or a different batch.'
    );
  }

  const savedAt = Date.now();
  const finalDelta = new Map(baseBlobDelta);
  finalDelta.set(stampBucket, (finalDelta.get(stampBucket) ?? 0) + 1);
  for (const [, inc] of finalDelta) {
    if (inc > 255) {
      throw new Error('Delta increment exceeds u8 limit (bug or absurdly large save).');
    }
  }

  const socPayload = encodeSocPayloadV2({
    blobRef: blobRef.toUint8Array(),
    savedAt,
    cipherLen: blob.length,
    delta: finalDelta,
  });
  const inner = bee.makeContentAddressedChunk(socPayload);
  const socIdentifierObj = new Identifier(socIdentifier);
  const ownerDigest = Binary.concatBytes(
    socIdentifierObj.toUint8Array(),
    inner.address.toUint8Array()
  );
  const ownerSigBytes = await hotKey.signOwnerPayload(ownerDigest);
  const signature = new Signature(ownerSigBytes);
  const soc = {
    data: Binary.concatBytes(
      socIdentifierObj.toUint8Array(),
      signature.toUint8Array(),
      inner.span.toUint8Array(),
      inner.payload.toUint8Array()
    ),
    identifier: socIdentifierObj,
    signature,
    span: inner.span,
    payload: inner.payload,
    address: socAddressRef,
    owner: ownerAddress,
  };
  const socAddrBytes = soc.address.toUint8Array();
  if (!Binary.equals(socAddrBytes, socAddressRef.toUint8Array())) {
    throw new Error(
      'SOC address from bee-js does not match calculateSingleOwnerChunkAddress — cannot stamp safely.'
    );
  }

  // The stamp signature must be over the SOC address — Bee verifies the
  // postage stamp against `chunk.Address()`, and for a SOC that's
  // `keccak256(identifier || owner)` (see `pkg/soc/soc.go: CreateAddress`).
  // We sign with the same Noble + `ethSignedHashForStampPayload` path used
  // for every other presigned chunk; the only SOC-specific bit is the
  // address we feed into the digest.
  const fakeChunk = {
    hash: () => socAddrBytes,
    build: () => inner.data,
    span: inner.span.toBigInt(),
  } as unknown as Chunk;

  const envelope = await buildStampEnvelope(
    stamper,
    fakeChunk,
    issuerAddrBytes,
    null,
    hotKey.stampPool
  );

  // Bee's `/chunks` endpoint is for Content-Addressed Chunks: it BMT-hashes
  // the body to derive the chunk address and verifies the stamp against
  // that. Posting `soc.data` (or even just span+payload) there would always
  // make the stamp invalid for a SOC. SOC uploads must go to
  // `/soc/{owner}/{identifier}?sig={sig}` so Bee assembles the SOC and
  // checks the stamp against the SOC address.
  const ownerHex = ownerAddress.toHex();
  const identifierHex = Binary.uint8ArrayToHex(socIdentifier);
  const sigHex = soc.signature.toHex();
  await uploadSocPresignedFetch(
    bee.url,
    inner.data,
    ownerHex,
    identifierHex,
    sigHex,
    envelope,
    { abortSignal, timeoutMs: 60_000 }
  );

  return {
    socAddress: `0x${soc.address.toHex()}` as `0x${string}`,
    blobReference: `0x${blobRef.toHex()}` as `0x${string}`,
    savedAt,
    index: saveIndex,
    slotsConsumed: blobChunks + 1,
    deltaEntries: finalDelta.size,
  };
}

/** Download the backup SOC chunk at `index`; `null` when it does not exist. */
async function readSocPayloadAt(
  bee: Bee,
  ownerAddress: EthAddress,
  cleanBatchId: string,
  index: number
): Promise<Uint8Array | null> {
  const reader = bee.makeSOCReader(ownerAddress);
  const identifier = new Identifier(computeIssuerStateIdentifier(cleanBatchId, index));
  for (let attempt = 0; ; attempt++) {
    try {
      const soc = await reader.download(identifier);
      return soc.payload.toUint8Array();
    } catch (err) {
      if (isNotFound(err) || isNoPeerLeft(err)) return null;
      // Other 5xx answers and network errors are transient: retry them
      // before giving up, so one bad answer does not stop an upload.
      if (attempt >= SOC_READ_RETRY_DELAYS_MS.length || !isTransientReadError(err)) throw err;
      await new Promise(r => setTimeout(r, SOC_READ_RETRY_DELAYS_MS[attempt]));
    }
  }
}

/**
 * Bee's `500 read chunk failed` for a chunk that recent lookups did not find.
 * Bee skips each peer that failed to return a chunk for one minute
 * (`pkg/retrieval`: `skiplistDur`). After about three failed reads of the same
 * address no peer is left, and Bee answers 500 with this message instead of
 * 404 until the address has been left alone for a minute. Every backup
 * lookup reads "the next index", which does not exist yet, so this answer is
 * normal. Matched on the exact JSON message so a proxy error page is not
 * mistaken for it.
 */
function isNoPeerLeft(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: unknown; responseBody?: unknown; response?: { status?: unknown } };
  if ((e.status ?? e.response?.status) !== 500) return false;
  let body = e.responseBody;
  try {
    if (body instanceof ArrayBuffer) body = new Uint8Array(body);
    if (body instanceof Uint8Array) body = new TextDecoder().decode(body);
    if (typeof body === 'string') body = JSON.parse(body);
  } catch {
    return false;
  }
  return (body as { message?: unknown } | null)?.message === 'read chunk failed';
}

/** Waits between retries of a backup chunk read that failed transiently. */
const SOC_READ_RETRY_DELAYS_MS = [1_000, 2_000, 4_000];

/** A 5xx answer or a request that got no answer at all (network error). */
function isTransientReadError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as {
    name?: unknown;
    status?: unknown;
    statusText?: unknown;
    response?: { status?: unknown };
  };
  if (e.name === 'AbortError' || e.statusText === 'ERR_CANCELED') return false;
  const status = typeof e.status === 'number' ? e.status : e.response?.status;
  return typeof status !== 'number' || status >= 500;
}

/**
 * Find the highest backup index that exists for `(hotKey, batchId)`; `-1` when
 * none does. Backups are written at consecutive indexes: gallop upward from
 * `hintIndex` (highest index this browser knows of; `-1`/omitted = scratch),
 * then binary-search the gap.
 *
 * A single miss is not trusted on its own:
 *  - The next TWO indexes are probed together, so one index that never reached
 *    the network (a save that failed half-way) does not end the search.
 *  - Misses found during the search are re-read in the next round.
 *  - Without a hint (fresh browser, restore path) the final "nothing newer"
 *    answer is confirmed with a second, fresh read of both indexes, because a
 *    wrong answer there restores old counters.
 * A re-read asks peers that the first read did not try. When no peer is left,
 * Bee answers 500 for a minute; {@link isNoPeerLeft} reads that as a miss.
 *
 * Up to date with a hint costs one round of two parallel probes that miss
 * (about 1 s on the gateway).
 */
async function findLatestIndex(
  bee: Bee,
  ownerAddress: EthAddress,
  cleanBatchId: string,
  hintIndex?: number | null,
  cache: Map<number, Uint8Array | null> = new Map()
): Promise<number> {
  const read = async (i: number, fresh = false): Promise<boolean> => {
    if (fresh || !cache.has(i)) cache.set(i, await readSocPayloadAt(bee, ownerAddress, cleanBatchId, i));
    return cache.get(i) !== null;
  };
  const hasHint = hintIndex !== undefined && hintIndex !== null && hintIndex >= 0;
  let lo = hasHint ? (hintIndex as number) : -1;

  for (let round = 0; round < 8; round++) {
    let [n1, n2] = await Promise.all([read(lo + 1), read(lo + 2)]);
    if (!n1 && !n2 && !hasHint) {
      [n1, n2] = await Promise.all([read(lo + 1, true), read(lo + 2, true)]);
    }
    if (!n1 && !n2) return lo;

    lo = n2 ? lo + 2 : lo + 1;
    let step = 2;
    while (await read(lo + step)) {
      lo += step;
      step *= 2;
    }
    let hi = lo + step; // missing (as far as one read can tell)
    while (hi - lo > 1) {
      const mid = lo + Math.floor((hi - lo) / 2);
      if (await read(mid)) lo = mid;
      else hi = mid;
    }
    // Forget misses above `lo`, so the next round reads them again.
    for (const [k, v] of cache) if (k > lo && v === null) cache.delete(k);
  }
  return lo;
}

/**
 * Cheap pre-upload staleness probe: the highest backup index on Swarm (`-1` =
 * none), without downloading or decrypting any blob. Another device has
 * written newer state when this is higher than the index this browser last
 * wrote or absorbed.
 */
export async function peekLatestIssuerStateIndex(params: {
  bee: Bee;
  hotKey: DerivedHotKey;
  batchId: string;
  /** Highest index this browser already knows of (see {@link findLatestIndex}). */
  hintIndex?: number | null;
}): Promise<number> {
  const { bee, hotKey, batchId, hintIndex } = params;
  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batchId for SOC peek: ${batchId}`);
  }
  return findLatestIndex(bee, new EthAddress(hotKey.address), cleanBatchId, hintIndex);
}

export interface LoadIssuerStateResult {
  /** Reconstructed post-save stamper state (blob state + delta for v2; blob state alone for v1). */
  state: PersistedStamperState;
  /** unix-ms */
  savedAt: number;
  /** Backup index this state was read from. */
  index: number;
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
/**
 * Short, non-secret fingerprint of an AES key: the first 4 bytes of AES-GCM
 * over 16 zero bytes with a fixed all-zero IV. Real backups use random IVs, so
 * this reveals nothing about them. Logged on save and on a failed load to tell
 * "different key" from "damaged blob" when a restore fails.
 */
async function aesKeyFingerprint(key: CryptoKey): Promise<string> {
  try {
    const out = new Uint8Array(
      await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, key, new Uint8Array(16))
    );
    return Array.from(out.slice(0, 4))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  } catch {
    return 'unavailable';
  }
}

/** The backup chunk was read, but its blob did not decrypt with the current key. */
export class IssuerStateDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'IssuerStateDecryptError';
  }
}

export async function loadIssuerStateFromSOC(params: {
  bee: Bee;
  hotKey: DerivedHotKey;
  batchId: string;
  /** Read this exact backup index. Omit to read the latest one. */
  index?: number;
  /** Highest index already known (speeds up the latest-index lookup). */
  hintIndex?: number | null;
}): Promise<LoadIssuerStateResult | null> {
  const { bee, hotKey, batchId } = params;
  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batchId for SOC load: ${batchId}`);
  }

  // Compute the SOC's address client-side so we know exactly what we're
  // looking at if it 404s (helps debugging in the console).
  const ownerAddress = new EthAddress(hotKey.address);
  const cache = new Map<number, Uint8Array | null>();
  const loadIndex =
    params.index ??
    (await findLatestIndex(bee, ownerAddress, cleanBatchId, params.hintIndex, cache));
  if (loadIndex < 0) return null;
  const expectedSocAddress = bee.calculateSingleOwnerChunkAddress(
    new Identifier(computeIssuerStateIdentifier(cleanBatchId, loadIndex)),
    ownerAddress
  );

  const payload =
    cache.get(loadIndex) ?? (await readSocPayloadAt(bee, ownerAddress, cleanBatchId, loadIndex));
  if (!payload) return null;
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
  // Read the blob chunk by chunk (`GET /chunks`), NOT with `bee.downloadData`
  // (`GET /bytes`): the Beeport gateways serve their web app (HTML, status 200)
  // for `/bytes`, which made every restore fail with a decrypt error.
  const blobBytes = await ChunkJoiner.collect(blobRef.toUint8Array(), addr =>
    bee.downloadChunk(addr)
  );
  if (blobBytes.length < 12 + 16) {
    throw new Error(`Encrypted state blob is too short (${blobBytes.length} bytes)`);
  }
  const iv = blobBytes.slice(0, 12);
  const ciphertext = blobBytes.slice(12);

  const aesKey = hotKey.socAesKey;
  let compressed: Uint8Array;
  try {
    compressed = new Uint8Array(
      await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ciphertext)
    );
  } catch (err) {
    console.error('[IssuerStateSOC] decrypt failed', {
      socAddress: expectedSocAddress.toHex(),
      hotKeyAddress: hotKey.address,
      keyFingerprint: await aesKeyFingerprint(aesKey),
      blobRef: blobRef.toHex(),
      savedAt,
      payloadVersion: version,
      blobBytesLength: blobBytes.length,
      ivHex: Array.from(iv).map(b => b.toString(16).padStart(2, '0')).join(''),
    });
    throw new IssuerStateDecryptError(
      `Failed to decrypt issuer-state SOC ${expectedSocAddress.toHex().slice(0, 10)}… ` +
        '(different wallet key or encryption purpose)'
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
    index: loadIndex,
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
 * SOC identifier for save number `index` of a batch.
 *
 * Index 0 is the original per-batch identifier `keccak256(PURPOSE || batchId)`,
 * so backups written before indexes existed stay readable as index 0. Higher
 * indexes append a big-endian u32. Every save writes a NEW address: a chunk
 * that is rewritten at the same address can be served stale by gateways and
 * nodes, so a backup is never overwritten.
 *
 * The batch id is part of the hash, so each batch has its own chain.
 */
export function computeIssuerStateIdentifier(batchId: string, index = 0): Uint8Array {
  if (!Number.isInteger(index) || index < 0 || index > 0xffffffff) {
    throw new Error(`Invalid issuer-state index: ${index}`);
  }
  const idBytes = hexToBytes(stripHex(batchId));
  const purpose = utf8.encode(PURPOSE);
  const extra = index === 0 ? 0 : 4;
  const buf = new Uint8Array(purpose.length + idBytes.length + extra);
  buf.set(purpose, 0);
  buf.set(idBytes, purpose.length);
  if (extra) new DataView(buf.buffer).setUint32(purpose.length + idBytes.length, index, false);
  return keccak_256(buf);
}

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

/**
 * True only for an HTTP 404 from the gateway. Never matched on message text:
 * a proxy page or an unrelated error that happens to contain "not found"
 * must not be read as "no SOC exists" (that decision can start an upload
 * from blank counters).
 */
function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: unknown; response?: { status?: unknown } };
  return e.status === 404 || e.response?.status === 404;
}
