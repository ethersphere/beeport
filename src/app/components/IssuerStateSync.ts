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
import type { Bee } from '@ethersphere/bee-js';
import { tryAcquireBatchLock } from './BatchUploadLock';
import {
  getLastSyncedSocIndex,
  loadStamperState,
  mergeStamperStates,
  saveStamperState,
  setLastSyncedSocIndex,
  type DerivedHotKey,
} from './ClientStamping';
import { loadIssuerStateFromSOC, peekLatestIssuerStateIndex } from './IssuerStateSOC';

export type IssuerStateSyncOutcome =
  /** This browser had no state; it now has the backup's counters. */
  | 'restored'
  /** The backup was newer; its counters were merged into the local ones. */
  | 'merged'
  /** Local state already includes the newest backup. */
  | 'up-to-date'
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
}): Promise<IssuerStateSyncResult> {
  const { bee, hotKey } = args;
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
    if (latest < 0) return { batchId, outcome: 'no-backup' };
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
  batchIds: string[];
  concurrency?: number;
}): Promise<IssuerStateSyncResult[]> {
  const { bee, hotKey, batchIds, concurrency = 3 } = args;
  const results: IssuerStateSyncResult[] = new Array(batchIds.length);
  let next = 0;
  const worker = async () => {
    while (next < batchIds.length) {
      const i = next++;
      results[i] = await syncIssuerStateFromSwarm({ bee, hotKey, batchId: batchIds[i] });
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, batchIds.length) }, worker));
  return results;
}

/** One short line for the storage list status, e.g. "1 updated, 2 up to date". */
export function summarizeSyncResults(results: IssuerStateSyncResult[]): string {
  const count = (o: IssuerStateSyncOutcome) => results.filter(r => r.outcome === o).length;
  const parts: string[] = [];
  const restored = count('restored');
  const merged = count('merged');
  const upToDate = count('up-to-date');
  const noBackup = count('no-backup');
  const busy = count('busy');
  const failed = count('failed');
  if (restored) parts.push(`${restored} restored`);
  if (merged) parts.push(`${merged} updated`);
  if (upToDate) parts.push(`${upToDate} up to date`);
  if (noBackup) parts.push(`${noBackup} with no saved state yet`);
  if (busy) parts.push(`${busy} skipped (upload running)`);
  if (failed) parts.push(`${failed} could not be read`);
  return parts.join(', ');
}
