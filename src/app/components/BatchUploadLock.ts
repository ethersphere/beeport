/**
 * Per-batch upload lock.
 *
 * Slot allocation is sequential per bucket, so two uploads to the same batch
 * that start from the same counters hand out the SAME (bucket, cnt) slots and
 * Bee evicts one of the chunks. That holds across tabs too. Each upload holds
 * a per-batch Web Lock (cross-tab) from state resolution until its issuer-state
 * SOC save has finished (that save also allocates slots). A second upload to
 * the same batch fails fast with a clear message instead of corrupting data.
 */

const BATCH_BUSY_MESSAGE =
  'Another upload to this storage is still running (in this tab or another ' +
  'Beeport tab). Wait for it to finish, then try again.';

const inTabBatchLocks = new Set<string>();

/** Acquire the per-batch upload lock. Returns an idempotent release function. */
export async function acquireBatchUploadLock(batchId: string): Promise<() => void> {
  if (!batchId) throw new Error('No batchId provided');
  const id = stripHex(batchId).toLowerCase();
  const locks =
    typeof navigator !== 'undefined'
      ? (navigator as Navigator & { locks?: LockManager }).locks
      : undefined;

  if (locks?.request) {
    return new Promise<() => void>((resolve, reject) => {
      locks
        .request(`beeport.upload.${id}`, { ifAvailable: true }, lock => {
          if (!lock) {
            reject(new Error(BATCH_BUSY_MESSAGE));
            return undefined;
          }
          // Hold the lock until the caller releases it.
          return new Promise<void>(release => {
            let released = false;
            resolve(() => {
              if (released) return;
              released = true;
              release();
            });
          });
        })
        .catch(reject);
    });
  }

  // No Web Locks API: guard this tab only.
  if (inTabBatchLocks.has(id)) throw new Error(BATCH_BUSY_MESSAGE);
  inTabBatchLocks.add(id);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    inTabBatchLocks.delete(id);
  };
}


function stripHex(value: string): string {
  return value.startsWith('0x') || value.startsWith('0X') ? value.slice(2) : value;
}
