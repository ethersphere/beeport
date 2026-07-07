# Single file upload guide

Upload one file to Swarm with self-custody stamping (chunks signed in your browser, then `POST /chunks` to the Bee gateway).

## Quick steps

1. Connect wallet → **Upload** tab.
2. Leave **Multiple files separately** and **folder** unchecked.
3. **Choose file** → pick stamp → **Upload**.

## Archive options (ZIP / TAR / GZ)

When the selected file is an archive, extra toggles appear:

| Option | Effect |
| ------ | ------ |
| **Serve uncompressed** | Extract locally; upload as browsable Mantaray collection — [Archive processing](./archive-processing.md) |
| **Upload NFT collection** (`.zip` only) | Requires `images/` + `json/` — [NFT collection upload](./nft-collection-upload.md) |

For TAR/GZ with **Serve uncompressed**, behaviour matches ZIP extraction. Website headers apply when serving uncompressed.

## Size limits

From `FILE_SIZE_CONFIG` in the app — see [File formats & limits](./file-formats-limits.md):

- Warning above **2 GB**
- Hard maximum **8 GB**

Self-custody uploads keep stamping in this tab until finished; closing the tab does not resume mid-upload (chunks are idempotent on retry).

## After upload

- **Reference:** Swarm content hash (hex).
- **Access:** `https://bzz.link/bzz/<reference>/<filename>` or browse at `/` when uncompressed.

Upload history is stored in the browser; export from History if you need a backup.

## Troubleshooting

See [Troubleshooting](./troubleshooting.md) for stamp capacity, gateway errors, and self-custody chunk failures.

Common quick fixes:

- Connect wallet and select a valid stamp
- Ensure stamp has enough capacity — [Postage stamps](./postage-stamps.md)
- For fresh batches, wait for “stamp ready” probe to finish

---

_Next: [Multiple file upload](./multiple-file-upload.md) · [Client-side chunk pipeline](./client-side-chunk-pipeline.md)_
