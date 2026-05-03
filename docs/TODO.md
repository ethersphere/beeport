# Roadmap & known follow-ups

Living document. Items are grouped by ROI vs. risk, **not** by feature area, so we can pick the next thing off the top.

Status legend:
- `[ ]` not started
- `[~]` partially done / WIP
- `[x]` shipped (and kept here for context until the next major branch cleanup)

---

## 1. Quick wins (≤ ½ day, low risk)

### 1.1 Defer `saveIssuerStateToSOC` off the critical path — `[x]` shipped
**Files:** `src/app/components/ClientSideUpload.ts`, `src/app/components/SwapComponent.tsx`

`ClientSideUploadResult.issuerStateSocPromise` is now a `Promise<IssuerStateSocResult | undefined>` that runs in the background. The outer `uploadFileClientSide` promise resolves as soon as the manifest reference is known; the SOC write happens after, observed by `SwapComponent` for logging only. Stamper state is force-persisted before the SOC promise kicks off so a tab close mid-SOC doesn't lose file-upload bucket counters.

### 1.2 Adaptive concurrency — `[x]` shipped
**Files:** `src/app/components/ClientSideUpload.ts`

After the first successful chunk we read `PerformanceResourceTiming.nextHopProtocol` for the just-completed `/chunks` request. If it's `'h2'`, we mutate `queue.concurrency` (and capacity) up to `HTTP2_TARGET_CONCURRENCY = 32` mid-flight — cafe-utility's `AsyncQueue` reads these on every `process()` tick so the new slots fill on the next task completion. HTTP/1.1 stays at the conservative default. Down-ramp on consecutive 429s is *not* implemented; existing per-chunk retry handles transient throttling.

### 1.3 Persist stamper state on `beforeunload` — `[x]` shipped
**Files:** `src/app/components/ClientSideUpload.ts`

`beforeunload` listener registered for the duration of file upload + the deferred SOC promise (since SOC mutates the same Stamper). Removed exactly once, in the SOC promise's `finally` on success and in an outer `catch` on validation/upload failure. Closes the 2 s debounce window without changing per-chunk hot-path cost.

### 1.4 Diagnostic counters in `Complete` status — `[x]` shipped
**Files:** `src/app/components/ClientSideUpload.ts`, `src/app/components/SwapComponent.tsx`

`ClientSideUploadResult` now carries `elapsedMs`, `averageChunksPerSecond`, `retryCount`, `detectedHttpProtocol`, `effectiveConcurrency`. The success status appends a one-line summary like `· 562 chunks in 4.2s (134/s, H2 ×32)` so users (and bug reports) can tell a fast gateway from a slow one at a glance.

### 1.5 Stamp-utilization pre-flight check — `[x]` shipped (logic only)
**Files:** `src/app/components/ClientSideUpload.ts`

Exported `checkProjectedStampCapacity(stamper, fileSizeBytes)` returns `'ok' | 'warn' | 'fail'` based on average bucket fill projected to post-upload. `uploadFileClientSide` now refuses (throws) at ≥95% projected utilization and `console.warn`s at ≥80%. Best-effort — bucket distribution is hash-driven, so an unevenly-distributed file may still hit "Bucket is full" earlier.

**Still TODO:** call this from the upload UI at file-select time so the user sees the warning *before* clicking Upload (currently they only see the warning in console). One-line addition in `SwapComponent`'s file-select handler — moved to §1.6 below.

### 1.6 Surface stamp-utilization warnings in the upload UI
**Files:** `src/app/components/SwapComponent.tsx`

Now that the helper exists (§1.5), call it from the file-select handler against the current `Stamper` (loaded via `loadStamperState` + reconstructed). Show:
- A "warning" banner above the file input when `level === 'warn'`
- An inline error + disabled Upload button when `level === 'fail'`

Reuse the `healthBanner` CSS classes added for the Bee node health probe.

### 1.8 Fresh-batch readiness probe + suppress unhandled-rejection storm — `[x]` shipped
**Files:** `src/app/components/ClientSideUpload.ts`, `src/app/components/SwapComponent.tsx`

Two related bugs hit any user uploading to a freshly-created batch:
- `waitForGatewayBatchSync` only checks Bee's `/chainstate`, which can be ahead of the batchstore poll cycle. So `'synced'` would return, the parallel chunk firehose would open, and N requests would simultaneously fail with bare HTTP 400 ("batch not yet usable") with no UI feedback that this was a transient condition.
- For each parallel failure, `onChunk` re-threw inside the `cafe-utility` AsyncQueue task body. AsyncQueue attaches only `.finally()` (no `.catch`), so the rejection bubbled to the global handler — Next.js rendered one red "Unhandled Runtime Error" overlay per failing chunk (so 64 simultaneous 400s = 64 overlays).

Fix:
- New `waitForStampReady(stamper, bee, abortSignal, onStatus)` helper. Stamps **one** canonical chunk (4 KiB of zeros — deterministic address, dedups across runs and across users on Bee's side) and POSTs it in a loop with backoff (`STAMP_READY_PROBE_DELAY_MS = 4_000` × `STAMP_READY_PROBE_MAX_ATTEMPTS = 30` ≈ 2 min budget). Same envelope across retries so the probe burns exactly 1 slot regardless of how long the gateway takes. Surfaces "Waiting for Bee gateway to recognize your new stamp… (probe N/M)" via the upload `onStatus` callback every retry.
- Called from `uploadFileClientSide` immediately before the chunking pipeline starts. Skipped on second-and-later runs from the same browser via the per-batch `stampedAddrs` dedup set (a hit means the gateway has accepted us before).
- Same probe wired into `createUploadContext` as `ctx.ensureStampReady(onStatus)`, called once at the top of `uploadMultipleFilesClientSide` and `uploadFilesAsCollectionClientSide`. The collection paths now also run the per-batch chunk-address dedup that the single-file path has had since §1.7.
- Per-chunk task body in both `onChunk` variants no longer re-throws on failure — captures `firstError` and returns. The outer `await queue.drain()` re-throws `firstError` exactly once, so the user still gets a single error UI without 64 dev-overlay spam pop-ups.
- Error-translation copy in `SwapComponent.translateSelfCustodyUploadError` updated to reflect the new behaviour ("we already waited 2 min" instead of "wait a few seconds").

### 1.9 Move stamper state + chunk-dedup set to IndexedDB — `[x]` shipped
**Files:** new `src/app/components/IndexedDBStore.ts`, `src/app/components/ClientStamping.ts`, `src/app/components/ClientSideUpload.ts`, `src/app/components/StampListSection.tsx`, `docs/self-custody-hot-key.md`

The previous `localStorage`-backed persistence layout blew the ~5 MB origin quota on any sufficiently large self-custody upload: a 32 k-chunk batch's `beeport.stamped.<batchId>` set serialised to ~2 MB of JSON, and every debounced flush re-stringified the entire `Set` from scratch. A second active batch tipped us over and `setItem` started throwing `QuotaExceededError` mid-upload (loudly logged but otherwise silent — the dedup benefit was lost on the next run).

Fix:
- Both `stamperState` (one `Uint32Array(65 536)` per batch) and `stampedAddrs` (unbounded set per batch) now live in IndexedDB via a tiny zero-dep wrapper (`IndexedDBStore.ts`). IDB has effectively no practical quota for this volume (~50 % of free disk on modern browsers).
- `stampedAddrs` writes are now **incremental** — one `addStampedAddress(batchId, addrHex)` `put` per accepted chunk instead of a debounced bulk re-serialization of the whole set. Drops the `stampedAddrsDirty` / `maybePersistStampedAddrs` machinery from both the single-file path and the multi-file `UploadCtx` path.
- `stamperState` writes still go through the existing 2 s `STATE_PERSIST_MIN_INTERVAL_MS` debounce but use IDB's structured clone (no JSON round-trip; `Uint32Array` is stored directly).
- `loadStamperState` / `loadStampedAddresses` lazy-migrate from the legacy `localStorage["beeport.stamper.<batchId>"]` and `localStorage["beeport.stamped.<batchId>"]` keys on first read for any given batch, then delete the legacy entry so the migration only runs once. No user action required.
- All four load/save/clear helpers and `loadStampUsage` are now `async`. `createUploadContext` is now `async`; the two callers (`uploadMultipleFilesClientSide`, `uploadFilesAsCollectionClientSide`) await it. `StampListSection` pre-fetches the stamper state for every row in parallel via `Promise.all` before constructing the synchronous render shape.
- `beforeunload` flush degrades from "synchronous `localStorage.setItem`" to "fire-and-forget IDB `put`" — most browsers complete an already-issued IDB transaction even after the handler returns, but it's no longer a strong guarantee. Acceptable trade-off because the stamped-address set is now written-through per chunk (no loss possible) and stamper-state loss is bounded by the SOC backup on Swarm (cross-device replays the missing slots).

### 1.7 Fix depth desync between stamp list and uploads + per-batch chunk dedup — `[x]` shipped
**Files:** `src/app/components/StampListSection.tsx`, `src/app/components/SwapComponent.tsx`, `src/app/components/ClientSideUpload.ts`, `src/app/components/ClientStamping.ts`

`handleStampSelect` now calls `setSelectedDepth(stamp.depth)` so "Upload with these stamps" runs the upload at the actual on-chain depth instead of the parent's `useState(22)` default. The previous bug silently built local Stampers at depth 22 for depth-20 batches, handing out `cnt`s past Bee's `maxSlot`; Bee rejected those stamps while the local bucket counters kept climbing, eventually tripping `Bucket is full` with deceptively low byte fill.

Defence in depth:
- `uploadFileClientSide` now refuses any persisted state whose depth disagrees with the batch depth — it `clearStamperState` + `clearStampedAddresses` and starts `fromBlank` rather than running the math against a divergent state.
- `checkProjectedStampCapacity(stamper, fileSize, expectedDepth?)` hard-fails on depth mismatch as an extra belt-and-braces.
- `computeStampUsage(state, expectedDepth?)` now exposes `depthMismatch` + `exceedsMaxSlot` flags. `StampListSection` renders a red "⚠ corrupted local state" badge and a "Reset local state" button on cards with a divergent state.

Per-batch chunk-address dedup so repeated uploads of the same file are cheap:
- New `loadStampedAddresses` / `saveStampedAddresses` / `clearStampedAddresses` in `ClientStamping.ts` (`localStorage` key `beeport.stamped.<batchId>` → array of 64-char hexes).
- `stampAndUpload` consults the set BEFORE calling `stamper.stamp()` and short-circuits the entire (stamp, sign, POST) on a hit. New addresses are recorded only after Bee accepts the chunk. Persisted on the same debounce as the bucket state and force-flushed at end-of-file / end-of-manifest.
- Net effect: re-uploading the same file 100× to the same stamp consumes the same slots as uploading it once. Manifest + SOC chunks are still re-stamped fresh (their bytes change per upload).

---

## 2. Real refactors (1–3 days, medium risk, large gains)

### 2.1 Move BMT + Stamper into a Web Worker
**Files:** new `src/app/workers/upload.worker.ts`, refactor of `ClientSideUpload.ts`

After the slab-read change, the only main-thread work left is:
- BMT keccak256 over each 4 KB chunk
- secp256k1 ECDSA-sign per chunk (≈1–2 ms each in pure JS)

For a 10 000-chunk file that's ~20 s of main-thread CPU competing with React, axios, and progress callbacks. SWIP §C explicitly recommends Worker isolation.

**Plan:**
- New worker module owns a `Stamper` instance for the duration of a single upload.
- Main thread streams `Uint8Array` slabs into the worker via `postMessage` (transfer ownership, zero-copy).
- Worker emits `{address, chunkBytes, envelope}` back; main thread does the HTTP.
- Optional: spawn N workers for true CPU parallelism on multi-core (sign only — BMT must stay sequential per file).

Estimated win: ~1.5–2× wall-clock on top of current numbers, plus a snappier UI during upload.

### 2.2 Replace bee-js's axios with `fetch` for `/chunks`
**Files:** `src/app/components/ClientSideUpload.ts`

bee-js routes `bee.uploadChunk` through axios → XHR. XHR has measurable per-request overhead and doesn't multiplex over HTTP/2 the way `fetch` does.

**Plan:** Inline a tiny `fetch`-based POST in `ClientSideUpload.ts` and skip `bee.uploadChunk` entirely for the hot path. Keep `Bee` for everything else (reads, manifest GET, SOC writes).

Estimated win: 10–25 % on HTTP/2 gateways, more if bee-js ever fixes its timeout default.

### 2.3 Resumable uploads via persisted progress
**Files:** `src/app/components/ClientSideUpload.ts`, `src/app/components/ClientStamping.ts`

Today a tab-close mid-upload loses progress (the chunks are idempotent on Bee but we have no way to resume from chunk N). The Stamper state we persist is enough to *not* burn slots on retry, but the BMT pipeline starts over from byte 0.

**Plan:**
- Persist `(uploadId, fileHash, lastCompletedByteOffset, manifestRoot?)` per upload to localStorage / IndexedDB.
- On resume: hash the file again to confirm identity, then skip past `lastCompletedByteOffset` in `streamFileThroughMerkleTree`.
- Surface "Resume" / "Discard" buttons when the page detects an interrupted upload.

This is "the right thing" but probably 2 days of careful work; defer until a user actually complains about a lost upload.

---

## 3. Code-health & repo cleanup

### 3.1 Retire the V1 `StampsRegistry` flow once `SushiSwapStampsRouter` migrates to V2
**Files:** `contracts/StampsRegistry.sol`, `deploy/01_deploy_stamps_registry.ts`, `scripts/verify_registry.ts`, `contracts/SushiSwapStampsRouter.sol` (uses V1's `IStampsRegistry`)

V1 is still on-chain because the SushiSwap router's constructor takes its address. Once we either:
- redeploy `SushiSwapStampsRouter` against `StampsRegistryV2`, **or**
- write a thin V1-shaped adapter on top of V2,

we can delete the V1 contract, deploy script, and verify script. Keep them around until then so the existing on-chain router keeps verifying cleanly.

### 3.2 Update `docs/architecture.md` end-to-end
**Files:** `docs/architecture.md`

The component listing was just patched (1.5d edit), but the rest of the doc still describes the pre-self-custody flow (fileApiUrl, Bee node holds keys, etc.). A full rewrite to reflect the SWIP self-custody architecture is overdue.

### 3.3 Decide what to do with `misc/` test scripts
**Files:** `misc/testCC.js`, `misc/testFromBZZ.js`, `misc/testFromUSD.js`, `misc/testTo.js`, `misc/export_registry_data.js`, `misc/import_registry_data.js`

Plain `.js` files with no clear caller. Either move into a `scripts/dev/` folder with a README explaining how to run them, or delete the obsolete ones. Currently they're noise.

### 3.4 Tighten the `MultiFileResult` / multi-upload imports
**Files:** `src/app/components/SwapComponent.tsx`, `src/app/components/NFTCollectionClientSide.ts`

`tsc` currently reports missing exports (`uploadMultipleFilesClientSide`, `uploadFilesAsCollectionClientSide`, `MultiFileResult`, `CollectionEntry`, `CollectionUploadResult`) plus several `implicit any` parameters. The multi-file and collection paths in `SwapComponent` import names that `ClientSideUpload.ts` doesn't yet export.

**Plan:** either implement the missing exports in `ClientSideUpload.ts` (multi-file = wraps `uploadFileClientSide` in a loop with shared stamper; collection = builds one Mantaray manifest with N files) or temporarily stub the call sites behind a "coming soon" toast so the page type-checks.

### 3.5 README-level "what is self-custody?" explainer
**Files:** root `README.md`

The on-disk root README still describes the legacy custodial upload. New users land there confused about why their wallet signs the "stamping key derivation" message. One paragraph + a link to `docs/self-custody-hot-key.md` is enough.

---

## 4. Operational / nice-to-have

### 4.1 Alert when the Bee gateway is on an old apiVersion
**Files:** `src/app/components/BeeNodeHealth.ts`

`/health` returns `{version, apiVersion}`. Compare against the bee-js minimum and surface a warning if the gateway is too old to honour our chunk format.

### 4.2 Surface the gateway's reported `/health` `version` in the upload box
Tiny UX: "Bee 2.7.0 ✓" near the upload title when healthy. Builds trust and helps debugging.

### 4.3 Per-batch upload history with retrievability probe re-run
The post-upload `HEAD /bzz/<ref>/` is a one-shot today. For the upload history list, periodically re-probe references created in the last hour and flag any that lost retrievability — early warning for stamp-allocation issues we missed.

---

## 5. Cross-references

Background reading (drafts in this repo):
- [SWIP — Client-side postage stamping](./swip-XXXX-client-side-postage-stamping.md)
- [SWIP — Streamed postage stamp signing](./swip-XXXX-streamed-postage-stamp-signing.md)
- [Self-custody hot key](./self-custody-hot-key.md)
