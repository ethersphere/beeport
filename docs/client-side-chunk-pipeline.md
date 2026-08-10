# Client-side chunk pipeline (self-custody uploads)

Technical reference for how Beeport stamps and uploads chunks from the browser when using **self-custody** (hot key owns the batch; gateway never sees the private key).

## Overview

| Piece | Role |
| ----- | ---- |
| `ClientSideUpload.ts` | BMT chunking (optional worker), `AsyncQueue` parallelism, manifest, optional SOC backup trigger |
| `BmtWorkerClient.ts` | Optional off-main-thread BMT via `bmtWorker.ts`; main-thread fallback |
| `FastPresignedStamp.ts` | EIP-191 stamp digest, `@noble/secp256k1` signing, optional worker pool, `fetch` to `/chunks` (CAC) or `/soc/...` (issuer-state SOC) |
| `src/workers/bmtWorker.ts` | Off-main-thread `MerkleTree` hashing (optional); main thread reads file slabs |
| `src/workers/stampSignerWorker.ts` | Off-main-thread signing (optional); pool falls back to main thread if workers fail |
| `HotKeySession.ts` | Derive hot key, worker-only scalar, 15 min idle re-sign |
| `ClientStamping.ts` | Stamper persistence (IndexedDB), chunk-address dedup batching |
| `IssuerStateSOC.ts` | Encrypted issuer-state backup to Swarm (content blob on `/chunks`, SOC on `/soc`) |

## Stamp signer web worker

Webpack 5 (used by `next dev`) only detects worker entries when **`new URL('…/worker.ts', import.meta.url)` is nested directly inside `new Worker(..., { type: 'module' })`**. If the URL is assigned to a variable first, the dev middleware can serve the raw `*.ts` asset with MIME **`video/mp2t`**, the browser refuses the module worker, and **`StampSignerPool`** falls back to main-thread signing.

The hot-key **private scalar lives only in these workers** after derivation. Main thread holds the public address, SOC AES `CryptoKey`, and routes signing through the pool. After **15 minutes without user activity**, the session clears and the wallet must sign the canonical derivation message again — see [Wallet security](./wallet-security.md).

## BMT web worker

File reads stay on the main thread (`File.slice` / `arrayBuffer` in 1 MiB slabs). **`BmtWorkerClient`** posts each slab to **`bmtWorker.ts`**, which runs bee-js **`MerkleTree`** off the UI thread. Leaf chunks stream back as wire bytes + content hashes; the main thread enqueues stamp + upload work unchanged.

Set **`NEXT_PUBLIC_BMT_WORKER=false`** to hash on the main thread (same algorithm, useful for debugging). Same webpack `new Worker(new URL(...))` pattern as the stamp signer worker.

## Postage stamps

Bulk leaf and manifest chunks use **`buildStampEnvelope`** + **`uploadChunkPresignedFetch`** for throughput (`fetch` instead of axios, no JSON parse on success).

**Issuer-state SOC postage** uses the same **`buildStampEnvelope`** (Noble + `ethSignedHashForStampPayload`) as every other presigned chunk, but the HTTP transport is **`uploadSocPresignedFetch`**, not `uploadChunkPresignedFetch`. See [Why SOCs are not POSTed to `/chunks`](#why-socs-are-not-posted-to-chunks) below.

## Why SOCs are not posted to `/chunks`

`POST /chunks` is for **Content-Addressed Chunks (CAC)**. Bee BMT-hashes the request body to derive the chunk address, then validates the `swarm-postage-stamp` using [`RecoverBatchOwner`](https://github.com/ethersphere/bee/blob/master/pkg/postage/stamp.go) against that derived address.

A **Single Owner Chunk** has a different address: `keccak256(identifier || owner)` (see Bee `pkg/soc`). Bee expects SOC uploads at:

```http
POST /soc/{owner}/{identifier}?sig={r||s||v as hex}
Content-Type: application/octet-stream
swarm-postage-stamp: <marshaled 113-byte stamp>

<span (8 bytes LE)> || <payload>
```

The body is only the **inner wrapped CAC data** (what bee-js builds as `span || payload` for the content-addressed chunk inside the SOC). Identifier and owner go in the path; the owner's signature over `identifier || innerChunkAddress` is the `sig` query parameter.

If the client instead POSTs full SOC wire bytes (`identifier || socSig || span || payload`) to `/chunks`, Bee treats the whole blob as CAC payload, derives the wrong address, and rejects the stamp — typically **`stamp signature is invalid`**, because the signature was computed over the SOC address, not the accidental BMT hash of that body.

## HTTP/2 parallelism cap

On HTTPS gateways we **raise** parallelism after the first successful `POST /chunks` when Resource Timing shows `h2`, or when the configured **same-host assumption** applies (see `gatewayAssumesHttp2` / `NEXT_PUBLIC_ASSUME_HTTP2_UPLOAD` in `ClientSideUpload.ts`).

The post-ramp target is **`HTTP2_TARGET_CONCURRENCY`**. It must stay **at or under typical edge `http2_max_concurrent_streams`** (often **128**). Going much higher causes **`net::ERR_FAILED`** bursts and an unresponsive UI even when many chunks eventually retry.

## UI progress updates

`onProgress` is **throttled** (~120 ms minimum interval) so React is not flooded with hundreds of state updates per second at high chunk rates. The **last** update for a phase still fires when `processed >= total` so the bar can reach 100%.

## Transport details (`uploadChunkPresignedFetch` / `uploadSocPresignedFetch`)

- **CAC (default):** parallel `POST {bee}/chunks` with `swarm-postage-stamp` header.
- **CAC (Bee v2.8.1+):** when the gateway accepts it, `PresignedChunkUploadSession` opens
  `wss://…/chunks/stream` in per-chunk stamp mode (no batch-id header; each binary message is
  `stamp[113] || chunk`). Falls back to HTTP automatically. Disable with
  `NEXT_PUBLIC_PREFER_CHUNK_STREAM=false`.
- **Issuer-state SOC:** `uploadSocPresignedFetch` — `POST {bee}/soc/{ownerHex}/{identifierHex}?sig={socSigHex}`, body = inner CAC only (same as bee-js `uploadSingleOwnerChunk`).
- Request bodies are **copies** (`new Uint8Array(...)`) so the POST cannot race under extreme parallelism.
- **`keepalive`** is not used on these POSTs (some browsers mishandle many parallel keepalive uploads).

## Optional env

| Variable | Effect |
| -------- | ------ |
| `NEXT_PUBLIC_ASSUME_HTTP2_UPLOAD=true` | Assume HTTP/2 for any `https:` Bee API URL when `nextHopProtocol` is hidden (requires `Timing-Allow-Origin` on `/chunks` for a definitive `h2` readout). |
| `NEXT_PUBLIC_PREFER_CHUNK_STREAM=false` | Force HTTP `POST /chunks` even when WebSocket `/chunks/stream` is available. |

## Bee gateway API (v2.8.1+)

`BeeApi.ts` wraps endpoints useful for self-custody:

| Endpoint | Use in Beeport |
| -------- | -------------- |
| `GET /chainstate` | `minimumValidityBlocks` + optional `currentPrice` for stamp cost estimates |
| `GET /batches/{id}` | Batch TTL / depth when `/stamps/{id}` 404s (foreign-owned batches) |
| `GET /stamps/{id}` | `utilizationRatio` when the gateway owns the batch issuer |

## Related docs

- [Self-custody hot key](./self-custody-hot-key.md) — derivation, persistence, SOC backup semantics
- [Troubleshooting](./troubleshooting.md) — upload failures and browser behaviour
- [File formats & limits](./file-formats-limits.md) — size caps from app constants
