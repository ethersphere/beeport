# Webpage upload guide

Deploy a **static website** on Swarm with proper index and error document headers.

## How Beeport serves websites

Website mode sets Swarm collection headers so gateways serve:

- **`index.html`** at the collection root
- **`error.html`** for missing paths (when present in the archive)

You get this automatically when:

- Using **folder upload** (always), or
- Uploading a single archive with **Serve uncompressed** checked.

There is no standalone “Upload as webpage” checkbox in the current UI.

## Prepare your site

```text
my-website/
├── index.html          ← required for root URL
├── error.html          ← recommended
├── css/
├── js/
└── images/
```

Use **relative** paths in HTML/CSS/JS (`href="css/style.css"`, not `/css/...`).

## Option A — Folder (recommended for local projects)

1. Check **Multiple files in a folder (one hash, served as a website)**.
2. Select the site folder → upload.

## Option B — ZIP or TAR archive

1. Pack the site (include `index.html` at archive root).
2. Choose the archive as a **single file**.
3. Check **Serve uncompressed**.
4. Upload.

## After upload

```text
https://bzz.link/bzz/<reference>/           → index.html
https://bzz.link/bzz/<reference>/about.html
```

Trailing slash on the root URL helps gateways pick the index document.

## Limitations

Static hosting only — no server-side PHP/Node, databases, or form backends. SPAs (React/Vue builds) work if routing is hash-based or all routes are real files.

## ENS

Link a domain from **History** → **ENS** on website uploads. See [ENS integration](./ens-integration.md).

## Troubleshooting

| Issue | Check |
| ----- | ----- |
| Blank root | `index.html` at archive/folder root; try URL with trailing `/` |
| Broken assets | Relative paths; exact filename case |
| 404 page wrong | Add `error.html` at root |

More: [Troubleshooting](./troubleshooting.md) · [Archive processing](./archive-processing.md)

---

_Next: [NFT collection upload](./nft-collection-upload.md) for structured NFT ZIPs._
