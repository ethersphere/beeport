# Troubleshooting

Common failures in Beeport self-custody uploads and what to do about them.

## Upload fails immediately

### "Missing file, postage batch ID, or wallet"

Connect the wallet, choose a file, and select a stamp. If state looks out of sync, refresh the page.

### "Storage not ready yet" / HTTP 400 `invalid batch id` on a fresh batch

The Bee gateway's batchstore hasn't indexed your `createBatch` block yet. The app probes with one chunk and retries for ~2 minutes ("Waiting for Bee gateway to recognize your new storage…"). If it still fails after that, the gateway is slow to poll its RPC or watches a different PostageStamp contract — wait a minute and press Upload again (your file selection is preserved), or switch gateways.

### "One chunk of this file belongs to a full bucket" / "Bucket is full"

A storage has 65,536 buckets. Each bucket holds a fixed number of chunks. A chunk goes into the bucket that its address points to. When that bucket is full, the app cannot stamp the chunk. The upload stops. Chunks that the app already sent stay stored.

The app checks its own saved counters before it sends a chunk. Bee applies the same limit. Bee refuses a stamp with a slot number above the limit (`invalid index`).

Other files can still work, because their chunks go to other buckets. A top-up adds time, not space, so it does not help. Use a larger storage for this file.

If the counters look wrong, enable **Advanced info** in Settings. Then use **Reset local state** in the storage list. This clears the counters of that one storage. The next upload restores them from the Swarm backup. If no backup exists, the counters start at zero. New files can then replace older files. Reset only if you are sure that the counters are wrong.

### "Bee doesn't recognize this batch"

If it's not a fresh-batch race (above), the gateway probably watches a different postage contract than the one that created the batch. Compare Bee's `--postage-stamp-contract-address` with the app's Gnosis stamp address.

## Network issues

### Many `net::ERR_FAILED` on `POST …/chunks` during large uploads

Too many parallel chunk requests vs what the HTTP/2 edge can sustain (typical stream limit ~128 per connection).

1. Use current Beeport — parallelism is capped to stay within typical gateway limits.
2. Self-hosted gateway: raise `http2_max_concurrent_streams` only if you intentionally increase client parallelism.
3. If errors persist, try a different network or a gateway closer to you.

See [Client-side chunk pipeline](./client-side-chunk-pipeline.md).

### Duplicate CORS headers (`Access-Control-Allow-Origin` appears twice)

Both Bee and nginx are adding CORS headers. Uploads may still work and files still open by direct navigation, but `fetch` probes fail. Fix the gateway so only one layer emits CORS — see [Self-hosting a Bee gateway](./self-hosting-bee-gateway.md).

### Upload stalls or times out

Keep the tab open and focused (background tabs get throttled). For multi-GB files use a stable connection; progress can look stuck while large chunk batches drain.

## Archive / website issues

| Symptom | Fix |
| ------- | --- |
| ZIP/TAR extract fails | Re-create the archive with standard compression; test extracting locally first |
| Files missing after extract | Duplicate names or paths over 100 chars (TAR limit, auto-truncated) — see [Archive processing](./archive-processing.md) |
| Website shows blank root | `index.html` must be at the archive/folder root; try the URL with a trailing `/` |
| Broken assets on a website | Use relative paths; filename case must match exactly |
| NFT ZIP rejected | Needs top-level `images/` and `json/` folders — see [NFT collection upload](./nft-collection-upload.md) |

## HTTP status codes from the gateway

| Code | Likely cause | What to do |
| ---- | ------------ | ---------- |
| 400 | Fresh batch not indexed yet, invalid stamp, or bucket collision | Wait for the readiness probe / retry; check stamp state |
| 404 | Batch or reference unknown to this gateway | Verify the batch ID / reference; try another gateway |
| 413 | Body too large for the edge proxy | Gateway config (`client_max_body_size`) — chunks are 4 KB, so this usually means a misrouted request |
| 429 | Rate limited | Wait and retry |
| 5xx | Gateway problem | Retry later or switch gateways |

## Reporting an issue

Include: browser + version, OS, file size/type, the exact error text, and the one-line diagnostic from the success/failure status (chunk count, chunks/s, protocol) if shown. The browser console (DevTools) usually has a `[ClientSideUpload]` trace worth copying.

---

_Guides: [Single file](./single-file-upload.md) · [Multiple files](./multiple-file-upload.md) · [ZIP](./zip-file-upload.md) · [Webpage](./webpage-upload.md) · [NFT collection](./nft-collection-upload.md)_
