# Folder upload guide

Upload an entire directory as **one Swarm reference**, served as a browsable website. Shared archive behaviour (index generation, metadata filtering, TAR path limits) is described in [Archive processing](./archive-processing.md).

## Quick steps

1. Connect wallet and open the **Upload** tab.
2. Check **Multiple files in a folder (one hash, served as a website)**.
3. Click **Select Folder (auto-index)** and allow folder access when the browser prompts.
4. Select a postage stamp with enough capacity.
5. Click **Upload**.

Folder mode automatically enables webpage serving (index document headers). There is no separate “Upload as webpage” toggle.

## What happens

```text
Select folder → filter system files → add index.html if missing → Mantaray manifest → self-custody chunk upload
```

- **One hash** for the whole folder; paths are preserved under `https://bzz.link/bzz/<reference>/…`
- If the folder already has `index.html` or `index.htm` at the root, it is used instead of generating one.
- Subfolders of any depth are supported.

## Browser permissions

Chrome, Edge, and Firefox require explicit permission to read a folder — this is normal. Safari 14+ supports folder upload; older Safari versions may not.

## Folder structure examples

**Documents only** — generated index lists every file:

```text
my-documents/
├── report.pdf
└── notes.txt
```

**Existing website** — root `index.html` is kept; assets stay linked:

```text
my-website/
├── index.html
├── css/style.css
└── js/main.js
```

## Size and performance

| Approx. size | Files | Notes |
| ------------ | ----- | ----- |
| < 500 MB | < 500 | Usually completes in a few minutes |
| 500 MB – 2 GB | < 1000 | Keep the tab open; self-custody stamps every chunk in-browser |
| > 2 GB | many | UI warns at 2 GB; hard cap 8 GB total — see [File formats & limits](./file-formats-limits.md) |

## Best practices

- Use clear folder and file names; avoid characters that break paths.
- Remove junk before upload (system files are filtered, but not project cruft).
- For very large trees, split into multiple folder uploads or ZIP batches.

## Troubleshooting

| Issue | What to try |
| ----- | ----------- |
| Permission denied | Allow folder access in the browser prompt |
| Missing files | Check for paths > 100 chars (auto-truncated); see [Archive processing](./archive-processing.md) |
| Upload stalls | Stable network; keep tab focused; see [Troubleshooting](./troubleshooting.md) |
| Stamp capacity | Top up or pick a deeper batch — [Postage stamps](./postage-stamps.md) |

---

_Related: [ZIP file upload](./zip-file-upload.md) · [Webpage upload](./webpage-upload.md) · [Single file upload](./single-file-upload.md)_
