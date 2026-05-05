# Client-side chunk pipeline (self-custody uploads)

Technical reference for how Beeport stamps and uploads chunks from the browser when using **self-custody** (hot key owns the batch; gateway never sees the private key).

## Overview

| Piece | Role |
| ----- | ---- |
| `ClientSideUpload.ts` | BMT chunking, `AsyncQueue` parallelism, manifest, optional SOC backup trigger |
| `FastPresignedStamp.ts` | EIP-191 stamp digest, `@noble/secp256k1` signing, optional worker pool, `fetch` POST to `/chunks` |
| `src/workers/stampSignerWorker.ts` | Off-main-thread signing (optional); pool falls back to main thread if workers fail |
| `ClientStamping.ts` | Stamper persistence (IndexedDB), chunk-address dedup batching |
| `IssuerStateSOC.ts` | Encrypted issuer-state backup to Swarm (SOC + blob) |

## Postage stamps

Bulk leaf and manifest chunks use **`buildStampEnvelope`** + **`uploadChunkPresignedFetch`** for throughput (`fetch` instead of axios, no JSON parse on success).

**SOC backup postage** uses **`Stamper.stamp()`** from bee-js (same Elliptic path as vanilla bee-js) so gateways that strictly expect bee-js-shaped stamps accept the final SOC chunk POST. Do not switch that path to the noble-only helper without re-validating against your Bee version.

## HTTP/2 parallelism cap

On HTTPS gateways we **raise** parallelism after the first successful `POST /chunks` when Resource Timing shows `h2`, or when the configured **same-host assumption** applies (see `gatewayAssumesHttp2` / `NEXT_PUBLIC_ASSUME_HTTP2_UPLOAD` in `ClientSideUpload.ts`).

The post-ramp target is **`HTTP2_TARGET_CONCURRENCY`**. It must stay **at or under typical edge `http2_max_concurrent_streams`** (often **128**). Going much higher causes **`net::ERR_FAILED`** bursts and an unresponsive UI even when many chunks eventually retry.

## UI progress updates

`onProgress` is **throttled** (~120 ms minimum interval) so React is not flooded with hundreds of state updates per second at high chunk rates. The **last** update for a phase still fires when `processed >= total` so the bar can reach 100%.

## Transport details (`uploadChunkPresignedFetch`)

- Request body is a **copy** of the chunk bytes (`new Uint8Array(...)`) so the POST body cannot race under extreme parallelism.
- **`keepalive`** is not used on chunk POSTs (some browsers mishandle many parallel keepalive uploads).

## Optional env

| Variable | Effect |
| -------- | ------ |
| `NEXT_PUBLIC_ASSUME_HTTP2_UPLOAD=true` | Assume HTTP/2 for any `https:` Bee API URL when `nextHopProtocol` is hidden (requires `Timing-Allow-Origin` on `/chunks` for a definitive `h2` readout). |

## Related docs

- [Self-custody hot key](./self-custody-hot-key.md) — derivation, persistence, SOC backup semantics
- [Troubleshooting](./troubleshooting.md) — upload failures and browser behaviour
