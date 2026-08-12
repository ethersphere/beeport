# NFT collection upload guide

Upload an NFT collection ZIP; Beeport uploads images and metadata separately and rewrites metadata image URLs to point at the uploaded images on Swarm.

## ZIP structure (required)

```
nft-collection.zip
├── images/          ← all image files, directly in the folder (no subfolders)
│   ├── 1.png
│   ├── 2.jpg
│   └── …
└── json/            ← one metadata JSON per token, valid JSON
    ├── 1.json
    ├── 2.json
    └── …
```

- Folder names `images` and `json` are case-insensitive but must be top-level.
- Image and JSON filenames should correspond (`1.png` ↔ `1.json`).
- Any common image format works (PNG, JPG, GIF, SVG, WebP…).

## How it works

```
ZIP → extract → TAR of images → upload → images reference
    → rewrite image URLs in JSON → TAR of metadata → upload → metadata reference
```

You get **two references**. In each JSON, `image` / `image_url` fields are rewritten regardless of their original form:

```json
"image": "1.png"           → "https://bzz.link/bzz/<IMAGES_REF>/1.png"
"image": "./images/1.png"  → "https://bzz.link/bzz/<IMAGES_REF>/1.png"
"image_url": "assets/1.jpg"→ "https://bzz.link/bzz/<IMAGES_REF>/1.jpg"
```

Invalid JSON files are skipped; unmatched files don't abort the run.

## Steps

1. Connect wallet; leave **Multiple files separately** and **folder** unchecked (single-file mode).
2. Choose the ZIP; check **Upload NFT collection** (appears for `.zip` only; mutually exclusive with **Serve uncompressed**).
3. Select a stamp with capacity for images + metadata → **Upload**.
4. Note both references from the result.

## Using the references

```text
https://bzz.link/bzz/<IMAGES_REF>/1.png       ← individual image
https://bzz.link/bzz/<METADATA_REF>/1.json    ← individual metadata
https://bzz.link/bzz/<METADATA_REF>/          ← browse all metadata
```

Contract `baseURI` example:

```solidity
string public baseURI = "https://bzz.link/bzz/<METADATA_REF>/";

function tokenURI(uint256 tokenId) public view returns (string memory) {
    return string(abi.encodePacked(baseURI, tokenId.toString(), ".json"));
}
```

## Troubleshooting

| Error | Fix |
| ----- | --- |
| "No images found in the images folder" | `images/` must exist at top level with files directly inside |
| "No JSON metadata files found" | `json/` must exist with valid `.json` files |
| Upload fails mid-run | Stamp capacity, connection, or gateway — see [Troubleshooting](./troubleshooting.md) |
| Images not loading from metadata | Give the network a few minutes; check filename matching between `images/` and `json/` |

Very large collections (thousands of items / multi-GB) take a while and must keep the tab open; consider splitting into batches. Size caps in [File formats & limits](./file-formats-limits.md).

---

_Related: [Archive processing](./archive-processing.md) · [ZIP file upload](./zip-file-upload.md)_
