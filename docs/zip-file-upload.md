# ZIP file upload guide

Upload a `.zip` archive with optional extraction and website serving. For behaviour shared with folder and TAR uploads (index pages, metadata filtering, path limits), see [Archive processing](./archive-processing.md).

## Upload modes

| Setting | Result |
| ------- | ------ |
| **Serve uncompressed** off | ZIP uploaded as a single downloadable file |
| **Serve uncompressed** on | Extract locally → filter → index if needed → Mantaray website |
| **Upload NFT collection** on (ZIP only) | Special `images/` + `json/` pipeline — [NFT collection upload](./nft-collection-upload.md) |

NFT collection and Serve uncompressed are mutually exclusive in the UI.

There is no separate “Upload as webpage” checkbox: uncompressed archives and folder uploads are configured as websites automatically.

## Quick steps (regular ZIP)

1. Connect wallet; leave **Multiple files separately** and **folder** unchecked.
2. Choose a `.zip` file.
3. Optionally check **Serve uncompressed** to browse files at `https://bzz.link/bzz/<reference>/`.
4. Select stamp → **Upload**.

## Serve uncompressed

```text
ZIP → extract → filter system files → index.html if missing → manifest → upload
```

Example URLs after extraction:

```text
https://bzz.link/bzz/<reference>/              → index
https://bzz.link/bzz/<reference>/docs/report.pdf
```

## Compressed (as-is) upload

```text
ZIP → upload blob → https://bzz.link/bzz/<reference>/archive.zip
```

## ZIP preparation tips

- Logical folder layout; avoid extremely deep nesting.
- Standard ZIP compression (avoid exotic methods).
- For NFT projects, use exactly `images/` and `json/` at the top level.

## Size limits

Warnings at **2 GB**; maximum **8 GB** per upload session — see [File formats & limits](./file-formats-limits.md). Self-custody uploads stamp every chunk in the browser; keep the tab open.

## Troubleshooting

| Error / symptom | Fix |
| --------------- | --- |
| Extract fails | Re-create ZIP; test locally first |
| Missing files after extract | Check duplicate names; path length — [Archive processing](./archive-processing.md) |
| Slow processing | Normal for large archives; see [Troubleshooting](./troubleshooting.md) |

---

_Related: [Folder upload](./folder-upload.md) · [Webpage upload](./webpage-upload.md) · [Archive processing](./archive-processing.md)_
