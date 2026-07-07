# Archive processing (shared behaviour)

How Beeport turns folders, ZIPs, and TARs into browsable Swarm websites. Mode-specific steps live in the dedicated guides below; this page covers behaviour they all share.

## Which guide to read

| Upload mode | Guide |
| ----------- | ----- |
| Pick a folder in the browser | [Folder upload](./folder-upload.md) |
| Single `.zip` / `.tar` file | [ZIP file upload](./zip-file-upload.md) |
| Static site with `index.html` / `error.html` headers | [Webpage upload](./webpage-upload.md) |
| NFT ZIP (`images/` + `json/`) | [NFT collection upload](./nft-collection-upload.md) |

## Automatic website creation

When an upload is processed for web serving (folder mode, or **Serve uncompressed** on an archive), Beeport:

1. Filters system metadata (see below).
2. Adds `index.html` if none exists in the archive root.
3. Packages content into a Mantaray manifest and uploads with website headers (`Swarm-Index-Document`, `Swarm-Error-Document` when applicable).

Root URL: `https://bzz.link/bzz/<reference>/` — individual files keep their paths under that reference.

## System metadata filtering

Removed automatically from folder, ZIP, and TAR processing:

- **macOS:** `PaxHeader/`, `__MACOSX/`, `.DS_Store`, `._*` resource forks
- **Windows:** `Thumbs.db`

## TAR filename limit (100 characters)

TAR paths are capped at 100 characters. Long names are truncated, the extension is preserved, and a short hash suffix avoids collisions. See the folder and ZIP guides for examples.

## Processing overview

```text
Folder:  select folder → filter → index (if needed) → manifest → upload
ZIP:     select file → [optional extract] → filter → index (if needed) → manifest → upload
TAR:     select file → extract → filter → index (if needed) → re-pack → upload
```

**Serve uncompressed** (single-file archive mode): extract locally, upload each file as a Mantaray fork — browseable via generated or existing `index.html`.

**Compressed ZIP** (Serve uncompressed off): upload the archive as one blob; download at `https://bzz.link/bzz/<reference>/<filename>`.

## Upload history vs stamps

| Data | Stored by | Survives browser change? |
| ---- | --------- | ------------------------- |
| Upload history (references, filenames) | Browser `localStorage` | No — export CSV if you need a backup |
| Postage stamps / batches | On-chain + wallet | Yes — reconnect the same wallet |

---

_For upload failures, see [Troubleshooting](./troubleshooting.md). For size caps, see [File formats & limits](./file-formats-limits.md)._
