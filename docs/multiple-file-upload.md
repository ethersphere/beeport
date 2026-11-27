# Multiple file upload guide

Upload several files in one session; **each file gets its own Swarm reference**, sharing the same postage stamp.

## Quick steps

1. Connect wallet → **Upload** tab.
2. Check **Multiple files separately (separate hashes)**.
3. **Choose files** (Ctrl/Cmd+click or Shift+click).
4. Select stamp with capacity for the **combined** size → **Upload**.

Files upload **sequentially** through the self-custody pipeline (stamp + `POST /chunks` per file).

## What you get

Per successful file:

```text
https://bzz.link/bzz/<reference>/<filename>
```

Failed files are reported individually; retry them in a new session.

## Mode limits

Multiple-file mode does **not** support:

- Archive extraction (**Serve uncompressed**)
- Folder structure (use [Folder upload](./folder-upload.md))
- NFT collection processing (use single-file ZIP + [NFT collection](./nft-collection-upload.md))

## Batch size

| Files | Total size | Notes |
| ----- | ---------- | ----- |
| 1–20 | < 500 MB | Typical |
| 20–100 | < 2 GB | Keep tab open |
| 100+ | large | Consider ZIP or folder upload instead |

Hard cap **8 GB** total — [File formats & limits](./file-formats-limits.md).

## Troubleshooting

- **Some failures:** re-upload only failed files.
- **All fail:** stamp capacity, wallet session, or gateway health — [Troubleshooting](./troubleshooting.md).
- **Slow:** expected for large batches; progress shows current file.

---

_Next: [Folder upload](./folder-upload.md) · [ZIP file upload](./zip-file-upload.md)_
