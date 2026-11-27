/**
 * Sync this browser's stamper state for one storage with the newest
 * issuer-state backup on Swarm.
 *
 * Uploads already do this before they stamp (see
 * `resolveStamperStateForUpload` in ClientSideUpload.ts). This module lets the
 * storage list do the same on its own, so "Used" figures and the next upload
 * start from what other browsers saved, without an upload first.
 *
 * Safety: counters are only ever raised. Local and backup counters are merged
 * by element-wise max (see `mergeStamperStates`), which keeps every slot that
 * either side used. The network reads run without a lock; the local
 * read-merge-write runs under the per-batch upload lock, so it can never
 * interleave with an upload of the same storage in this or another tab. If an
 * upload holds the lock, the storage is skipped: that upload syncs itself.
 */
import { Bee } from '@ethersphere/bee-js';
import { tryAcquireBatchLock } from './BatchUploadLock';
import { createPresignedStamper } from './FastPresignedStamp';
import { waitForGatewayBatchSync } from './GatewayChainSync';
import { isBatchCreatedInThisBrowser } from './SelfCustodyBatch';
import {
  getLastSyncedSocIndex,
  loadStamperState,
  mergeStamperStates,
  saveStamperState,
  setLastSyncedSocIndex,
  type DerivedHotKey,
} from './ClientStamping';
import {
  loadIssuerStateFromSOC,
  peekLatestIssuerStateIndex,
  saveIssuerStateToSOC,
} from './IssuerStateSOC';

export type IssuerStateSyncOutcome =
  /** This browser had no state; it now has the backup's counters. */
  | 'restored'
  /** The backup was newer; its counters were merged into the local ones. */
  | 'merged'
  /** Local state already includes the newest backup. */
  | 'up-to-date'
  /** No backup existed; this browser wrote the first one from its counters. */
  | 'seeded'
  /** No backup exists on Swarm for this storage yet. */
  | 'no-backup'
  /** An upload to this storage is running; it syncs on its own. */
  | 'busy'
  /** The backup could not be read or decrypted. */
  | 'failed';

export interface IssuerStateSyncResult {
  batchId: string;
  outcome: IssuerStateSyncOutcome;
  /** Newest backup index on Swarm, when known. */
  index?: number;
  error?: string;
}

function stripHex(value: string): string {
  return value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
}

/** Sync one storage. Never throws: failures come back as `outcome: 'failed'`. */
export async function syncIssuerStateFromSwarm(args: {
  bee: Bee;
  hotKey: DerivedHotKey;
  batchId: string;
  /** On-chain depth. Needed to write a first backup when none exists. */
  depth?: number;
}): Promise<IssuerStateSyncResult> {
  const { bee, hotKey, depth } = args;
  const batchId = stripHex(args.batchId).toLowerCase();
  try {
    const knownIndex = getLastSyncedSocIndex(batchId);
    const hasLocal = !!(await loadStamperState(batchId));
    const latest = await peekLatestIssuerStateIndex({
      bee,
      hotKey,
      batchId,
      // Only trust the marker when the local state it describes exists.
      hintIndex: hasLocal ? knownIndex : null,
    });
    if (latest < 0) {
      // No backup yet. This browser can write the first one when it knows the
      // counters: it has local state, or it bought the storage (then the
      // counters are its own, starting from zero). A browser with neither
      // knows nothing and must not write one.
      const canSeed =
        (hasLocal || isBatchCreatedInThisBrowser(batchId)) && !purchaseSeedsRunning.has(batchId);
      if (!canSeed || depth === undefined) return { batchId, outcome: 'no-backup' };
      const seeded = await seedIssuerStateBackup({ bee, hotKey, batchId, depth });
      if (seeded === 'busy') return { batchId, outcome: 'busy' };
      return { batchId, outcome: seeded === 'seeded' ? 'seeded' : 'up-to-date' };
    }
    if (hasLocal && knownIndex !== null && knownIndex >= latest) {
      return { batchId, outcome: 'up-to-date', index: latest };
    }

    const remote = await loadIssuerStateFromSOC({ bee, hotKey, batchId, index: latest });
    if (!remote) {
      return { batchId, outcome: 'failed', index: latest, error: 'backup not found' };
    }

    const release = await tryAcquireBatchLock(batchId);
    if (!release) return { batchId, outcome: 'busy', index: latest };
    try {
      // Read local again under the lock: an upload may have finished since.
      const local = await loadStamperState(batchId);
      await saveStamperState(batchId, local ? mergeStamperStates(local, remote.state) : remote.state);
      const marker = getLastSyncedSocIndex(batchId);
      if (marker === null || marker < remote.index) setLastSyncedSocIndex(batchId, remote.index);
      return { batchId, outcome: local ? 'merged' : 'restored', index: remote.index };
    } finally {
      release();
    }
  } catch (err) {
    return {
      batchId,
      outcome: 'failed',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

/** Sync several storages, a few at a time. Results keep the input order. */
export async function syncIssuerStatesFromSwarm(args: {
  bee: Bee;
  hotKey: DerivedHotKey;
  storages: { batchId: string; depth?: number }[];
  concurrency?: number;
}): Promise<IssuerStateSyncResult[]> {
  const { bee, hotKey, storages, concurrency = 3 } = args;
  const results: IssuerStateSyncResult[] = new Array(storages.length);
  let next = 0;
  const worker = async () => {
    while (next < storages.length) {
      const i = next++;
      results[i] = await syncIssuerStateFromSwarm({ bee, hotKey, ...storages[i] });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, storages.length) }, worker));
  return results;
}

/**
 * Write the first issuer-state backup for a storage that has none, from this
 * browser's counters (all zero for a storage that was never used). Without
 * it, another browser cannot tell "never used" from "used, backup lost" and
 * refuses to upload. Runs under the per-batch lock; `'busy'` when an upload
 * holds it (that upload saves a backup itself), `'exists'` when a backup is
 * already there. Throws when the save fails (for example the gateway does not
 * know the new storage yet); the slots a failed save used are kept.
 */
export async function seedIssuerStateBackup(args: {
  bee: Bee;
  hotKey: DerivedHotKey;
  batchId: string;
  depth: number;
}): Promise<'seeded' | 'exists' | 'busy'> {
  const { bee, hotKey, depth } = args;
  const batchId = stripHex(args.batchId).toLowerCase();
  const release = await tryAcquireBatchLock(batchId);
  if (!release) return 'busy';
  try {
    if ((await peekLatestIssuerStateIndex({ bee, hotKey, batchId })) >= 0) return 'exists';
    const local = await loadStamperState(batchId);
    const stamper = createPresignedStamper(batchId, local?.depth ?? depth, local?.buckets);
    let index: number | undefined;
    try {
      index = (await saveIssuerStateToSOC({ bee, hotKey, batchId, stamper, index: 0 })).index;
    } finally {
      // The save used slots (blob chunks and the backup chunk), even when it
      // failed half-way. Keep them before anything else.
      await saveStamperState(batchId, { buckets: stamper.getState(), depth: stamper.depth });
    }
    setLastSyncedSocIndex(batchId, index);
    return 'seeded';
  } finally {
    release();
  }
}

/** Storages whose first backup {@link seedBackupAfterPurchase} is still writing. */
const purchaseSeedsRunning = new Set<string>();

/** Waits between attempts of the first backup after a purchase. */
const PURCHASE_SEED_RETRY_DELAYS_MS = [10_000, 20_000, 30_000, 60_000];

/**
 * After a purchase: wait until the gateway knows the new storage, then write
 * its first backup. Runs in the background and never throws. If every
 * attempt fails, the storage list sync writes it later from this browser.
 */
export async function seedBackupAfterPurchase(args: {
  beeApiUrl: string;
  hotKey: DerivedHotKey;
  batchId: string;
  depth: number;
  /** Block at or after the purchase, when known. */
  createdAtBlock?: bigint;
}): Promise<void> {
  const { beeApiUrl, hotKey, batchId, depth, createdAtBlock } = args;
  const id = stripHex(batchId).toLowerCase();
  const label = id.slice(0, 10);
  purchaseSeedsRunning.add(id);
  try {
    if (createdAtBlock !== undefined) {
      await waitForGatewayBatchSync(beeApiUrl, createdAtBlock).catch(() => undefined);
    }
    const bee = new Bee(beeApiUrl);
    for (let attempt = 0; ; attempt++) {
      try {
        const result = await seedIssuerStateBackup({ bee, hotKey, batchId: id, depth });
        console.info(`[IssuerStateSync] first backup for ${label}…: ${result}`);
        return;
      } catch (err) {
        if (attempt >= PURCHASE_SEED_RETRY_DELAYS_MS.length) {
          console.warn(
            `[IssuerStateSync] first backup for ${label}… failed; the next sync retries:`,
            err
          );
          return;
        }
        await new Promise(r => setTimeout(r, PURCHASE_SEED_RETRY_DELAYS_MS[attempt]));
      }
    }
  } finally {
    purchaseSeedsRunning.delete(id);
  }
}

/** One short line for the storage list status, e.g. "1 updated, 2 up to date". */
export function summarizeSyncResults(results: IssuerStateSyncResult[]): string {
  const count = (o: IssuerStateSyncOutcome) => results.filter(r => r.outcome === o).length;
  const parts: string[] = [];
  const restored = count('restored');
  const merged = count('merged');
  const upToDate = count('up-to-date');
  const seeded = count('seeded');
  const noBackup = count('no-backup');
  const busy = count('busy');
  const failed = count('failed');
  if (restored) parts.push(`${restored} restored`);
  if (merged) parts.push(`${merged} updated`);
  if (seeded) parts.push(`${seeded} saved to Swarm for the first time`);
  if (upToDate) parts.push(`${upToDate} up to date`);
  if (noBackup) parts.push(`${noBackup} with no saved state yet`);
  if (busy) parts.push(`${busy} skipped (upload running)`);
  if (failed) parts.push(`${failed} could not be read`);
  return parts.join(', ');
}
