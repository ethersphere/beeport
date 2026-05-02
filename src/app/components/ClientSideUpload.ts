/**
 * Client-side file upload for Beeport (SWIP self-custody, mode α).
 *
 * Flow per chunk:
 *   1. file is sliced into 4 KB pieces and fed into a streaming BMT MerkleTree
 *   2. for every emitted Chunk we locally allocate (bucket, index, timestamp),
 *      sign the digest with the user's hot key, and assemble the 113-byte stamp
 *   3. we POST the chunk to a key-less Bee gateway with `Swarm-Postage-Stamp`
 *   4. once the file is fully stamped we build a Mantaray manifest entirely
 *      client-side and stamp/upload its chunks the same way
 *
 * The Bee gateway never sees the hot key and cannot mint stamps for us.
 * Issuer state (the 65 536-entry bucket counter) is persisted to localStorage
 * on a debounce ({@link STATE_PERSIST_MIN_INTERVAL_MS}) plus a forced flush
 * at end-of-file, end-of-manifest and end-of-SOC so retries don't burn slots
 * and a tab reload after a crash resumes from a recent state.
 *
 * Concurrency is intentionally bounded — at very high parallelism public
 * gateways start dropping chunks. The default below targets a modern HTTP/2
 * gateway (e.g. beeport.xyz); for self-hosted Bee on plain HTTP/1.1 the caller
 * should drop it to 8 via the `concurrency` param.
 */

import {
  Bee,
  MantarayNode,
  MerkleTree,
  Stamper,
  type EnvelopeWithBatchId,
  type PrivateKey,
  Reference,
} from '@ethersphere/bee-js';
import { AsyncQueue, type Chunk } from 'cafe-utility';

import { loadStamperState, saveStamperState, type DerivedHotKey } from './ClientStamping';
import { saveIssuerStateToSOC } from './IssuerStateSOC';

/**
 * Maximum number of concurrent in-flight POST /chunks requests.
 *
 * Each chunk is a tiny (~4 KB) request. On HTTP/2 gateways they multiplex
 * over one TCP connection, but browsers cap HTTP/1.1 at ~6 connections per
 * host and some gateways throttle aggressively past that — pushing the
 * default too high turns into "all requests stuck pending" which the user
 * sees as a frozen progress bar. 12 is a conservative middle ground (~1.5×
 * the original 8) that hasn't reproduced any stalls in practice. Bump via
 * the `concurrency` param if your gateway tolerates more.
 */
// SPEED TEST: bumped 12 -> 64 to see what beeport.xyz can take. Revert via
// `git checkout -- src/app/components/ClientSideUpload.ts`.
const DEFAULT_CONCURRENCY = 64;

/**
 * Minimum delay between two `saveStamperState` writes during an upload.
 *
 * Persisting the 65 536-entry buckets array stringifies ~256 KB of JSON and
 * synchronously writes it to localStorage; doing that every N chunks stalls
 * the queue. A time bound (vs. count bound) keeps the worst-case stall the
 * same regardless of upload speed and naturally throttles itself when chunks
 * fly through quickly. Final flush still happens unconditionally at end-of-
 * file and end-of-manifest.
 */
const STATE_PERSIST_MIN_INTERVAL_MS = 2_000;

/**
 * File-read slab size. The MerkleTree splits anything we feed it into 4 KB
 * chunks internally, so reading large slabs (instead of one 4 KB FileReader
 * round-trip per chunk) eliminates ~99% of the event-loop hops for big files.
 * 1 MB is a sweet spot: small enough that we don't hold the whole file in
 * memory for huge uploads, large enough that the per-slab overhead is
 * negligible.
 */
const FILE_READ_SLAB_BYTES = 1 << 20; // 1 MiB

/**
 * Files at or below this size are read in a single `arrayBuffer()` call. The
 * 2.3 MB photo-uploads typical of self-custody fall here; we trade a little
 * peak memory for the simplest, fastest pipeline.
 */
const SINGLE_SHOT_READ_THRESHOLD_BYTES = 64 * 1024 * 1024; // 64 MiB

/** Per-chunk upload retries on transient errors. */
const MAX_CHUNK_RETRIES = 3;

/** Backoff between chunk retries (ms). */
const CHUNK_RETRY_BASE_MS = 500;

/**
 * Per-chunk HTTP timeout. Was 60 s, which is far too forgiving — a stuck
 * connection ate a full minute before retrying, and 32 stuck connections
 * looked like a frozen upload bar. 15 s is enough for any healthy gateway
 * round-trip while letting us recycle dead sockets quickly.
 */
const CHUNK_HTTP_TIMEOUT_MS = 15_000;

/**
 * Adaptive-concurrency target when an HTTP/2 gateway is detected. HTTP/2
 * multiplexes all requests over a single TCP connection so the browser's
 * 6-conn-per-host cap doesn't apply; pushing concurrency wide gives a
 * meaningful throughput boost on beeport.xyz and similar setups.
 */
// SPEED TEST: bumped 32 -> 128. The H2 spec allows 100 concurrent streams
// per connection by default; some gateways advertise more. We'll find out.
const HTTP2_TARGET_CONCURRENCY = 128;

/**
 * Refuse to start an upload if the projected post-upload bucket utilization
 * would exceed this fraction. Bucket distribution is hash-driven so a 95%
 * average reliably means *some* bucket overflows mid-upload (with a hard
 * "Bucket is full" thrown by Stamper) — better to refuse up-front than to
 * burn slots and fail at chunk N.
 */
const STAMP_HARD_FAIL_UTILIZATION = 0.95;

/**
 * Log a console warning when projected utilization crosses this fraction.
 * Useful diagnostic without being annoying — most users will never see it.
 */
const STAMP_WARN_UTILIZATION = 0.8;

export interface ClientSideUploadParams {
  file: File;
  /** 32-byte hex (with or without 0x) batch id, on-chain owner = hot key. */
  batchId: string;
  /** Hot key derived via `deriveHotKey()` in ClientStamping.ts. */
  hotKey: DerivedHotKey;
  /** Postage batch depth used to create the batch on-chain. */
  depth: number;
  /** Bee gateway HTTP base URL (e.g. https://beeport.xyz). */
  beeApiUrl: string;
  /** Whether to mark this upload as a website (sets index/error doc). */
  isWebsite?: boolean;
  /** Optional progress callback: (chunksProcessed, totalChunksApprox). */
  onProgress?: (processed: number, total: number) => void;
  /** Optional status string callback for the UI. */
  onStatus?: (message: string) => void;
  /** Optional concurrency override. */
  concurrency?: number;
  /** Optional abort signal. */
  abortSignal?: AbortSignal;
}

export interface IssuerStateSocResult {
  socAddress: `0x${string}`;
  blobReference: `0x${string}`;
  savedAt: number;
  slotsConsumed: number;
  /** Number of distinct buckets touched by the save (= delta entry count). */
  deltaEntries: number;
}

export interface ClientSideUploadResult {
  /** 0x-prefixed hex of the manifest (root) reference. */
  reference: `0x${string}`;
  /** Number of leaf chunks produced by BMT chunking the file. */
  fileChunkCount: number;
  /** Number of chunks produced by BMT chunking the manifest. */
  manifestChunkCount: number;
  /** Total wall-clock time from start of upload to manifest reference. ms. */
  elapsedMs: number;
  /** Average chunks/second over the whole upload (file + manifest). */
  averageChunksPerSecond: number;
  /** Total HTTP retries across all chunks. 0 means no chunk needed retrying. */
  retryCount: number;
  /**
   * HTTP version negotiated with the gateway, e.g. `'h2'`, `'http/1.1'`.
   * Sourced from Resource Timing API; may be undefined on browsers that
   * don't expose `nextHopProtocol` or for cross-origin requests with
   * `Timing-Allow-Origin` not set.
   */
  detectedHttpProtocol?: string;
  /** Concurrency the upload settled at after any adaptive ramp-up. */
  effectiveConcurrency: number;
  /**
   * Promise that resolves with the SOC-save metadata once the issuer-state
   * backup completes (or with `undefined` if it failed / was skipped).
   *
   * The caller MUST NOT block its UI on this — the file is already on Swarm
   * by the time the outer `uploadFileClientSide` promise resolves. The SOC
   * write is a best-effort cross-device recovery mechanism that runs in the
   * background. SOC failures are logged via `console.warn` and surfaced
   * through this promise resolving to `undefined`, never as a throw.
   */
  issuerStateSocPromise: Promise<IssuerStateSocResult | undefined>;
}

/**
 * Pre-flight result from {@link checkProjectedStampCapacity}.
 *
 * `'ok'`   → safe to upload
 * `'warn'` → caller should surface a soft warning UI but may proceed
 * `'fail'` → caller MUST refuse the upload; `uploadFileClientSide` will
 *            throw with the same message if called anyway
 */
export interface ProjectedStampCapacity {
  level: 'ok' | 'warn' | 'fail';
  /** Current bucket utilization as a percentage (0–100). */
  utilizationPercent: number;
  /**
   * Projected bucket utilization AFTER this upload, as a percentage.
   * Best-effort — bucket distribution is hash-driven, so a particular file
   * may hit "Bucket is full" earlier than this average suggests.
   */
  projectedUtilizationPercent: number;
  /** Human-readable summary, present for `'warn'` and `'fail'`. */
  message?: string;
}

/**
 * Upload a file to Swarm with client-side stamping.
 *
 * Caller is responsible for:
 *   - having created the postage batch with `_owner = hotKey.address` on-chain
 *   - making sure the Bee gateway's chain listener has indexed past the
 *     `createBatch` block (use `waitForGatewayBatchSync` from
 *     `./GatewayChainSync.ts` when freshness is in doubt; for older batches
 *     the gateway has long since synced and no wait is needed).
 *
 * This function does NOT poll the gateway for batch readiness — it assumes
 * the caller already serialised on that. Note: the legacy `/stamps/<id>`
 * `usable` boolean does NOT apply to self-custody batches; that endpoint
 * 404s for batches the gateway didn't issue.
 */
export async function uploadFileClientSide(
  params: ClientSideUploadParams
): Promise<ClientSideUploadResult> {
  const {
    file,
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    isWebsite,
    onProgress,
    onStatus,
    concurrency = DEFAULT_CONCURRENCY,
    abortSignal,
  } = params;

  if (!file) throw new Error('No file provided');
  if (!batchId) throw new Error('No batchId provided');
  if (!hotKey?.signer) throw new Error('No hot key provided');
  if (depth < 17) throw new Error(`Postage batch depth ${depth} is too small`);

  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batch id: ${batchId}`);
  }

  const bee = new Bee(beeApiUrl);
  const signer: PrivateKey = hotKey.signer;

  // ── Stamper: load persisted issuer state or start fresh ────────────────────
  // Bee will reject (bucket conflict) if we re-use a (bucket,cnt) pair, so the
  // counters MUST persist across browser sessions for the same batchId.
  const persisted = loadStamperState(cleanBatchId);
  const stamper = persisted
    ? Stamper.fromState(signer, cleanBatchId, persisted.buckets, persisted.depth)
    : Stamper.fromBlank(signer, cleanBatchId, depth);

  if (persisted && persisted.depth !== depth) {
    console.warn(
      `Stamper state depth mismatch (${persisted.depth} vs ${depth}); using persisted state`
    );
  }

  // ── Pre-flight: refuse if projected utilization would exceed the cap ──────
  // Cheap synchronous check on the local stamper state; doesn't need the
  // gateway. Avoids burning slots on an upload that's mathematically
  // guaranteed to hit "Bucket is full".
  const capacity = checkProjectedStampCapacity(stamper, file.size);
  if (capacity.level === 'fail') {
    throw new Error(capacity.message ?? 'Stamp would be over-capacity for this upload');
  }
  if (capacity.level === 'warn') {
    console.warn(`[ClientSideUpload] ${capacity.message}`);
  }

  // ── Diagnostics ──────────────────────────────────────────────────────────
  const startedAt = performance.now();
  let chunksUploaded = 0;
  let retryCount = 0;
  let detectedHttpProtocol: string | undefined;
  const totalChunksApprox = approxChunkCount(file.size);

  // ── Timing / speed-test instrumentation (TEMP — easy revert) ─────────────
  // Logs phase markers + a periodic in-flight sampler so we can A/B different
  // concurrency / chunking parameters and read the impact directly off the
  // browser console. Prefix is grep-friendly: `⏱`.
  const fileSizeStr =
    file.size >= 1024 * 1024
      ? `${(file.size / 1024 / 1024).toFixed(2)} MB`
      : `${(file.size / 1024).toFixed(1)} KB`;
  const mark = (label: string, extra?: Record<string, unknown>) => {
    const t = performance.now() - startedAt;
    const extras = extra
      ? ' ' +
        Object.entries(extra)
          .map(([k, v]) => `${k}=${v}`)
          .join(' ')
      : '';
    console.log(`⏱ [ClientSideUpload] +${t.toFixed(0).padStart(5)}ms · ${label}${extras}`);
  };
  mark('start', {
    file: file.name,
    size: fileSizeStr,
    chunksApprox: totalChunksApprox,
    concurrency,
  });

  // First-chunk latency is the single most useful number for A/B'ing the
  // gateway: it captures TLS handshake + connection setup + first request
  // RTT. After this the queue is steady-state.
  let firstChunkMarked = false;

  // ── Per-chunk upload pipeline ──────────────────────────────────────────────
  // Buffer capacity > concurrency so the BMT producer can stay ahead of the
  // network. Without this the FileReader/append loop would block on every
  // enqueue once `concurrency` requests are in flight, defeating the point
  // of the time-overlap between BMT/sign and HTTP I/O.
  const queue = new AsyncQueue(concurrency, concurrency * 2);

  // Rolling-window throughput sampler (part of TEMP timing instrumentation).
  // Runs every 1s while leaves are uploading; tells us instantaneous
  // chunks/s + how full the queue is so we can see whether we're
  // network-bound, BMT-bound, or queue-starved at any given moment.
  let lastSampleAt = startedAt;
  let lastSampleChunks = 0;
  const sampler = setInterval(() => {
    const now = performance.now();
    const deltaMs = now - lastSampleAt;
    const deltaChunks = chunksUploaded - lastSampleChunks;
    const instCps = deltaMs > 0 ? (deltaChunks * 1000) / deltaMs : 0;
    const totalElapsed = now - startedAt;
    const avgCps = totalElapsed > 0 ? (chunksUploaded * 1000) / totalElapsed : 0;
    console.log(
      `⏱ [ClientSideUpload] +${totalElapsed.toFixed(0).padStart(5)}ms · in-flight ` +
        `${chunksUploaded}/${totalChunksApprox} ` +
        `(inst=${instCps.toFixed(0)}c/s avg=${avgCps.toFixed(0)}c/s ` +
        `running=${queue.running} queued=${queue.queue.length} conc=${queue.concurrency})`
    );
    lastSampleAt = now;
    lastSampleChunks = chunksUploaded;
  }, 1000);
  const stopSampler = () => clearInterval(sampler);

  // Adaptive concurrency: after the first chunk completes, peek at the
  // Resource Timing entry to see whether the gateway negotiated HTTP/2.
  // If it did, ramp the queue's concurrency up to {@link HTTP2_TARGET_CONCURRENCY}
  // — HTTP/2 multiplexes over one TCP connection, so the browser's
  // 6-conn-per-host HTTP/1.1 cap doesn't apply and going wide is essentially
  // free. cafe-utility's AsyncQueue reads `concurrency` and `capacity` on
  // every `process()` call so mutating them mid-flight Just Works.
  let protocolDetectionDone = false;
  const detectAndMaybeRampConcurrency = () => {
    if (protocolDetectionDone) return;
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return;
    const recent = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    // Walk from the end — our latest /chunks request will be near the tail.
    // Cap the scan at 50 entries to keep this O(constant).
    const start = Math.max(0, recent.length - 50);
    for (let i = recent.length - 1; i >= start; i--) {
      const entry = recent[i];
      if (!entry.name.includes('/chunks')) continue;
      protocolDetectionDone = true;
      detectedHttpProtocol = entry.nextHopProtocol || undefined;
      if (detectedHttpProtocol === 'h2' && queue.concurrency < HTTP2_TARGET_CONCURRENCY) {
        queue.concurrency = HTTP2_TARGET_CONCURRENCY;
        queue.capacity = HTTP2_TARGET_CONCURRENCY * 2;
        console.info(
          `[ClientSideUpload] HTTP/2 gateway detected, ramping concurrency ${concurrency} → ${HTTP2_TARGET_CONCURRENCY}`
        );
        mark('ramped concurrency', {
          from: concurrency,
          to: HTTP2_TARGET_CONCURRENCY,
          protocol: detectedHttpProtocol,
        });
      } else {
        mark('protocol detected', { protocol: detectedHttpProtocol ?? 'unknown' });
      }
      return;
    }
  };

  let lastStatePersistAt = 0;
  const maybePersistState = (force = false) => {
    const now = Date.now();
    if (!force && now - lastStatePersistAt < STATE_PERSIST_MIN_INTERVAL_MS) {
      return;
    }
    lastStatePersistAt = now;
    saveStamperState(cleanBatchId, {
      buckets: stamper.getState(),
      depth: stamper.depth,
    });
  };

  // beforeunload: synchronously flush stamper state if the user closes the
  // tab mid-upload. Without this, the 2 s debounce window can lose up to
  // 2 s of bucket increments — small, but trivially preventable since
  // saveStamperState is sync (just localStorage.setItem). Removed in the
  // outer try/finally below regardless of how the upload exits.
  const beforeUnloadHandler = () => {
    saveStamperState(cleanBatchId, {
      buckets: stamper.getState(),
      depth: stamper.depth,
    });
  };
  const hasWindow = typeof window !== 'undefined';
  if (hasWindow) {
    window.addEventListener('beforeunload', beforeUnloadHandler);
  }

  // Errors thrown inside a queue task become unhandled promise rejections
  // because cafe-utility's AsyncQueue only `.finally()`s the task — it does
  // NOT propagate task failures back to the caller of `enqueue`. If we don't
  // capture them ourselves, an upload that's silently failing every chunk
  // looks identical (from the UI's perspective) to a slow-but-working one,
  // because `onProgress` only fires on success. We track the first error and
  // (a) stop enqueueing more tasks, (b) re-throw it after `drain()` so the
  // caller surfaces a real error instead of returning a half-uploaded
  // manifest reference.
  let firstError: Error | null = null;

  const stampAndUpload = async (chunk: Chunk): Promise<void> => {
    const chunkBytes = chunk.build();
    let envelope: EnvelopeWithBatchId | null = null;

    for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
      if (abortSignal?.aborted) throw new Error('Upload aborted');
      // (Re-)stamp on retry so timestamp is fresh; index re-uses the same slot
      // because Stamper is deterministic per chunk address until a NEW chunk
      // with that bucket arrives. See SWIP §peek/sign/commit.
      // bee-js's Stamper.stamp() is the simplest variant: it always advances
      // the bucket counter, so on retry we ARE burning a slot. That is the
      // pragmatic v1 trade-off — slot burn is bounded by MAX_CHUNK_RETRIES.
      try {
        if (envelope === null) {
          envelope = stamper.stamp(chunk);
        }
        await bee.uploadChunk(envelope, chunkBytes, undefined, {
          timeout: CHUNK_HTTP_TIMEOUT_MS,
        } as any);
        chunksUploaded++;
        maybePersistState();
        onProgress?.(chunksUploaded, totalChunksApprox);
        if (!firstChunkMarked) {
          firstChunkMarked = true;
          mark('first chunk uploaded (TTFB-ish)');
        }
        // After the first successful chunk we have at least one Resource
        // Timing entry; check whether the gateway gave us HTTP/2 and ramp
        // up concurrency if so. No-op on subsequent calls.
        if (chunksUploaded === 1) detectAndMaybeRampConcurrency();
        return;
      } catch (err) {
        const isLast = attempt === MAX_CHUNK_RETRIES - 1;
        if (!isRetryable(err) || isLast) {
          // Translate the most common "fresh batch / gateway not synced"
          // failure into a typed error the UI can recognise. Other 4xx
          // problems (signature, bucket conflict, immutability) fall
          // through to the original error so the caller's existing
          // diagnostic branches still work.
          throw classifyAsStampNotReady(err) ?? err;
        }
        retryCount++;
        await sleep(CHUNK_RETRY_BASE_MS * 2 ** attempt);
        // Re-stamp from scratch on next attempt — current slot is poisoned.
        envelope = null;
      }
    }
  };

  const onChunk = async (chunk: Chunk): Promise<void> => {
    if (firstError) throw firstError;
    await queue.enqueue(async () => {
      if (abortSignal?.aborted || firstError) return;
      try {
        await stampAndUpload(chunk);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (!firstError) {
          firstError = error;
          console.error(
            `[ClientSideUpload] chunk upload failed (after ${chunksUploaded} OK):`,
            error
          );
        }
        // Re-throw so AsyncQueue's `.finally` still decrements `running` —
        // we only need to remember the first error, not crash the queue.
        throw error;
      }
    });
  };

  // The beforeunload listener stays active until the *deferred* SOC promise
  // resolves (it mutates the same `stamper`), or until we throw. A small
  // helper makes "remove exactly once" explicit at every exit point.
  let listenerRemoved = false;
  const removeBeforeUnloadListener = () => {
    if (!listenerRemoved && hasWindow) {
      window.removeEventListener('beforeunload', beforeUnloadHandler);
      listenerRemoved = true;
    }
  };

  try {
    // ── Chunk file → BMT MerkleTree → onChunk → upload ──────────────────────
    onStatus?.('Chunking and stamping file…');
    const fileRootChunk = await streamFileThroughMerkleTree(file, onChunk, abortSignal);
    mark('BMT producer done (all chunks enqueued)', { uploaded: chunksUploaded });
    await queue.drain();

    // Surface any chunk-task failure now — silently returning a reference for
    // a half-uploaded file is a much worse failure mode than a clear error.
    if (firstError) {
      maybePersistState(true);
      throw firstError;
    }

    maybePersistState(true);
    const fileChunkCount = chunksUploaded;
    mark('file leaves uploaded', { count: fileChunkCount });

    // The file's root chunk is itself a chunk that must be uploaded —
    // finalize() does NOT push it through onChunk.
    await stampAndUpload(fileRootChunk);
    mark('file root chunk uploaded');

    // ── Build the Mantaray manifest client-side ───────────────────────────
    onStatus?.('Building manifest…');
    const manifest = new MantarayNode();

    const filename = sanitiseFilename(file.name);
    const contentType = inferContentType(file);

    // Fork key MUST be the bare filename (no leading slash). Bee resolves
    // `/bzz/<ref>/<path>` by stripping `/bzz/<ref>/` and using the remainder
    // (no leading slash) as the manifest lookup key. A leading slash in the
    // fork key causes a key/length mismatch and a 404 even though every chunk
    // is locally available — confirmed empirically against Bee 2.7.x.
    manifest.addFork(filename, fileRootChunk.hash(), {
      'Content-Type': contentType,
      Filename: filename,
    });

    // Always add a "/" root entry that points to the file as the index
    // document, so `/bzz/<ref>/` (no path) also resolves cleanly. For an
    // explicit website upload we additionally set an error document.
    manifest.addFork('/', new Uint8Array(32), {
      'website-index-document': filename,
      ...(isWebsite ? { 'website-error-document': 'error.html' } : {}),
    });

    // ── Recursively stamp + upload manifest nodes ─────────────────────────
    onStatus?.('Stamping and uploading manifest…');
    const beforeManifest = chunksUploaded;
    const manifestRef = await saveManifestPresigned(manifest, async (data: Uint8Array) => {
      return uploadDataPresigned(data, stamper, bee, abortSignal, () => {
        chunksUploaded++;
        onProgress?.(chunksUploaded, totalChunksApprox);
      });
    });

    // Force-persist BEFORE we kick off the SOC promise so a tab close mid-SOC
    // doesn't lose the bucket counters consumed by the file + manifest upload.
    maybePersistState(true);

    const manifestChunkCount = chunksUploaded - beforeManifest;
    mark('manifest uploaded', { count: manifestChunkCount });

    // ── Defer the SOC backup off the critical path ────────────────────────
    // Push the (possibly updated) stamper state to a Single Owner Chunk on
    // Swarm so a different browser holding the same wallet can recover the
    // bucket counters. SOC payload captures state PRE-save; the post-save
    // local state is the authoritative one. See IssuerStateSOC.ts for the
    // drift discussion.
    //
    // The await used to be here, blocking the upload's "complete" status
    // behind one extra round-trip. Since the file is already on Swarm by
    // this point, we kick off the SOC write as a background promise and
    // return immediately. Caller can observe via `result.issuerStateSocPromise`.
    const socStartedAt = performance.now();
    const issuerStateSocPromise = (async (): Promise<IssuerStateSocResult | undefined> => {
      try {
        onStatus?.('Saving issuer state to Swarm (SOC)…');
        const soc = await saveIssuerStateToSOC({
          bee,
          hotKey,
          batchId: cleanBatchId,
          stamper,
          abortSignal,
        });
        // Persist again — the SOC save itself consumed slots that we want
        // reflected in localStorage so future uploads don't re-allocate them.
        maybePersistState(true);
        const socMs = performance.now() - socStartedAt;
        console.log(
          `⏱ [ClientSideUpload] SOC backup done in ${socMs.toFixed(0)}ms (background, ` +
            `total wall=${(performance.now() - startedAt).toFixed(0)}ms)`
        );
        return soc;
      } catch (err) {
        // SOC failures must NEVER fail the upload — the user's file is
        // already on Swarm. Log it so issuer-state recovery is debuggable.
        console.warn('Failed to save issuer state to SOC (upload itself succeeded):', err);
        return undefined;
      } finally {
        removeBeforeUnloadListener();
      }
    })();

    const elapsedMs = performance.now() - startedAt;
    const totalChunks = fileChunkCount + manifestChunkCount;
    const averageChunksPerSecond = elapsedMs > 0 ? (totalChunks * 1000) / elapsedMs : 0;

    stopSampler();
    mark('upload complete', {
      totalChunks,
      cps: averageChunksPerSecond.toFixed(1),
      retries: retryCount,
      protocol: detectedHttpProtocol ?? 'unknown',
      conc: queue.concurrency,
    });

    return {
      reference: `0x${manifestRef.toHex()}` as `0x${string}`,
      fileChunkCount,
      manifestChunkCount,
      elapsedMs,
      averageChunksPerSecond,
      retryCount,
      detectedHttpProtocol,
      effectiveConcurrency: queue.concurrency,
      issuerStateSocPromise,
    };
  } catch (err) {
    // Anything thrown by chunk upload / manifest / validation lands here.
    // Make sure we don't leak the beforeunload listener; the SOC promise
    // never got a chance to remove it because we never created it.
    stopSampler();
    mark('FAILED', { error: err instanceof Error ? err.message : String(err) });
    removeBeforeUnloadListener();
    throw err;
  }
}

// ─── Pre-flight capacity check ───────────────────────────────────────────────

/**
 * Project whether the given file would fit in the stamp's remaining
 * bucket capacity, based on the local Stamper's known counters.
 *
 * This is best-effort: bucket distribution is hash-driven, so a file whose
 * leaf addresses cluster in a few buckets can hit "Bucket is full" earlier
 * than the average projected here. Conversely, an upload projected near
 * 100% may complete fine if the file's chunks are well-distributed across
 * empty buckets. We use this to:
 *   - **fail** at >95% projected utilization (almost certainly will hit
 *     a bucket overflow mid-upload, burning slots for nothing)
 *   - **warn** at >80% so the caller can show a heads-up
 *
 * Exported so the UI can run the same check at file-select time and
 * surface a pre-emptive warning before the user even clicks Upload.
 */
export function checkProjectedStampCapacity(
  stamper: Stamper,
  fileSizeBytes: number
): ProjectedStampCapacity {
  const buckets = stamper.getState();
  const depth = stamper.depth;
  const maxSlot = 2 ** (depth - 16);
  const totalCapacity = 65536 * maxSlot; // = 2^depth

  let totalUsed = 0;
  for (let i = 0; i < buckets.length; i++) totalUsed += buckets[i];

  const projectedNew = approxChunkCount(fileSizeBytes);
  const projectedTotal = totalUsed + projectedNew;

  const utilizationPercent = (totalUsed / totalCapacity) * 100;
  const projectedUtilizationPercent = Math.min(100, (projectedTotal / totalCapacity) * 100);

  if (projectedUtilizationPercent >= STAMP_HARD_FAIL_UTILIZATION * 100) {
    return {
      level: 'fail',
      utilizationPercent,
      projectedUtilizationPercent,
      message:
        `Stamp would be ${projectedUtilizationPercent.toFixed(1)}% full ` +
        `after this upload (currently ${utilizationPercent.toFixed(1)}%). ` +
        `Top up the batch or use a fresh one before retrying.`,
    };
  }
  if (projectedUtilizationPercent >= STAMP_WARN_UTILIZATION * 100) {
    return {
      level: 'warn',
      utilizationPercent,
      projectedUtilizationPercent,
      message:
        `This upload will push the stamp from ${utilizationPercent.toFixed(1)}% ` +
        `to ~${projectedUtilizationPercent.toFixed(1)}% full.`,
    };
  }
  return { level: 'ok', utilizationPercent, projectedUtilizationPercent };
}

// ─── BMT streaming over a File ────────────────────────────────────────────────

/**
 * Pump the file's bytes through a `MerkleTree` so each filled 4 KB chunk is
 * stamped + uploaded via `onChunk`.
 *
 * Why slab reads (not 4 KB FileReader pings):
 *   `MerkleTree.append` is happy with arbitrary-sized inputs — it splits into
 *   4 KB chunks internally and fires `onChunk` whenever one fills. Reading
 *   the file 4 KB at a time forced ~one FileReader async hop per chunk,
 *   which dominated end-to-end latency for small files. We now read either
 *   the whole file (≤ {@link SINGLE_SHOT_READ_THRESHOLD_BYTES}) or 1 MiB
 *   slabs (above that), which collapses the read pipeline to one or a
 *   handful of awaits while still applying queue back-pressure via the
 *   `onChunk` await chain.
 */
async function streamFileThroughMerkleTree(
  file: File,
  onChunk: (chunk: Chunk) => Promise<void>,
  abortSignal?: AbortSignal
): Promise<Chunk> {
  const tree = new MerkleTree(onChunk);

  if (file.size <= SINGLE_SHOT_READ_THRESHOLD_BYTES) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    const buffer = await file.arrayBuffer();
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    await tree.append(new Uint8Array(buffer));
  } else {
    // Larger files: stream 1 MiB slabs via Blob.arrayBuffer(). This is the
    // promise-based equivalent of FileReader without the event-loop hop.
    for (let offset = 0; offset < file.size; offset += FILE_READ_SLAB_BYTES) {
      if (abortSignal?.aborted) throw new Error('Upload aborted');
      const end = Math.min(offset + FILE_READ_SLAB_BYTES, file.size);
      const slabBuf = await file.slice(offset, end).arrayBuffer();
      if (abortSignal?.aborted) throw new Error('Upload aborted');
      await tree.append(new Uint8Array(slabBuf));
    }
  }

  return tree.finalize();
}

// ─── Manifest assembly with presigned chunks ──────────────────────────────────

/**
 * Walks a MantarayNode tree depth-first, marshals every node, runs each
 * marshalled blob through a fresh BMT, and returns the root reference of the
 * topmost node. Each leaf chunk is stamped + uploaded via `presignedUpload`.
 *
 * This mirrors `MantarayNode.saveRecursively` from bee-js but never calls
 * `bee.uploadData` (which would require the Bee node to hold our key). It
 * mutates each node's `selfAddress` so subsequent marshals reference children
 * by their swarm hash — same convention as upstream.
 */
async function saveManifestPresigned(
  node: MantarayNode,
  presignedUpload: (data: Uint8Array) => Promise<Reference>
): Promise<Reference> {
  for (const fork of node.forks.values()) {
    const childRef = await saveManifestPresigned(fork.node, presignedUpload);
    fork.node.selfAddress = childRef.toUint8Array();
  }
  const marshalled = await node.marshal();
  const ref = await presignedUpload(marshalled);
  node.selfAddress = ref.toUint8Array();
  return ref;
}

/**
 * Equivalent of `bee.uploadData` but every chunk is presigned with the local
 * Stamper before being POSTed to /chunks. Returns the root chunk's address as
 * a Reference.
 *
 * Exported so the issuer-state SOC writer can reuse the exact same presigned
 * chunk pipeline for the encrypted state blob.
 */
export async function uploadDataPresigned(
  data: Uint8Array,
  stamper: Stamper,
  bee: Bee,
  abortSignal: AbortSignal | undefined,
  onUploaded: () => void
): Promise<Reference> {
  // Single-chunk fast path: most marshalled mantaray nodes are < 4 KB.
  if (data.length <= 4096) {
    const chunk = await MerkleTree.root(data);
    await uploadOneChunk(chunk, stamper, bee, abortSignal);
    onUploaded();
    return new Reference(chunk.hash());
  }

  // Larger blobs: stream through MerkleTree exactly like a file.
  let lastChunk: Chunk | null = null;
  const tree = new MerkleTree(async chunk => {
    await uploadOneChunk(chunk, stamper, bee, abortSignal);
    onUploaded();
  });
  for (let off = 0; off < data.length; off += 4096) {
    await tree.append(data.subarray(off, Math.min(off + 4096, data.length)));
  }
  lastChunk = await tree.finalize();
  await uploadOneChunk(lastChunk, stamper, bee, abortSignal);
  onUploaded();
  return new Reference(lastChunk.hash());
}

async function uploadOneChunk(
  chunk: Chunk,
  stamper: Stamper,
  bee: Bee,
  abortSignal: AbortSignal | undefined
): Promise<void> {
  const data = chunk.build();
  for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    try {
      const envelope = stamper.stamp(chunk);
      await bee.uploadChunk(envelope, data);
      return;
    } catch (err) {
      const isLast = attempt === MAX_CHUNK_RETRIES - 1;
      if (!isRetryable(err) || isLast) throw classifyAsStampNotReady(err) ?? err;
      await sleep(CHUNK_RETRY_BASE_MS * 2 ** attempt);
    }
  }
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function approxChunkCount(byteSize: number): number {
  // Leaf chunks for the file payload …
  const leaves = Math.ceil(byteSize / 4096);
  // … plus an over-estimate of intermediate BMT chunks (≈ leaves / 128 fanout)
  const intermediate = Math.ceil(leaves / 128);
  // … plus a small constant for manifest chunks (typically 1-3).
  return leaves + intermediate + 4;
}

function stripHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function isRetryable(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /network|timeout|fetch|ECONN|ETIMEDOUT|stalled|429|5\d\d/i.test(msg);
}

/**
 * Thrown when a chunk POST is rejected by the Bee gateway in a way that
 * looks like "I (the gateway) don't yet recognise this batch / stamp" —
 * i.e. the gateway's chain listener probably hasn't indexed past the
 * `createBatch` block yet, so its `presignedStamper.Stamp.Valid` lookup
 * returns no on-chain owner and refuses the chunk with HTTP 400 (or
 * occasionally 404 / 422).
 *
 * The UI uses `instanceof StampNotReadyError` to render a friendly
 * "your stamp isn't ready yet, give the gateway a few seconds and try
 * again" banner instead of dumping the bare axios message.
 *
 * NOT thrown for genuine signature / bucket-collision failures — those
 * have distinct response bodies and need different remediation.
 */
export class StampNotReadyError extends Error {
  /** HTTP status code returned by the gateway, when known. */
  readonly status: number | undefined;
  /** Verbatim parsed response body — `{code, message, ...}` typically. */
  readonly responseBody: unknown;
  /** Best-effort extraction of the gateway's `message` field. */
  readonly gatewayMessage: string | undefined;
  /** The original error we wrapped (e.g. `BeeResponseError`). */
  readonly cause: unknown;

  constructor(opts: {
    message: string;
    cause?: unknown;
    status?: number;
    responseBody?: unknown;
    gatewayMessage?: string;
  }) {
    super(opts.message);
    this.name = 'StampNotReadyError';
    this.status = opts.status;
    this.responseBody = opts.responseBody;
    this.gatewayMessage = opts.gatewayMessage;
    this.cause = opts.cause;
    // Preserve prototype chain for `instanceof` checks across module
    // boundaries / minified bundles. Standard TS-down-to-ES5 dance.
    Object.setPrototypeOf(this, StampNotReadyError.prototype);
  }
}

/**
 * Decide whether a chunk-upload error is best surfaced as a
 * `StampNotReadyError`. We duck-type `BeeResponseError` so we don't have
 * to import its class symbol (keeps the helper usable for any
 * fetch/axios-shaped wrapper).
 *
 *   - 4xx with body text mentioning "batch ... not yet usable", "batch
 *     not found", "unknown batch", "stamp not allowed" → stamp-not-ready
 *   - 4xx with body wording "duplicate" / "bucket counter" → NOT stamp-
 *     not-ready; that's a bucket-collision (issuer state problem), kept
 *     as the original error so the UI's specific bucket branch handles it
 *   - 4xx with no parseable body and status 400 → likely stamp-not-ready
 *     (Bee gateways occasionally drop the JSON body on a `presignedStamper`
 *     reject when the batch is missing; bare 400 with `Request failed
 *     with status code 400` and no `responseBody.message` is the typical
 *     fingerprint of "gateway hasn't seen the batch yet")
 *
 * Everything else returns `null` (i.e. surface the original error).
 */
function classifyAsStampNotReady(err: unknown): StampNotReadyError | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as {
    status?: unknown;
    statusCode?: unknown;
    responseBody?: unknown;
    response?: { status?: unknown; data?: unknown };
    message?: unknown;
  };

  const status =
    typeof e.status === 'number'
      ? e.status
      : typeof e.statusCode === 'number'
        ? e.statusCode
        : typeof e.response?.status === 'number'
          ? e.response.status
          : undefined;

  // Only consider 4xx; 5xx and network errors stay retryable / generic.
  if (status === undefined || status < 400 || status >= 500) return null;

  const body = e.responseBody ?? e.response?.data ?? null;
  const gatewayMessage =
    body && typeof body === 'object' && typeof (body as { message?: unknown }).message === 'string'
      ? ((body as { message: string }).message)
      : typeof body === 'string'
        ? body
        : undefined;
  const lower = (gatewayMessage ?? '').toLowerCase();

  // Bucket / duplicate / immutability errors are NOT "not ready" — let the
  // caller's existing bucket-branch handling produce the right diagnostic.
  if (
    lower.includes('duplicate') ||
    lower.includes('already') ||
    lower.includes('bucket counter') ||
    lower.includes('immutable')
  ) {
    return null;
  }

  const looksLikeNotReady =
    lower.includes('not yet usable') ||
    lower.includes('not yet') ||
    (lower.includes('batch') &&
      (lower.includes('not found') ||
        lower.includes('unknown') ||
        lower.includes('does not exist'))) ||
    lower.includes('stamp not allowed') ||
    // Bare 400 with no detail body is the de-facto fingerprint of a fresh-
    // batch race on most public gateways.
    (status === 400 && !gatewayMessage);

  if (!looksLikeNotReady) return null;

  const detail = gatewayMessage
    ? `${gatewayMessage} (HTTP ${status})`
    : `Bee gateway returned HTTP ${status} for the chunk POST.`;
  return new StampNotReadyError({
    message: `Stamp not ready yet: ${detail}`,
    cause: err,
    status,
    responseBody: body,
    gatewayMessage,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

function sanitiseFilename(name: string): string {
  // Mantaray paths must be ASCII-safe; the gateway used to choke on non-Latin1.
  return name.normalize('NFKD').replace(/[^\x20-\x7e]/g, '_');
}

function inferContentType(file: File): string {
  if (file.type) return enrichTextMime(file.type);
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const fallback = COMMON_MIME[ext] ?? 'application/octet-stream';
  return enrichTextMime(fallback);
}

function enrichTextMime(mime: string): string {
  if (
    ['text/html', 'text/css', 'text/plain', 'application/json', 'application/javascript'].includes(
      mime
    )
  ) {
    return `${mime}; charset=utf-8`;
  }
  return mime;
}

const COMMON_MIME: Record<string, string> = {
  html: 'text/html',
  htm: 'text/html',
  css: 'text/css',
  js: 'application/javascript',
  mjs: 'application/javascript',
  json: 'application/json',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  ico: 'image/x-icon',
  pdf: 'application/pdf',
  txt: 'text/plain',
  zip: 'application/zip',
  tar: 'application/x-tar',
  gz: 'application/gzip',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  woff: 'font/woff',
  woff2: 'font/woff2',
  ttf: 'font/ttf',
};

// ─── Shared upload context (used by multi-file and collection paths) ─────────

/**
 * Internal book-keeping shared across one logical upload "session" — possibly
 * spanning multiple files (a collection or a multi-file run). Built once,
 * reused by every helper that touches the network so the Stamper, AsyncQueue,
 * progress counter and error trap are all consistent.
 *
 * Kept private to this file (callers go through `uploadMultipleFilesClientSide`
 * / `uploadFilesAsCollectionClientSide`). The single-file path
 * (`uploadFileClientSide` above) intentionally does NOT use this context — it
 * predates it and works fine standalone; refactoring it to use ctx would be
 * pure churn.
 */
interface UploadCtx {
  bee: Bee;
  stamper: Stamper;
  cleanBatchId: string;
  queue: AsyncQueue;
  abortSignal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  totalChunksApprox: number;
  chunksUploaded: number;
  firstError: Error | null;
  persistState: (force?: boolean) => void;
  stampAndUpload: (chunk: Chunk) => Promise<void>;
  onChunk: (chunk: Chunk) => Promise<void>;
}

function createUploadContext(opts: {
  batchId: string;
  hotKey: DerivedHotKey;
  depth: number;
  beeApiUrl: string;
  concurrency: number;
  abortSignal?: AbortSignal;
  onProgress?: (processed: number, total: number) => void;
  totalChunksApprox: number;
}): UploadCtx {
  const { batchId, hotKey, depth, beeApiUrl, concurrency, abortSignal, onProgress } = opts;

  if (!batchId) throw new Error('No batchId provided');
  if (!hotKey?.signer) throw new Error('No hot key provided');
  if (depth < 17) throw new Error(`Postage batch depth ${depth} is too small`);

  const cleanBatchId = stripHex(batchId);
  if (!/^[0-9a-fA-F]{64}$/.test(cleanBatchId)) {
    throw new Error(`Invalid batch id: ${batchId}`);
  }

  const bee = new Bee(beeApiUrl);
  const signer: PrivateKey = hotKey.signer;

  const persisted = loadStamperState(cleanBatchId);
  const stamper = persisted
    ? Stamper.fromState(signer, cleanBatchId, persisted.buckets, persisted.depth)
    : Stamper.fromBlank(signer, cleanBatchId, depth);

  if (persisted && persisted.depth !== depth) {
    console.warn(
      `Stamper state depth mismatch (${persisted.depth} vs ${depth}); using persisted state`
    );
  }

  const queue = new AsyncQueue(concurrency, concurrency * 2);

  const ctx: UploadCtx = {
    bee,
    stamper,
    cleanBatchId,
    queue,
    abortSignal,
    onProgress,
    totalChunksApprox: opts.totalChunksApprox,
    chunksUploaded: 0,
    firstError: null,
    persistState: () => {},
    stampAndUpload: async () => {},
    onChunk: async () => {},
  };

  let lastStatePersistAt = 0;
  ctx.persistState = (force = false) => {
    const now = Date.now();
    if (!force && now - lastStatePersistAt < STATE_PERSIST_MIN_INTERVAL_MS) {
      return;
    }
    lastStatePersistAt = now;
    saveStamperState(ctx.cleanBatchId, {
      buckets: ctx.stamper.getState(),
      depth: ctx.stamper.depth,
    });
  };

  ctx.stampAndUpload = async (chunk: Chunk): Promise<void> => {
    const chunkBytes = chunk.build();
    let envelope: EnvelopeWithBatchId | null = null;

    for (let attempt = 0; attempt < MAX_CHUNK_RETRIES; attempt++) {
      if (ctx.abortSignal?.aborted) throw new Error('Upload aborted');
      try {
        if (envelope === null) {
          envelope = ctx.stamper.stamp(chunk);
        }
        await ctx.bee.uploadChunk(envelope, chunkBytes, undefined, {
          timeout: CHUNK_HTTP_TIMEOUT_MS,
        } as any);
        ctx.chunksUploaded++;
        ctx.persistState();
        ctx.onProgress?.(ctx.chunksUploaded, ctx.totalChunksApprox);
        return;
      } catch (err) {
        const isLast = attempt === MAX_CHUNK_RETRIES - 1;
        if (!isRetryable(err) || isLast) throw classifyAsStampNotReady(err) ?? err;
        await sleep(CHUNK_RETRY_BASE_MS * 2 ** attempt);
        envelope = null;
      }
    }
  };

  ctx.onChunk = async (chunk: Chunk): Promise<void> => {
    if (ctx.firstError) throw ctx.firstError;
    await ctx.queue.enqueue(async () => {
      if (ctx.abortSignal?.aborted || ctx.firstError) return;
      try {
        await ctx.stampAndUpload(chunk);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        if (!ctx.firstError) {
          ctx.firstError = error;
          console.error(
            `[ClientSideUpload] chunk upload failed (after ${ctx.chunksUploaded} OK):`,
            error
          );
        }
        throw error;
      }
    });
  };

  return ctx;
}

async function streamFileThroughCtx(
  file: File,
  ctx: UploadCtx
): Promise<{ rootChunk: Chunk; chunkCount: number }> {
  const before = ctx.chunksUploaded;
  const fileRootChunk = await streamFileThroughMerkleTree(file, ctx.onChunk, ctx.abortSignal);
  await ctx.queue.drain();
  if (ctx.firstError) {
    ctx.persistState(true);
    throw ctx.firstError;
  }
  ctx.persistState(true);
  await ctx.stampAndUpload(fileRootChunk);
  ctx.persistState(true);
  return { rootChunk: fileRootChunk, chunkCount: ctx.chunksUploaded - before };
}

async function streamBytesThroughCtx(
  bytes: Uint8Array,
  ctx: UploadCtx
): Promise<{ rootChunk: Chunk; chunkCount: number }> {
  const before = ctx.chunksUploaded;
  const tree = new MerkleTree(ctx.onChunk);
  for (let off = 0; off < bytes.length; off += FILE_READ_SLAB_BYTES) {
    if (ctx.abortSignal?.aborted) throw new Error('Upload aborted');
    const end = Math.min(off + FILE_READ_SLAB_BYTES, bytes.length);
    await tree.append(bytes.subarray(off, end));
  }
  const rootChunk = await tree.finalize();
  await ctx.queue.drain();
  if (ctx.firstError) {
    ctx.persistState(true);
    throw ctx.firstError;
  }
  await ctx.stampAndUpload(rootChunk);
  ctx.persistState(true);
  return { rootChunk, chunkCount: ctx.chunksUploaded - before };
}

async function uploadManifestThroughCtx(
  manifest: MantarayNode,
  ctx: UploadCtx,
  onStatus?: (msg: string) => void
): Promise<{ manifestRef: Reference; manifestChunkCount: number }> {
  onStatus?.('Stamping and uploading manifest…');
  const before = ctx.chunksUploaded;
  const manifestRef = await saveManifestPresigned(manifest, async (data: Uint8Array) => {
    return uploadDataPresigned(data, ctx.stamper, ctx.bee, ctx.abortSignal, () => {
      ctx.chunksUploaded++;
      ctx.onProgress?.(ctx.chunksUploaded, ctx.totalChunksApprox);
    });
  });
  ctx.persistState(true);
  return { manifestRef, manifestChunkCount: ctx.chunksUploaded - before };
}

async function maybeSaveIssuerStateToSOC(
  ctx: UploadCtx,
  hotKey: DerivedHotKey,
  onStatus?: (msg: string) => void
): Promise<IssuerStateSocResult | undefined> {
  try {
    onStatus?.('Saving issuer state to Swarm (SOC)…');
    const soc = await saveIssuerStateToSOC({
      bee: ctx.bee,
      hotKey,
      batchId: ctx.cleanBatchId,
      stamper: ctx.stamper,
      abortSignal: ctx.abortSignal,
    });
    ctx.persistState(true);
    return soc;
  } catch (err) {
    console.warn('Failed to save issuer state to SOC (upload itself succeeded):', err);
    return undefined;
  }
}

function inferContentTypeFromName(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  const fallback = COMMON_MIME[ext] ?? 'application/octet-stream';
  return enrichTextMime(fallback);
}

function basename(path: string): string {
  const lastSlash = path.lastIndexOf('/');
  return lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
}

/**
 * Filter the same set of OS / metadata garbage that the legacy archive
 * processor filtered: macOS PAX headers, `__MACOSX/…`, `.DS_Store`, resource
 * forks (`._*`), and Windows `Thumbs.db`. Preserved as-is so behavioural
 * parity with the 1.1.x upload paths is preserved.
 */
function shouldFilterCollectionPath(path: string): boolean {
  if (path.startsWith('PaxHeader/')) return true;
  if (path.startsWith('__MACOSX/') || path === '__MACOSX') return true;
  if (path === '.DS_Store' || path.includes('/.DS_Store')) return true;
  if (path.startsWith('._') || path.includes('/._')) return true;
  if (path === 'Thumbs.db' || path.includes('/Thumbs.db')) return true;
  return false;
}

function normaliseManifestPath(path: string): string {
  // Strip leading `./` and any leading `/` — Mantaray fork keys are bare.
  return path.replace(/^\.\/+/, '').replace(/^\/+/, '');
}

// ─── Multi-file upload (N files, N independent Swarm references) ─────────────

export interface MultiFileUploadParams {
  files: File[];
  batchId: string;
  hotKey: DerivedHotKey;
  depth: number;
  beeApiUrl: string;
  /** Optional progress callback: (currentFileIndex, totalFiles, file-level progress). */
  onProgress?: (
    fileIndex: number,
    totalFiles: number,
    fileProgress: { processed: number; total: number }
  ) => void;
  onStatus?: (message: string) => void;
  concurrency?: number;
  abortSignal?: AbortSignal;
}

export interface MultiFileResult {
  filename: string;
  reference?: `0x${string}`;
  fileChunkCount?: number;
  manifestChunkCount?: number;
  success: boolean;
  error?: string;
}

export interface MultiFileUploadResult {
  results: MultiFileResult[];
  totalChunks: number;
  issuerStateSoc?: IssuerStateSocResult;
}

/**
 * Upload multiple files to Swarm with self-custody stamping, producing one
 * independent Swarm reference per file. Each file becomes its own minimal
 * Mantaray manifest (one fork) so the resolution UX matches single-file
 * uploads (`/bzz/<ref>/<filename>`).
 *
 * Files are uploaded sequentially so all share a single Stamper instance and
 * bucket counters advance monotonically. Within a file, chunks still upload
 * in parallel (see {@link DEFAULT_CONCURRENCY}).
 *
 * The SOC issuer-state save is done ONCE after the last file completes —
 * persisting after every file would just churn the same SOC payload N times.
 * If a file fails, partial results are still returned and localStorage
 * stamper state remains current so the next run resumes cleanly.
 */
export async function uploadMultipleFilesClientSide(
  params: MultiFileUploadParams
): Promise<MultiFileUploadResult> {
  const {
    files,
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    onProgress,
    onStatus,
    concurrency = DEFAULT_CONCURRENCY,
    abortSignal,
  } = params;

  if (!files || files.length === 0) throw new Error('No files provided');

  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const ctx = createUploadContext({
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    concurrency,
    abortSignal,
    onProgress: undefined,
    totalChunksApprox: approxChunkCount(totalBytes),
  });

  const results: MultiFileResult[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (abortSignal?.aborted) {
      results.push({ filename: file.name, success: false, error: 'Upload aborted' });
      continue;
    }

    const before = ctx.chunksUploaded;
    onStatus?.(`Uploading file ${i + 1}/${files.length}: ${file.name}`);

    try {
      ctx.firstError = null;

      const fileTotalApprox = approxChunkCount(file.size);
      ctx.onProgress = (processed: number) => {
        onProgress?.(i, files.length, {
          processed: Math.max(0, processed - before),
          total: fileTotalApprox,
        });
      };

      const { rootChunk } = await streamFileThroughCtx(file, ctx);
      const fileChunkCount = ctx.chunksUploaded - before;

      const manifest = new MantarayNode();
      const filename = sanitiseFilename(file.name);
      const contentType = inferContentType(file);
      manifest.addFork(filename, rootChunk.hash(), {
        'Content-Type': contentType,
        Filename: filename,
      });
      manifest.addFork('/', new Uint8Array(32), {
        'website-index-document': filename,
      });

      const beforeManifest = ctx.chunksUploaded;
      const { manifestRef } = await uploadManifestThroughCtx(manifest, ctx);
      const manifestChunkCount = ctx.chunksUploaded - beforeManifest;

      results.push({
        filename: file.name,
        reference: `0x${manifestRef.toHex()}` as `0x${string}`,
        fileChunkCount,
        manifestChunkCount,
        success: true,
      });
    } catch (err) {
      console.error(`Failed to upload ${file.name}:`, err);
      results.push({
        filename: file.name,
        success: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  ctx.onProgress = undefined;
  const issuerStateSoc = await maybeSaveIssuerStateToSOC(ctx, hotKey, onStatus);

  return {
    results,
    totalChunks: ctx.chunksUploaded,
    issuerStateSoc,
  };
}

// ─── Collection upload (N files → ONE manifest → ONE Swarm reference) ────────

/**
 * One entry inside a collection upload (folder, website, NFT image folder).
 * Path is the manifest fork key (slashes are fine; bee-js handles nested
 * forks automatically). MUST NOT start with a leading slash. `data` can be a
 * `File` (preferred — avoids reading into JS memory) or a `Uint8Array` (used
 * by the NFT path which already has the bytes after JSZip extraction).
 */
export interface CollectionEntry {
  path: string;
  data: File | Uint8Array;
  contentType?: string;
}

export interface CollectionUploadParams {
  entries: CollectionEntry[];
  batchId: string;
  hotKey: DerivedHotKey;
  depth: number;
  beeApiUrl: string;
  /**
   * If set, the manifest is marked as a website. `indexDocument` defaults to
   * `index.html`; callers can also inject a generated one (see
   * {@link ./FolderArchiveExtract.buildSwarmIndexHtml}).
   */
  website?: {
    indexDocument?: string;
    errorDocument?: string;
  };
  onProgress?: (processed: number, total: number) => void;
  onStatus?: (message: string) => void;
  concurrency?: number;
  abortSignal?: AbortSignal;
}

export interface CollectionUploadResult {
  reference: `0x${string}`;
  totalChunkCount: number;
  fileChunkCount: number;
  manifestChunkCount: number;
  issuerStateSoc?: IssuerStateSocResult;
}

/**
 * Upload N files as ONE collection: each file's chunks land on Swarm, then a
 * single Mantaray manifest with N forks (one per file path) is built and
 * uploaded. Result is a single Swarm reference that resolves the whole tree
 * via `/bzz/<ref>/<filepath>` and (if `website` is set) `<ref>/` → the index
 * document.
 */
export async function uploadFilesAsCollectionClientSide(
  params: CollectionUploadParams
): Promise<CollectionUploadResult> {
  const {
    entries,
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    website,
    onProgress,
    onStatus,
    concurrency = DEFAULT_CONCURRENCY,
    abortSignal,
  } = params;

  if (!entries || entries.length === 0) throw new Error('No entries provided');

  const cleanedEntries = entries
    .map(e => ({ ...e, path: normaliseManifestPath(e.path) }))
    .filter(e => e.path && !shouldFilterCollectionPath(e.path));

  if (cleanedEntries.length === 0) {
    throw new Error('No uploadable entries remain after filtering metadata files');
  }

  const totalBytes = cleanedEntries.reduce(
    (s, e) => s + (e.data instanceof File ? e.data.size : e.data.length),
    0
  );

  const ctx = createUploadContext({
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    concurrency,
    abortSignal,
    onProgress,
    totalChunksApprox: approxChunkCount(totalBytes),
  });

  const manifest = new MantarayNode();
  const beforeAllFiles = ctx.chunksUploaded;

  for (let i = 0; i < cleanedEntries.length; i++) {
    if (abortSignal?.aborted) throw new Error('Upload aborted');
    const entry = cleanedEntries[i];
    onStatus?.(`Uploading ${i + 1}/${cleanedEntries.length}: ${entry.path}`);
    ctx.firstError = null;

    let rootChunk: Chunk;
    if (entry.data instanceof File) {
      ({ rootChunk } = await streamFileThroughCtx(entry.data, ctx));
    } else {
      ({ rootChunk } = await streamBytesThroughCtx(entry.data, ctx));
    }

    const contentType =
      entry.contentType ??
      (entry.data instanceof File
        ? inferContentType(entry.data)
        : inferContentTypeFromName(entry.path));

    manifest.addFork(entry.path, rootChunk.hash(), {
      'Content-Type': contentType,
      Filename: basename(entry.path),
    });
  }

  const fileChunkCount = ctx.chunksUploaded - beforeAllFiles;

  if (website) {
    const indexDocument = website.indexDocument ?? 'index.html';
    const meta: Record<string, string> = {
      'website-index-document': indexDocument,
    };
    if (website.errorDocument) {
      meta['website-error-document'] = website.errorDocument;
    }
    manifest.addFork('/', new Uint8Array(32), meta);
  }

  const beforeManifest = ctx.chunksUploaded;
  const { manifestRef } = await uploadManifestThroughCtx(manifest, ctx, onStatus);
  const manifestChunkCount = ctx.chunksUploaded - beforeManifest;

  const issuerStateSoc = await maybeSaveIssuerStateToSOC(ctx, hotKey, onStatus);

  return {
    reference: `0x${manifestRef.toHex()}` as `0x${string}`,
    totalChunkCount: ctx.chunksUploaded,
    fileChunkCount,
    manifestChunkCount,
    issuerStateSoc,
  };
}
