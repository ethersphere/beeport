# Chunk transport: HTTP vs WebSocket stream

How Beeport sends **presigned CAC chunks** to a Bee gateway, why both transports exist, how **Auto** chooses between them, and what we measured on `beeport.xyz`.

Related code: `FastPresignedStamp.ts` (`PresignedChunkUploadSession`, `PresignedChunkStreamPool`), `ClientSideUpload.ts` (`resolveSessionTransportMode`), upload UI in `SwapComponent.tsx`.

## Summary

| | **HTTP `POST /chunks`** | **WebSocket `/chunks/stream` pool** |
| --- | --- | --- |
| **Bee** | Any recent Bee | **≥ 2.8.1** (`wss://…/chunks/stream`) |
| **Wire** | Body = chunk bytes; stamp in `swarm-postage-stamp` header | Binary message = `stamp[113] \|\| chunk`; empty-frame ack per chunk |
| **Parallelism** | Many concurrent `fetch` requests (default **96**, ramp to **128** on HTTP/2) | **N sockets** × **16 in-flight/socket** (default **32×16 ≈ 512**) |
| **Best for** | Smaller files; simple path; HTTP/2 gateways | Larger files once the socket pool is warm |
| **Cost** | Low setup (no multi-socket handshake) | Fixed cost to open/fill many WebSockets (~seconds) |
| **Auto rule** | Payload **&lt; 50 MB** | Payload **≥ 50 MB** (then fall back to HTTP if stream unavailable) |

Stamping, BMT hashing, and postage economics are the same for both. Only the **network hop** to the gateway differs.

## What each transport offers

### HTTP parallel POST

1. Outer `AsyncQueue` runs up to ~96–128 stamp+upload tasks at once.
2. Each task `POST`s one chunk to `{bee}/chunks` with a marshaled postage stamp header.
3. On HTTPS, after the first success we may ramp concurrency when Resource Timing reports `h2` (or when `NEXT_PUBLIC_ASSUME_HTTP2_UPLOAD` / host assumption applies). See [HTTP/2 parallelism cap](./client-side-chunk-pipeline.md#http2-parallelism-cap).

**Strengths**

- Native HTTP/2 multiplexing fits thousands of tiny (~4 KB) requests.
- Almost no connection setup beyond the first TLS session.
- Predictable on small/medium uploads; no ack protocol beyond HTTP status.

**Limits**

- Browser / edge `http2_max_concurrent_streams` caps useful concurrency (~128).
- On plain HTTP/1.1, browsers limit connections per host (~6), so throughput collapses unless the gateway is HTTP/2.

### WebSocket stream pool

Bee’s `/chunks/stream` accepts stamped chunks over one WebSocket. A **single** socket processes messages roughly **sequentially** (ack before the next slot frees in practice on the server). So one socket maxes out around tens of chunks/s on a public gateway — far below HTTP/2 POST.

Beeport therefore opens a **pool** of sockets to the **same** Bee node:

1. Connect **one** socket first and start uploading (keeps TTFB low).
2. Open the remaining sockets in the background (browsers serialize many handshakes to one host).
3. Stripe each chunk to the **least-busy** live socket (fewest pending acks).
4. Each socket keeps its own ordered ack FIFO (Bee’s empty binary acks are per-connection).
5. Raise the outer upload queue concurrency to **sockets × 16** so the pool is actually fed (otherwise it starves at the HTTP default of 96).

**Strengths**

- Unlocks many concurrent server-side consumers without relying on HTTP/2 stream limits the same way.
- On large files, measured throughput can **match or beat** HTTP on `beeport.xyz` once the pool is filled.
- Natural backpressure via per-chunk acks.

**Limits**

- Opening 32 sockets takes on the order of **several seconds**; that fixed cost dominates short uploads.
- While BMT is still producing leaves, CPU is shared with stamping — early `cps` looks low; after `BMT producer done`, instantaneous cps often spikes (drain of in-flight work).
- Pushing in-flight far past ~512 (e.g. 32×32 = 1024) inflated ack latency on our gateway and **lowered** average cps — past the sweet spot.

## Why Auto uses a size threshold

Empirical A/B on `beeport.xyz` (same app build, transport forced in the UI):

| Approx size | Chunks (order) | HTTP | WebSocket pool (32×16) |
| ----------- | -------------- | ---- | ---------------------- |
| ~7 MB | ~1.8k | **~5 s · ~370 cps** | ~15 s · ~117 cps |
| ~32 MB | ~8k | **Still ahead** (~536 vs ~438 cps) | |
| ~50–60 MB+ | — | Competitive | Pool payoff grows |
| ~130 MB | ~34k | Slower in our large-file runs | **Ahead** (~767 cps class) |

**Interpretation**

- Small files finish over HTTP before a 32-socket pool finishes filling.
- Large files amortize pool setup; steady-state stream cps can exceed HTTP.
- Compare only on a **fresh batch** (or accept that local chunk-address dedup and gateway-side storage make a second upload of the same bytes unfair). A “2× upload compare” UI was removed for that reason.

Default cutover: **50 MB** (`AUTO_CHUNK_STREAM_MIN_BYTES` / `NEXT_PUBLIC_AUTO_CHUNK_STREAM_MIN_MB`).

```text
Auto + size < 50 MB  →  force HTTP
Auto + size ≥ 50 MB  →  try WebSocket pool, fall back to HTTP if connect fails
UI “HTTP” / “WebSocket”  →  force that transport (WebSocket errors if unavailable)
```

Multi-file / folder / NFT collection Auto decisions use **total payload bytes** for that upload session.

## Configuration

### Upload UI (`SwapComponent`)

| Control | Effect |
| ------- | ------ |
| **Auto (HTTP if small, WebSocket if ≥50MB)** | Size-based selection above |
| **WebSocket stream** | Always open the stream pool (needs Bee ≥ 2.8.1) |
| **HTTP POST /chunks** | Always parallel HTTP |
| **Stream sockets** (1–32) | Pool size when stream is used; persisted in `localStorage` |

Live badge shows `HTTP chunks` or `WebSocket ×N` once the session opens.

### Environment

| Variable | Default | Effect |
| -------- | ------- | ------ |
| `NEXT_PUBLIC_PREFER_CHUNK_STREAM` | try stream when Auto/large | Set `false` to disable stream globally (HTTP only) |
| `NEXT_PUBLIC_AUTO_CHUNK_STREAM_MIN_MB` | `50` | Auto: stream only if payload ≥ this many MB |
| `NEXT_PUBLIC_CHUNK_STREAM_SOCKETS` | `32` | Default pool size (UI can override 1–32) |
| `NEXT_PUBLIC_ASSUME_HTTP2_UPLOAD` | host-dependent | Ramp HTTP concurrency when `nextHopProtocol` is hidden |

### Code constants (`FastPresignedStamp.ts` / `ClientSideUpload.ts`)

| Constant | Typical value | Role |
| -------- | ------------- | ---- |
| `DEFAULT_CHUNK_STREAM_SOCKETS` | 32 | Default N |
| `STREAM_IN_FLIGHT_PER_SOCKET` | 16 | Ack window per socket → **N×16** outer queue target |
| `DEFAULT_CONCURRENCY` / `HTTP2_TARGET_CONCURRENCY` | 96 / 128 | HTTP path only |
| `AUTO_CHUNK_STREAM_MIN_BYTES` | 50 MiB | Auto size cutover |

Tuning lesson from A/B: prefer changing **sockets** or sticking near **16 in-flight/socket**. Higher per-socket windows (24–32) did not reliably beat **32×16** on `beeport.xyz`.

## Operational notes

- **Same Bee node:** all pool sockets target one `beeApiUrl`; Bee runs an independent stream handler per connection.
- **Progressive open:** do not wait for all N sockets before the first chunk; fill the rest in the background.
- **Dedup:** re-uploading the same content under the same batch skips network for known chunk addresses — wall-clock and `cps` are not comparable to a cold upload.
- **CORS HEAD `/bzz/...`:** post-upload retrieval probes from `localhost` may fail CORS even when upload succeeded; that is unrelated to transport choice.
- **Dev server:** avoid running `next build` while `next dev` shares `.next` — stale CSS/JS 404s look like a “broken site” but are not transport bugs.

## Related docs

- [Client-side chunk pipeline](./client-side-chunk-pipeline.md) — BMT workers, `/chunks` vs `/soc`, HTTP/2 caps
- [Self-hosting Bee gateway](./self-hosting-bee-gateway.md) — reverse proxy / WebSocket upgrade
- [Troubleshooting](./troubleshooting.md) — upload failures
