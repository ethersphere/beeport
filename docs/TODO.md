# Roadmap & known follow-ups

Living document. Items are grouped by ROI vs. risk, **not** by feature area, so we can pick the next thing off the top.

Status legend:
- `[ ]` not started
- `[~]` partially done / WIP
- `[x]` shipped (and kept here for context until the next major branch cleanup)

---

## 1. Quick wins (≤ ½ day, low risk)

### 1.1 Defer `saveIssuerStateToSOC` off the critical path
**Files:** `src/app/components/ClientSideUpload.ts`, `src/app/components/SwapComponent.tsx`

Today the upload `await`s the SOC write before resolving, so the user sees a "Saving issuer state to Swarm (SOC)…" tail after the bar hits 100 %. The SOC write is non-critical for *this* upload (the file is already on Swarm); it only matters for cross-device recovery.

**Plan:**
- Change the `ClientSideUploadResult` to expose `issuerStateSoc` as a `Promise<…>` instead of a resolved value.
- Resolve the upload promise as soon as the manifest reference is known.
- Background the SOC write; surface failures via `console.warn` (already done) plus a soft toast.
- Persist the local stamper state forcibly **before** kicking off the background SOC write so a tab close mid-SOC doesn't lose bucket counters.

### 1.2 Adaptive concurrency
**Files:** `src/app/components/ClientSideUpload.ts`

`DEFAULT_CONCURRENCY = 12` is a safe default; HTTP/2 gateways like `beeport.xyz` can handle ~32, self-hosted HTTP/1.1 nodes choke past 8.

**Plan:**
- Detect HTTP version from the first `/chunks` response (Performance API `nextHopProtocol`).
- Ramp the queue's `concurrency` up to 32 when HTTP/2, leave at 12 otherwise.
- Back off on consecutive 429s (halve concurrency, exponential warm-up).

### 1.3 Persist stamper state on `beforeunload`
**Files:** `src/app/components/ClientSideUpload.ts`

The 2 s debounce can lose up to 2 s worth of bucket increments on a tab close. Tiny window, but trivially fixable.

**Plan:** Register a `beforeunload` handler during an active upload that synchronously calls `saveStamperState`. Unregister in the `finally` block.

### 1.4 Diagnostic counters in `Complete` status
**Files:** `src/app/components/ClientSideUpload.ts`, `src/app/components/SwapComponent.tsx`

Surface `fileChunkCount`, `manifestChunkCount`, average chunks/s and retry count to the user at upload completion. Helps users (and us) tell "fast gateway" from "slow gateway" at a glance and gives a benchmark for future optimisations.

### 1.5 Visible stamp-utilization warning
**Files:** likely a new helper + `SwapComponent.tsx`

Bee returns `utilization` per stamp. We should refuse to start an upload when the projected `chunksUploaded` would exceed the batch's remaining capacity, and warn at, say, 80 %. Today the user can burn slot allocations and only learn after a "Bucket is full" thrown by `Stamper.stamp()`.

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
