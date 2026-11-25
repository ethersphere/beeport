/**
 * Client-side postage stamping helpers (SWIP – self-custody pattern, mode α).
 *
 * Pure browser code: no key material is ever sent to the gateway. The user's
 * wallet (e.g. MetaMask) signs ONE canonical message (EIP-191 personal_sign)
 * which is hashed into a "hot key". The hot key:
 *
 *   1. is the on-chain `_owner` of the postage batch (`createBatch(_owner=…)`)
 *   2. signs every per-chunk stamp digest locally
 *
 * Wallets that implement RFC-6979 deterministic ECDSA (MetaMask, Rabby, …)
 * produce a stable signature for the same message, so the same hot key can be
 * re-derived across sessions / devices for the same wallet.
 *
 *   hotKey = keccak256( walletSig( CANONICAL_MSG ) )
 *
 * The hot-key private scalar lives only in stamp workers ({@link HotKeySession}).
 * Main thread holds the public address and signing pool. After 15 minutes of
 * user inactivity the session clears and the wallet must sign again.
 *
 * NOTE: anyone who can prompt the user to sign the canonical message from the
 *   same wallet can re-derive the same hot key. Scope <purpose> to your origin
 *   and educate users at the prompt.
 */

import {
  STAMPER_STATE_STORE,
  STAMPED_ADDRS_STORE,
  awaitRequest,
  withStore,
} from './IndexedDBStore';

export {
  HOT_KEY_IDLE_MS,
  HOT_KEY_PURPOSE,
  buildCanonicalDerivationMessage,
  clearHotKey,
  clearHotKeysExcept,
  deriveHotKey,
  hasActiveHotKey,
  touchHotKeySession,
  type DerivedHotKey,
} from './HotKeySession';

/**
 * Returns the cached hot-key address for a wallet, if previously derived in
 * this browser. Does NOT prompt the wallet. Used to render UI before the
 * user has clicked "Enable self-custody".
 */
export function getCachedHotKeyAddress(walletAddress: string): `0x${string}` | null {
  const key = `beeport.hotKeyAddress.${walletAddress.toLowerCase()}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored && stored.startsWith('0x') && stored.length === 42) {
      return stored as `0x${string}`;
    }
  } catch {
    // ignore
  }
  return null;
}

// deriveHotKey / clearHotKey — see HotKeySession.ts

// ─── Issuer-state persistence ─────────────────────────────────────────────────

/**
 * Per-batch issuer state (the bucket counters used for slot allocation).
 * Persisted across sessions in IndexedDB so two upload runs against the same
 * batch don't collide on `(bucket, cnt)`.
 *
 * Storage backend: IndexedDB ObjectStore `stamperState` keyed by batchId.
 * Each record is `{ batchId, buckets: Uint32Array, depth }`. We store the
 * `Uint32Array` directly via structured clone — no JSON round-trip, no
 * per-int parse cost on load, and no quota pressure (unlike the original
 * localStorage layout which blew through the ~5 MB origin cap once a single
 * stamped-address set hit 32 k entries).
 *
 * Legacy migration: on the first read for a batchId we also check the old
 * localStorage key `beeport.stamper.<batchIdHex>`; if found we copy it into
 * IDB and remove the localStorage entry so existing batches don't lose
 * their bucket counters across the storage swap.
 */
export interface PersistedStamperState {
  buckets: Uint32Array;
  depth: number;
}

const stamperStorageKey = (batchId: string) =>
  `beeport.stamper.${stripHex(batchId).toLowerCase()}`;

interface StamperStateRecord {
  batchId: string;
  buckets: Uint32Array;
  depth: number;
}

/**
 * One-time migration helper: if the legacy `localStorage` payload exists
 * for this batch, parse it and delete the key so the next read goes
 * straight to IDB. Returns the parsed state (or `null`) so the caller can
 * write it through into IDB without a second JSON.parse.
 */
function readLegacyStamperState(batchId: string): PersistedStamperState | null {
  if (typeof localStorage === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(stamperStorageKey(batchId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { buckets: number[]; depth: number };
    if (!Array.isArray(parsed.buckets) || parsed.buckets.length !== 65536) {
      console.warn('Discarding malformed legacy stamper state for', batchId);
      try {
        localStorage.removeItem(stamperStorageKey(batchId));
      } catch {
        // ignore
      }
      return null;
    }
    return {
      buckets: new Uint32Array(parsed.buckets),
      depth: parsed.depth,
    };
  } catch (err) {
    console.warn('Failed to parse legacy stamper state for', batchId, err);
    return null;
  }
}

export async function loadStamperState(
  batchId: string
): Promise<PersistedStamperState | null> {
  const key = stripHex(batchId).toLowerCase();
  try {
    const record = await withStore(STAMPER_STATE_STORE, 'readonly', store =>
      awaitRequest(store.get(key))
    );
    if (record) {
      const r = record as StamperStateRecord;
      // Be defensive: a future schema change or partial write could leave a
      // record with the wrong shape. Treat malformed records as "no state"
      // rather than handing bad data to `Stamper.fromState`.
      if (r.buckets instanceof Uint32Array && r.buckets.length === 65536) {
        return { buckets: r.buckets, depth: r.depth };
      }
      console.warn('Discarding malformed IDB stamper state for', batchId);
    }
  } catch (err) {
    console.warn('Failed to load stamper state from IDB for', batchId, err);
  }

  // Fall back to legacy localStorage; if found, write through into IDB so
  // subsequent reads skip this branch.
  const legacy = readLegacyStamperState(batchId);
  if (legacy) {
    try {
      await saveStamperState(batchId, legacy);
      try {
        localStorage.removeItem(stamperStorageKey(batchId));
      } catch {
        // ignore
      }
    } catch (err) {
      console.warn('Migration of stamper state to IDB failed for', batchId, err);
    }
    return legacy;
  }
  return null;
}

export async function saveStamperState(
  batchId: string,
  state: PersistedStamperState
): Promise<void> {
  const key = stripHex(batchId).toLowerCase();
  try {
    await withStore(STAMPER_STATE_STORE, 'readwrite', store => {
      // Read-merge-write in ONE transaction: counters only ever grow, so the
      // stored record becomes the element-wise max of what is there and what
      // we write. A late or out-of-order save (an older stamper's final
      // flush, a second tab, a beforeunload put) can then never roll the
      // counters back and re-issue used slots. Resets go through
      // clearStamperState, not here.
      //
      // The new array is a fresh copy, so the in-memory Stamper (which keeps
      // a mutable reference to its own state) never aliases the stored one.
      const req = store.get(key);
      req.onsuccess = () => {
        const existing = req.result as StamperStateRecord | undefined;
        const merged = existing?.buckets
          ? mergeStamperStates(
              { buckets: existing.buckets, depth: existing.depth },
              state
            )
          : { buckets: new Uint32Array(state.buckets), depth: state.depth };
        const record: StamperStateRecord = {
          batchId: key,
          buckets: merged.buckets,
          // Keep the depth the caller saved with; the merge only decides counters.
          depth: state.depth,
        };
        store.put(record);
      };
    });
  } catch (err) {
    // IDB has effectively no practical quota for this volume, so a failure
    // here is unexpected — log loudly so it doesn't get swallowed.
    console.warn('Failed to persist stamper state to IDB for', batchId, err);
  }
}

export async function clearStamperState(batchId: string): Promise<void> {
  const key = stripHex(batchId).toLowerCase();
  try {
    await withStore(STAMPER_STATE_STORE, 'readwrite', store => {
      store.delete(key);
    });
  } catch {
    // ignore — clearing is best-effort
  }
  // Also remove any lingering legacy entry so a future load doesn't re-import it.
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(stamperStorageKey(batchId));
      localStorage.removeItem(socSyncStorageKey(batchId));
    }
  } catch {
    // ignore
  }
}

// ─── SOC sync marker ──────────────────────────────────────────────────────────
//
// Tracks the INDEX of the newest issuer-state backup that this browser's local
// state is known to incorporate (either because we wrote it ourselves, or
// because we restored/merged from it). `-1` means "checked, none exists".
// Before an upload that runs on non-empty local state, the pipeline probes
// Swarm: a backup at a HIGHER index than this marker means another device has
// uploaded to the batch since we last synced, and our counters under-count —
// see `resolveStamperStateForUpload` in ClientSideUpload.ts.
//
// Stored in localStorage (a single small number per batch) rather than IDB:
// it's written at most once per upload and read once per upload, so none of
// the quota/latency reasons that moved the bucket counters to IDB apply.

const socSyncStorageKey = (batchId: string) =>
  `beeport.socIndex.${stripHex(batchId).toLowerCase()}`;

/**
 * Index of the last issuer-state backup this browser wrote or absorbed for
 * `batchId` (`-1` = none exists), or `null` if unknown (never synced).
 */
export function getLastSyncedSocIndex(batchId: string): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(socSyncStorageKey(batchId));
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= -1 ? n : null;
  } catch {
    return null;
  }
}

/** Record that local state now incorporates the backup at `index`. */
export function setLastSyncedSocIndex(batchId: string, index: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(socSyncStorageKey(batchId), String(index));
  } catch {
    // ignore — marker is an optimisation; worst case we re-merge next upload
  }
}

const socIgnoreStorageKey = (batchId: string) =>
  `beeport.socIgnoreUnreadable.${stripHex(batchId).toLowerCase()}`;

/**
 * Index of an unreadable issuer-state backup that the user chose to ignore for
 * `batchId`, or `null`. The override only matches that exact backup: a
 * different (newer) backup on Swarm asks again.
 */
export function getIgnoredUnreadableSocIndex(batchId: string): number | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(socIgnoreStorageKey(batchId));
    if (raw === null || raw === '') return null;
    const n = Number(raw);
    return Number.isInteger(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function setIgnoredUnreadableSocIndex(batchId: string, index: number): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(socIgnoreStorageKey(batchId), String(index));
  } catch {
    // ignore — the user is asked again on the next upload
  }
}

/**
 * Merge two stamper states for the same batch by taking the element-wise
 * MAX of the bucket counters.
 *
 * Why max is the correct merge: within a bucket, slot indices are allocated
 * sequentially from 0, so a counter value `c` means "indices [0, c) are
 * (possibly) used". Whatever histories produced the two states, every index
 * either device ever allocated is below its own counter — so `max(a, b)`
 * covers the union of used indices, and future allocations starting from the
 * merged counters can never collide with a previously stored chunk. (Any
 * collisions the two diverged histories already caused are in the past and
 * not recoverable here.)
 *
 * Both states must be at the same depth — caller checks.
 */
export function mergeStamperStates(
  a: PersistedStamperState,
  b: PersistedStamperState
): PersistedStamperState {
  // Bucket counters are independent of depth: the bucket comes from the chunk
  // address and `cnt` counts slots used in that bucket. A max-merge across
  // depths is therefore still exact for "which slots were used". The depth
  // only sets maxSlot, which the caller takes from the batch itself.
  const len = Math.max(a.buckets.length, b.buckets.length);
  const buckets = new Uint32Array(len);
  for (let i = 0; i < len; i++) {
    buckets[i] = Math.max(a.buckets[i] ?? 0, b.buckets[i] ?? 0);
  }
  return { buckets, depth: Math.max(a.depth, b.depth) };
}

// ─── Per-batch chunk-address dedup ────────────────────────────────────────────
//
// bee-js's `Stamper.stamp(chunk)` always advances the bucket counter — there
// is no "stamp at the previously-allocated slot for this address" API. So
// uploading the SAME file (or the same chunk that appears in any prior
// upload) to the SAME batch unconditionally burns another slot, even though
// Bee already has the chunk and dedups by address on its end.
//
// To avoid that footgun for the "I'm using the same test files repeatedly"
// workflow, we keep a per-batch set of chunk-address hexes that we have
// previously stamped+uploaded successfully. The upload pipeline consults
// this set BEFORE calling `stamper.stamp()` — on a hit, we skip the entire
// (stamp, sign, POST) sequence: the bucket counter never moves, no slot is
// burned, and Bee is unaffected (the chunk is already there).
//
// Storage backend: IndexedDB ObjectStore `stampedAddrs` with composite key
// `[batchId, addrHex]` and a `byBatch` index. Replaces the original
// localStorage layout, which serialised the entire set as a single JSON
// array on every flush — a 32 k-chunk batch hit ~2 MB and tipped any
// browser with a couple of active batches over the ~5 MB origin quota
// (`QuotaExceededError` on `setItem`).
//
// New write pattern: ONE `put` per address as soon as Bee accepts the
// chunk, instead of a debounced bulk re-serialization of the full set.
// Read pattern: a single index scan returns the entire set for a batch.
//
// Legacy migration: on the first `loadStampedAddresses` for a batch we
// also check the old localStorage key, copy any entries into IDB and
// remove the legacy entry so the next read goes straight to IDB.

const stampedAddrsStorageKey = (batchId: string) =>
  `beeport.stamped.${stripHex(batchId).toLowerCase()}`;

/**
 * Lowercase 64-char hex of a 32-byte chunk address. Centralised so the
 * upload path and the load/save helpers can't drift in case format.
 */
function chunkAddressHex(addressBytes: Uint8Array): string {
  if (addressBytes.length !== 32) {
    throw new Error(
      `Expected 32-byte chunk address, got ${addressBytes.length} bytes`
    );
  }
  let hex = '';
  for (let i = 0; i < 32; i++) {
    hex += addressBytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

interface StampedAddrRecord {
  batchId: string;
  addrHex: string;
}

/**
 * Read the legacy localStorage payload for this batch, if any. Returns the
 * parsed set (or `null`) so the caller can write it through into IDB
 * without a second JSON.parse. Removes the legacy entry on success so the
 * migration only runs once per batch.
 */
function readLegacyStampedAddresses(batchId: string): string[] | null {
  if (typeof localStorage === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(stampedAddrsStorageKey(batchId));
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return null;
    return (arr as unknown[]).filter((v): v is string => typeof v === 'string');
  } catch (err) {
    console.warn('Failed to parse legacy stamped-address set for', batchId, err);
    return null;
  }
}

/**
 * Upper bound for the in-memory dedup set of one batch (about 130 bytes per
 * entry in a JS Set, so roughly 200 MB at the limit). The set only avoids
 * re-stamping chunks that were already sent; a chunk past the limit is simply
 * stamped again, which costs one slot but never corrupts state. All entries
 * are still written to IndexedDB.
 */
export const MAX_STAMPED_ADDRS_IN_MEMORY = 1_500_000;

/** Record a successfully uploaded chunk: memory (bounded) and IndexedDB (all). */
export function rememberStampedAddress(
  set: Set<string>,
  batcher: { add(addrHex: string): void },
  addrHex: string
): void {
  if (set.size < MAX_STAMPED_ADDRS_IN_MEMORY) set.add(addrHex);
  batcher.add(addrHex);
}

export async function loadStampedAddresses(batchId: string): Promise<Set<string>> {
  const key = stripHex(batchId).toLowerCase();
  const set = new Set<string>();

  try {
    await withStore(STAMPED_ADDRS_STORE, 'readonly', store => {
      // Use the byBatch index to avoid scanning records for other batches.
      const range = IDBKeyRange.only(key);
      const cursorReq = store.index('byBatch').openCursor(range);
      return new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) {
            resolve();
            return;
          }
          const v = cursor.value as StampedAddrRecord;
          if (typeof v.addrHex === 'string') set.add(v.addrHex);
          if (set.size >= MAX_STAMPED_ADDRS_IN_MEMORY) {
            resolve();
            return;
          }
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    });
  } catch (err) {
    console.warn('Failed to load stamped-address set from IDB for', batchId, err);
  }

  // One-shot legacy migration. Only runs while the localStorage entry
  // still exists — on success we delete it so this branch becomes a no-op.
  const legacy = readLegacyStampedAddresses(batchId);
  if (legacy && legacy.length > 0) {
    const fresh = legacy.filter(a => !set.has(a));
    if (fresh.length > 0) {
      try {
        await addStampedAddresses(batchId, fresh);
      } catch (err) {
        console.warn(
          'Migration of stamped-address set to IDB failed for',
          batchId,
          err
        );
      }
    }
    for (const a of legacy) set.add(a);
    try {
      localStorage.removeItem(stampedAddrsStorageKey(batchId));
    } catch {
      // ignore
    }
  }

  return set;
}

/**
 * Append a single (batch, addrHex) entry. Cheap enough to call on the
 * upload hot path right after Bee accepts a chunk — one tiny `put` per
 * chunk replaces the previous bulk re-serialization of the entire set.
 */
export async function addStampedAddress(
  batchId: string,
  addrHex: string
): Promise<void> {
  const key = stripHex(batchId).toLowerCase();
  try {
    await withStore(STAMPED_ADDRS_STORE, 'readwrite', store => {
      const record: StampedAddrRecord = { batchId: key, addrHex };
      store.put(record);
    });
  } catch (err) {
    console.warn('Failed to append stamped address to IDB for', batchId, err);
  }
}

/**
 * Buffers chunk-address writes so we issue one IndexedDB transaction per flush
 * instead of one `put` per chunk on the upload hot path.
 */
export class StampedAddrWriteBatcher {
  private readonly buf: string[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly batchId: string,
    private readonly flushEveryMs = 250,
    private readonly flushEveryCount = 256
  ) {}

  add(addrHex: string): void {
    this.buf.push(addrHex);
    if (this.buf.length >= this.flushEveryCount) {
      void this.flush();
    } else {
      this.schedule();
    }
  }

  private schedule(): void {
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.flushEveryMs);
  }

  async flush(): Promise<void> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.buf.length === 0) return;
    const chunk = this.buf.splice(0, this.buf.length);
    await addStampedAddresses(this.batchId, chunk);
  }
}

/**
 * Bulk-append variant: writes all entries in a single transaction. Used by
 * the legacy-migration path and by any future bulk-recovery flow.
 */
export async function addStampedAddresses(
  batchId: string,
  addrHexes: Iterable<string>
): Promise<void> {
  const key = stripHex(batchId).toLowerCase();
  try {
    await withStore(STAMPED_ADDRS_STORE, 'readwrite', store => {
      for (const addrHex of addrHexes) {
        store.put({ batchId: key, addrHex } as StampedAddrRecord);
      }
    });
  } catch (err) {
    console.warn('Failed to bulk-append stamped addresses to IDB for', batchId, err);
  }
}

export async function clearStampedAddresses(batchId: string): Promise<void> {
  const key = stripHex(batchId).toLowerCase();
  try {
    await withStore(STAMPED_ADDRS_STORE, 'readwrite', store => {
      const range = IDBKeyRange.only(key);
      const cursorReq = store.index('byBatch').openCursor(range);
      return new Promise<void>((resolve, reject) => {
        cursorReq.onsuccess = () => {
          const cursor = cursorReq.result;
          if (!cursor) {
            resolve();
            return;
          }
          cursor.delete();
          cursor.continue();
        };
        cursorReq.onerror = () => reject(cursorReq.error);
      });
    });
  } catch {
    // ignore — clearing is best-effort
  }
  // Drop any lingering legacy entry too so it can't resurrect on next load.
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(stampedAddrsStorageKey(batchId));
    }
  } catch {
    // ignore
  }
}

export { chunkAddressHex };

// ─── Usage / utilization stats ────────────────────────────────────────────────

/**
 * Snapshot of how much of a self-custody postage batch has been consumed,
 * derived purely from the local Stamper state.
 *
 * `maxBucketPercent` is the *effective* utilization the user cares about:
 * uploads start failing with `Bucket is full` as soon as ANY bucket hits 100%,
 * regardless of the average. This is the same metric Bee's `/stamps/:id`
 * `utilization` field reports (max bucket count) when fed through
 * `getStampUsage`, so we use it as the headline percentage in the UI.
 *
 * `avgPercent` and `usedBytes` answer the "how much have I actually stored?"
 * question. Bucket distribution is hash-driven, so on a healthy upload
 * `avgPercent` ≈ `maxBucketPercent`; a large gap between the two means the
 * file's chunks clustered into a few buckets and the stamp is effectively
 * full at a much lower byte count than its labelled capacity suggests.
 */
export interface StampUsageStats {
  /** Worst-bucket fill as a fraction of bucket capacity (0–100, capped). */
  maxBucketPercent: number;
  /**
   * Raw slot count in the fullest bucket — same units as Bee `/stamps/:id`
   * `utilization` for gateway-managed batches.
   */
  maxBucketUsed: number;
  /** Sum of all buckets divided by total stamp capacity (0–100). */
  avgPercent: number;
  /** Bytes stored = sum(buckets) × 4096 (each chunk is a 4 KiB slot). */
  usedBytes: number;
  /** Total chunks the stamp can theoretically hold = 2^depth. */
  totalChunks: number;
  /** Bytes the stamp can theoretically hold = 2^depth × 4096. */
  totalBytes: number;
  /**
   * True iff the persisted state's depth disagrees with `expectedDepth`. The
   * UI should treat this state as untrustworthy: the local Stamper was
   * counting slots at one `maxSlot` while Bee was validating against another,
   * so the bucket counters reflect a mix of stamps Bee accepted and stamps
   * Bee silently rejected. Recovery: `clearStamperState` for that batch.
   */
  depthMismatch: boolean;
  /**
   * True iff any bucket count exceeds the effective `maxSlot` for
   * `expectedDepth`. This is a separate signal from `depthMismatch` — it
   * means even at the expected depth, the local state has cnt's past Bee's
   * cap. Same recovery (clear + restart).
   */
  exceedsMaxSlot: boolean;
}

/** Each Swarm chunk occupies a single 4 KiB stamp slot. */
const CHUNK_BYTES = 4096;

/**
 * Compute storage utilization stats from a persisted Stamper state. Pure /
 * synchronous — safe to call from a render path.
 *
 * If `expectedDepth` is provided, the math is run at THAT depth (i.e. the
 * on-chain truth) rather than at the persisted state's own depth — that way
 * a state corrupted by the "selectedDepth defaulted to 22 but the batch is
 * 20" bug shows up as `depthMismatch: true` and the UI can render a real
 * percentage relative to the user's actual stamp size instead of confidently
 * misreporting against the wrong total.
 */
export function computeStampUsage(
  state: PersistedStamperState,
  expectedDepth?: number
): StampUsageStats {
  const { buckets } = state;
  const depth = expectedDepth ?? state.depth;
  const maxSlot = 2 ** (depth - 16);
  const totalChunks = 65536 * maxSlot; // = 2^depth

  let maxBucket = 0;
  let totalUsed = 0;
  for (let i = 0; i < buckets.length; i++) {
    const v = buckets[i];
    if (v > maxBucket) maxBucket = v;
    totalUsed += v;
  }

  const exceedsMaxSlot = maxBucket > maxSlot;
  return {
    // Capped: counters past Bee's maxSlot are meaningless except as a "this
    // state is corrupted" signal — see `exceedsMaxSlot` below.
    maxBucketPercent: Math.min(100, (maxBucket / maxSlot) * 100),
    maxBucketUsed: maxBucket,
    avgPercent: Math.min(100, (totalUsed / totalChunks) * 100),
    usedBytes: totalUsed * CHUNK_BYTES,
    totalChunks,
    totalBytes: totalChunks * CHUNK_BYTES,
    depthMismatch: expectedDepth !== undefined && expectedDepth !== state.depth,
    exceedsMaxSlot,
  };
}

/**
 * Convenience: load the persisted state for `batchId` and compute usage in
 * one call. Returns `null` if there is no local stamper state for this batch
 * (e.g. the batch was created on another device and SOC restore hasn't run
 * yet — the UI should render a "usage unknown" placeholder in that case).
 */
export async function loadStampUsage(
  batchId: string,
  expectedDepth?: number
): Promise<StampUsageStats | null> {
  const state = await loadStamperState(batchId);
  if (!state) return null;
  return computeStampUsage(state, expectedDepth);
}

/** Columns in the stamp-card heat strip (65536 / COLS buckets per cell). */
export const BUCKET_HEAT_STRIP_COLS = 96;

/**
 * Histogram + heat-strip inputs for the stamp list “bucket stats” panel.
 * All ratios use the batch's on-chain depth (`expectedDepth`), matching
 * {@link computeStampUsage}.
 */
export interface BucketStatsVisualization {
  maxSlot: number;
  emptyBuckets: number;
  /** Buckets with cnt ≥ maxSlot (full — uploads fail if any bucket hits this). */
  fullBuckets: number;
  /**
   * Ten bins for buckets with 0 < cnt < maxSlot — index `i` holds buckets
   * whose fill is in ((i×10)%, ((i+1)×10)%] of per-bucket capacity.
   */
  partialBins: number[];
  /**
   * Exact count of buckets per used-slot count (`[n]` = buckets holding exactly
   * `n` chunks, `n` = 1 … maxSlot-1), only when `maxSlot` ≤ 16. With so few
   * slots, percentage bins are misleading (fill moves in steps of 100/maxSlot %,
   * so e.g. “1–10%” can never occur at 8 slots). `null` for larger capacities.
   */
  slotHistogram: number[] | null;
  /** Mean utilization % (0–100) per {@link BUCKET_HEAT_STRIP_COLS} segment of bucket index space. */
  heatStrip: number[];
}

/**
 * Derive a compact visualization of how stamp slots are spread across the
 * 65 536 Swarm buckets — pure sync, safe to call after `loadStamperState`.
 */
export function computeBucketStatsVisualization(
  state: PersistedStamperState,
  expectedDepth: number
): BucketStatsVisualization {
  const { buckets } = state;
  const maxSlot = 2 ** (expectedDepth - 16);
  const partialBins = new Array(10).fill(0);
  const slotHistogram = maxSlot <= 16 ? new Array<number>(maxSlot).fill(0) : null;
  let emptyBuckets = 0;
  let fullBuckets = 0;

  for (let i = 0; i < buckets.length; i++) {
    const cnt = buckets[i];
    if (cnt === 0) {
      emptyBuckets++;
      continue;
    }
    if (cnt >= maxSlot) {
      fullBuckets++;
      continue;
    }
    // Bins are (10i, 10(i+1)]%: 50% of capacity belongs in “41–50%”.
    // `cnt * 10 / maxSlot` is exact because maxSlot is a power of two.
    const bin = Math.min(9, Math.max(0, Math.ceil((cnt * 10) / maxSlot) - 1));
    partialBins[bin]++;
    if (slotHistogram) slotHistogram[cnt]++;
  }

  const cols = BUCKET_HEAT_STRIP_COLS;
  const heatStrip = new Array<number>(cols);
  const span = buckets.length / cols;
  for (let c = 0; c < cols; c++) {
    const start = Math.floor(c * span);
    const end = Math.floor((c + 1) * span);
    let sum = 0;
    let n = 0;
    for (let j = start; j < end && j < buckets.length; j++) {
      sum += buckets[j];
      n++;
    }
    const avg = n > 0 ? sum / n : 0;
    heatStrip[c] = Math.min(100, (avg / maxSlot) * 100);
  }

  return {
    maxSlot,
    emptyBuckets,
    fullBuckets,
    partialBins,
    slotHistogram,
    heatStrip,
  };
}

// ─── Internals ────────────────────────────────────────────────────────────────

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
