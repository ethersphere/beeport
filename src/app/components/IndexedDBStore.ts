/**
 * Tiny zero-dependency IndexedDB wrapper used as the persistence backend for
 * per-batch Stamper state and per-batch chunk-address dedup sets.
 *
 * Why IndexedDB and not localStorage:
 *   - localStorage's per-origin quota (~5 MB on most browsers) is blown by a
 *     single large batch's stamped-address set: 32 k chunks × ~67 chars JSON
 *     ≈ 2 MB, doubled by the JSON re-serialization on every flush. A second
 *     batch tips us over and `setItem` starts throwing `QuotaExceededError`.
 *   - localStorage is sync and string-only. We were paying a JSON.stringify
 *     of the whole chunk-address set on every debounced flush — expensive
 *     and wholly avoidable when 99.9 % of writes are appending one new entry.
 *   - IndexedDB stores typed arrays via structured clone (no JSON round-trip)
 *     and gives us per-record `put` so the dedup set can be appended one
 *     entry at a time on the upload hot path.
 *
 * The API surface is intentionally minimal — just enough to back
 * `ClientStamping.ts`. We don't ship a generic "use IDB anywhere" helper
 * because there are no other callers yet.
 */

const DB_NAME = 'beeport';
const DB_VERSION = 1;

/** ObjectStore that holds one record per batch with the bucket counters. */
export const STAMPER_STATE_STORE = 'stamperState';
/**
 * ObjectStore that holds one record per (batchId, chunkAddrHex). Composite
 * key + `byBatch` index lets us load the full set for a batch with a single
 * cursor scan and append a new address with a single tiny `put`.
 */
export const STAMPED_ADDRS_STORE = 'stampedAddrs';

let dbPromise: Promise<IDBDatabase> | null = null;

/**
 * Open (or upgrade) the Beeport IDB database. Memoised: callers get the same
 * `IDBDatabase` instance for the lifetime of the tab. The connection is left
 * open for the tab's lifetime — IDB allows concurrent transactions on the
 * same connection so this is the recommended pattern.
 *
 * Returns `null` when IndexedDB is unavailable (SSR, or some private-mode
 * browsers). Callers must treat `null` as "persistence disabled" — the same
 * graceful-degradation contract the previous localStorage code had.
 */
export function openBeeportDB(): Promise<IDBDatabase> | null {
  if (typeof indexedDB === 'undefined') return null;
  if (dbPromise) return dbPromise;

  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STAMPER_STATE_STORE)) {
        db.createObjectStore(STAMPER_STATE_STORE, { keyPath: 'batchId' });
      }
      if (!db.objectStoreNames.contains(STAMPED_ADDRS_STORE)) {
        const store = db.createObjectStore(STAMPED_ADDRS_STORE, {
          keyPath: ['batchId', 'addrHex'],
        });
        store.createIndex('byBatch', 'batchId', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open beeport IDB'));
    req.onblocked = () => {
      // Another tab holds an older-version connection. We don't force-close
      // here — the version is small and stable; if this ever fires in the
      // wild we should bump DB_VERSION + handle the upgrade collaboratively.
      console.warn('[IndexedDBStore] open blocked by another tab — close other Beeport tabs to upgrade');
    };
  });

  // Reset the memo on connection close (tab eviction, etc.) so the next call
  // re-opens cleanly instead of returning a dead handle.
  dbPromise
    .then(db => {
      db.onclose = () => {
        if (dbPromise && (db as unknown as { __closed?: boolean }).__closed !== true) {
          dbPromise = null;
        }
      };
    })
    .catch(() => {
      dbPromise = null;
    });

  return dbPromise;
}

/**
 * Run a single transaction and resolve with its `oncomplete`. Wraps the
 * boilerplate of `transaction()` + `objectStore()` + promisified completion.
 *
 * Returning `null` means "IDB unavailable, treat as no-op" — same contract
 * as the previous `try { localStorage.setItem(…) } catch {}` blocks.
 */
export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => T | Promise<T>
): Promise<T | null> {
  const dbP = openBeeportDB();
  if (!dbP) return null;
  let db: IDBDatabase;
  try {
    db = await dbP;
  } catch (err) {
    console.warn('[IndexedDBStore] DB open failed, falling back to no-op:', err);
    return null;
  }
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result: T | undefined;
    Promise.resolve(fn(store))
      .then(value => {
        result = value;
      })
      .catch(err => {
        try {
          tx.abort();
        } catch {
          // already aborted
        }
        reject(err);
      });
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error ?? new Error(`IDB tx failed on ${storeName}`));
    tx.onabort = () => reject(tx.error ?? new Error(`IDB tx aborted on ${storeName}`));
  });
}

/**
 * Promisify an `IDBRequest`. IDB requests don't have `.then()` — they're
 * event-emitter style. This is the canonical adapter.
 */
export function awaitRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IDB request failed'));
  });
}
