# NFT Collection Upload Guide

## Overview

The NFT Collection upload feature allows you to upload an entire NFT collection to Swarm in a structured way. This feature automatically processes your images and metadata, uploads them separately, and updates the metadata files to reference the uploaded images using bzz.link URLs.

## How It Works

1. **ZIP File Structure**: Upload a ZIP file containing two folders:

   - `images/` - Contains all your NFT image files (PNG, JPG, etc.)
   - `json/` - Contains all your NFT metadata JSON files

2. **Processing Steps**:

   - Extracts the ZIP file
   - Creates a TAR archive of all images (without subfolder structure)
   - Uploads the images TAR to Swarm and gets a reference
   - Modifies all JSON metadata files to update image URLs to use bzz.link format
   - Creates a TAR archive of the modified metadata files
   - Uploads the metadata TAR to Swarm and gets a second reference

3. **Result**: You get two references:
   - **Images Reference**: Points to all your images
   - **Metadata Reference**: Points to all your metadata with updated image URLs

## ZIP File Structure

### Required Structure

```
nft-collection.zip
├── images/
│   ├── 1.png
│   ├── 2.png
│   ├── 3.jpg
│   ├── 4.gif
│   └── ...
└── json/
    ├── 1.json
    ├── 2.json
    ├── 3.json
    ├── 4.json
    └── ...
```

### Important Requirements

- **Exactly two folders**: `images` and `json` (case-insensitive)
- **Matching filenames**: Image and JSON files should have corresponding names
- **No subfolders**: Files should be directly in the images/ and json/ folders
- **Any image format**: PNG, JPG, GIF, SVG, WebP, etc.
- **Valid JSON**: All .json files must contain valid JSON metadata

## Metadata JSON Format

### Before Processing

Your JSON metadata files should contain an `image` property:

```json
{
  "name": "Cool NFT #1",
  "description": "An awesome NFT from our collection",
  "image": "1.png",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Blue"
    },
    {
      "trait_type": "Eyes",
      "value": "Laser"
    }
  ]
}
```

### After Processing

The system automatically updates image URLs:

```json
{
  "name": "Cool NFT #1",
  "description": "An awesome NFT from our collection",
  "image": "https://bzz.link/bzz/YOUR_IMAGES_REFERENCE/1.png",
  "attributes": [
    {
      "trait_type": "Background",
      "value": "Blue"
    },
    {
      "trait_type": "Eyes",
      "value": "Laser"
    }
  ]
}
```

### Supported Image Fields

The processor automatically updates these common NFT metadata image fields:

- `image` (most common)
- `image_url` (alternative format)

## How to Upload NFT Collection

### Step 1: Prepare Your Collection

1. **Organize images** in `images/` folder
2. **Create metadata** in `json/` folder
3. **Ensure filename matching** (1.png ↔ 1.json)
4. **Create ZIP file** with both folders

### Step 2: Upload Process

1. **Connect your wallet** and navigate to Upload section
2. **Ensure "Upload multiple files" is unchecked** (single file mode)
3. **Select your ZIP file**
4. **Check "Upload NFT collection"** ✓ (this checkbox only appears for ZIP files)
5. **Select postage stamp** with sufficient capacity
6. **Click "Upload"**

### Step 3: Monitor Progress

You'll see detailed progress updates:

- **Extracting NFT collection...** (10%)
- **Creating images archive...** (20%)
- **Uploading images...** (30%)
- **Processing metadata...** (60%)
- **Creating metadata archive...** (80%)
- **Uploading metadata...** (90%)
- **NFT collection upload complete!** (100%)

### Step 4: Get Your References

After successful upload, you'll receive:

- **Images Reference**: Access to all images
- **Metadata Reference**: Access to all metadata with updated URLs
- **Summary**: Count of processed images and metadata files

## Results and Access

### Images Access

Individual images are accessible at:

```
https://bzz.link/bzz/IMAGES_REFERENCE/1.png
https://bzz.link/bzz/IMAGES_REFERENCE/2.jpg
https://bzz.link/bzz/IMAGES_REFERENCE/3.gif
```

### Metadata Access

Individual metadata files are accessible at:

```
https://bzz.link/bzz/METADATA_REFERENCE/1.json
https://bzz.link/bzz/METADATA_REFERENCE/2.json
https://bzz.link/bzz/METADATA_REFERENCE/3.json
```

### Collection Browsing

Browse all files in each collection:

```
https://bzz.link/bzz/IMAGES_REFERENCE/     (all images)
https://bzz.link/bzz/METADATA_REFERENCE/   (all metadata)
```

## Use Cases

### NFT Marketplaces

- Upload entire collections for marketplace listing
- Metadata automatically points to decentralized images
- No need for centralized image hosting

### NFT Minting

- Use metadata reference for smart contract minting
- Images hosted on decentralized network
- Permanent, censorship-resistant storage

### Collection Management

- Organize large NFT collections efficiently
- Batch upload hundreds or thousands of NFTs
- Maintain proper metadata-image relationships

### IPFS Migration

- Migrate from IPFS to Swarm
- Automatic URL rewriting from local paths
- Preserve collection structure and metadata

## Best Practices

### File Organization

- **Use sequential numbering**: 1.png, 2.png, 3.png...
- **Consistent file extensions**: All images same format when possible
- **Descriptive metadata**: Include rich attributes and descriptions
- **Verify JSON validity**: Test JSON files before zipping

### Image Optimization

- **Compress images** appropriately for web use
- **Use consistent dimensions** across collection
- **Choose appropriate formats**: PNG for art, JPG for photos
- **Consider file sizes** for faster loading

### Metadata Standards

- **Follow OpenSea standards** for marketplace compatibility
- **Include all required fields**: name, description, image
- **Use consistent attribute naming** across collection
- **Add rarity information** in attributes

### Collection Size

| Collection Size   | Recommended Approach | Notes                  |
| ----------------- | -------------------- | ---------------------- |
| 1-100 NFTs        | Single upload        | Quick processing       |
| 100-1,000 NFTs    | Single upload        | May take 10-30 minutes |
| 1,000-10,000 NFTs | Consider splitting   | Large ZIP files        |
| 10,000+ NFTs      | Split into batches   | Multiple uploads       |

## Advanced Features

### Automatic URL Rewriting

The system intelligently handles various image reference formats:

```json
// These all get converted properly:
"image": "1.png"                    → "https://bzz.link/bzz/REF/1.png"
"image": "./images/1.png"           → "https://bzz.link/bzz/REF/1.png"
"image": "images/1.png"             → "https://bzz.link/bzz/REF/1.png"
"image_url": "assets/1.jpg"         → "https://bzz.link/bzz/REF/1.jpg"
```

### Error Handling

- **Missing folders**: Clear error if images/ or json/ folders missing
- **File mismatches**: Continues processing even if some files don't match
- **Invalid JSON**: Skips corrupted files, processes valid ones
- **Upload failures**: Automatic retry with detailed error messages

### Batch Processing

- **Sequential uploads**: Images first, then metadata
- **Progress tracking**: Real-time updates for each stage
- **Memory efficient**: Processes large collections without browser crashes
- **Resume capability**: Can retry failed uploads

## Troubleshooting

### Common Issues

**"No images found in the images folder"**

- Ensure ZIP contains `images/` folder (not `Images/` or `image/`)
- Verify folder contains actual image files
- Check that files aren't in subfolders within images/

**"No JSON metadata files found in the json folder"**

- Ensure ZIP contains `json/` folder
- Verify folder contains .json files
- Check JSON files are valid (use JSON validator)

**"Upload failed" during processing**

- Check internet connection stability
- Verify postage stamp has sufficient capacity
- Try smaller collection size
- Ensure ZIP file isn't corrupted

**Images not loading in metadata**

- Wait a few minutes for Swarm network propagation
- Check that image filenames in JSON match actual image files
- Verify bzz.link gateway is accessible

### File Size Considerations

- **Large collections** (>1GB) may take significant time
- **Many small files** process faster than few large files
- **ZIP compression** helps reduce upload time
- **Stable internet** essential for large collections

### Validation Tips

- **Test ZIP structure** by extracting locally first
- **Validate JSON files** using online JSON validators
- **Check filename matching** between images and metadata
- **Verify image file integrity** before zipping

## Integration Examples

### Smart Contract Integration

```solidity
// Use metadata reference in your NFT contract
string public baseURI = "https://bzz.link/bzz/YOUR_METADATA_REFERENCE/";

function tokenURI(uint256 tokenId) public view returns (string memory) {
    return string(abi.encodePacked(baseURI, tokenId.toString(), ".json"));
}
```

### Frontend Integration

```javascript
// Fetch NFT metadata
const metadataUrl = `https://bzz.link/bzz/${metadataReference}/${tokenId}.json`;
const response = await fetch(metadataUrl);
const metadata = await response.json();

// Image URL is already updated in metadata
const imageUrl = metadata.image; // Points to Swarm
```

### Marketplace Listing

```javascript
// List collection on marketplace
const collectionData = {
  name: 'My NFT Collection',
  description: 'Amazing collection on Swarm',
  image: `https://bzz.link/bzz/${imagesReference}/1.png`, // Cover image
  external_url: `https://bzz.link/bzz/${metadataReference}/`,
  // ... other marketplace fields
};
```

---

_Next: Learn about [Archive Processing](./archive-processing.md) for technical details on file handling._
