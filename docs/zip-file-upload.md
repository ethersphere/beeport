# ZIP File Upload Guide

## Overview

ZIP file upload provides intelligent processing for ZIP archives with automatic website creation, system file filtering, and optimized TAR conversion. The system can automatically generate index.html files and configure archives as browsable websites.

## Automatic Processing Features

When you upload a ZIP file, the system automatically:

1. **Detects file type**: Recognizes ZIP archives for special processing
2. **Smart extraction**: Converts to TAR format for better web serving
3. **Auto-website mode**: Automatically uploads as website if uncompressed
4. **Index generation**: Creates index.html if missing
5. **System file filtering**: Removes macOS/Windows metadata files
6. **Filename compatibility**: Handles long filenames for TAR format

## Upload Behavior (Simplified)

### ZIP File Processing

**Compressed ZIP**: Uploaded as-is (single downloadable archive)
**Uncompressed ZIP**: Automatically extracted → TAR → Website

The system now automatically detects the best processing method:

- **Upload NFT Collection ☐**: Available for NFT-structured ZIPs
  - **Requirements**: ZIP must contain `images/` and `json/` folders
  - **See**: [NFT Collection Upload Guide](./nft-collection-upload.md) for details

_Note: "Upload as webpage" option has been removed as website mode is now automatically detected_

## Processing Workflow

### Uncompressed ZIP Processing

```
ZIP File → Extract → Filter System Files → Generate Index (if needed) → Create TAR → Upload as Website
```

**Result**: Website accessible at:

```
https://bzz.link/bzz/REFERENCE/                  → Auto-generated index.html
https://bzz.link/bzz/REFERENCE/filename1.txt     → Individual files
https://bzz.link/bzz/REFERENCE/filename2.jpg     → Individual files
https://bzz.link/bzz/REFERENCE/folder/file.html  → Folder structure preserved
```

### Compressed ZIP Upload

```
ZIP File → Upload as-is → Single Archive Download
```

**Result**: ZIP downloadable at:

```
https://bzz.link/bzz/REFERENCE/archive.zip
```

## Automatic Index Generation

### When Index is Created

The system generates `index.html` when:

- ZIP is uploaded uncompressed (extracted)
- No existing `index.html` or `index.htm` found
- Archive contains files that benefit from web navigation

### Generated Index Features

- **Professional branding**: Swarm color scheme and styling
- **Complete file listing**: All files with clickable links
- **Responsive design**: Works on desktop and mobile
- **New tab links**: Files open in new tabs for better UX
- **File type icons**: Visual indicators for different file types

## System File Filtering

### Automatic Cleanup

The system automatically removes:

#### macOS Metadata

- **PAX Headers**: `PaxHeader/` directories and contents
- **macOS Resource forks**: `__MACOSX/` folders and all contents
- **Finder metadata**: `.DS_Store` files throughout archive
- **Resource forks**: `._filename` files

#### Windows Metadata

- **Thumbnail cache**: `Thumbs.db` files
- **System attributes**: Windows-specific metadata

### Benefits

- **Cleaner archives**: No system clutter in file listings
- **Smaller uploads**: Reduced archive size
- **Cross-platform**: Consistent behavior across operating systems
- **Professional results**: Clean, organized file access

## Long Filename Handling

### TAR Compatibility

TAR format has a 100-character filename limit. The system handles this automatically:

#### Smart Filename Truncation

```
❌ Original long filename (120+ chars):
zara808_beautiful_background_high_resolution_8k_blurred_deep_pur_d6102566-f5d5-4d43-ab94-3cc03d179613.png

✅ Auto-shortened for TAR (≤100 chars):
zara808_beautiful_background_high_resolution_8k_blurred_deep_pur_d610256_a1b2c3d4.png
```

#### Truncation Strategy

1. **Preserve file extension**: Always maintained for proper file handling
2. **Preserve directory structure**: Folder paths kept intact
3. **Add unique hash**: Prevents filename collisions
4. **Maintain readability**: Keeps meaningful part of filename

## File Structure Handling

### Folder Preservation

When "Serve Uncompressed" is checked, folder structure is preserved:

**Original ZIP structure**:

```
my-archive.zip
├── documents/
│   ├── report.pdf
│   └── notes.txt
├── images/
│   ├── photo1.jpg
│   └── photo2.png
└── readme.txt
```

**Accessible URLs**:

```
https://bzz.link/bzz/REFERENCE/documents/report.pdf
https://bzz.link/bzz/REFERENCE/documents/notes.txt
https://bzz.link/bzz/REFERENCE/images/photo1.jpg
https://bzz.link/bzz/REFERENCE/images/photo2.png
https://bzz.link/bzz/REFERENCE/readme.txt
```

### Directory Browsing

Root directory shows file listing:

```
https://bzz.link/bzz/REFERENCE/
```

Shows:

- documents/ (folder)
- images/ (folder)
- readme.txt (file)

## Best Practices

### ZIP File Preparation

- **Use descriptive filenames** for better organization
- **Avoid special characters** in file/folder names
- **Keep reasonable file sizes** (< 2GB recommended)
- **Test ZIP integrity** before uploading

### Folder Organization

- **Logical structure**: Group related files in folders
- **Consistent naming**: Use clear, consistent naming conventions
- **Avoid deep nesting**: Keep folder depth reasonable
- **Include documentation**: Add README files for context

### File Types

All file types are supported in ZIP archives:

- **Documents**: PDF, DOC, TXT, MD
- **Images**: JPG, PNG, GIF, SVG
- **Code**: HTML, CSS, JS, JSON
- **Media**: MP4, MP3, etc.
- **Archives**: Even nested ZIP files (though not recommended)

## Use Cases

### Document Collections

```
project-docs.zip
├── specifications/
│   ├── requirements.pdf
│   └── design.md
├── reports/
│   ├── progress-report.pdf
│   └── final-report.pdf
└── README.md
```

### Software Releases

```
software-v1.0.zip
├── bin/
│   └── application.exe
├── docs/
│   ├── manual.pdf
│   └── api-reference.html
├── examples/
│   └── sample-code.js
└── LICENSE.txt
```

### Media Archives

```
photo-album.zip
├── 2023/
│   ├── january/
│   └── february/
├── 2024/
│   ├── march/
│   └── april/
└── index.html
```

### Website Backup

```
website-backup.zip
├── css/
├── js/
├── images/
├── pages/
├── index.html
└── sitemap.xml
```

## Advanced Features

### Nested Archive Handling

- **ZIP in ZIP**: Outer ZIP extracted, inner ZIP remains as file
- **Mixed archives**: TAR, GZ files within ZIP are preserved
- **Selective extraction**: Only the main ZIP is processed

### Large File Support

- **Streaming extraction**: Efficient processing of large ZIP files
- **Memory management**: Handles large archives without browser crashes
- **Progress tracking**: Real-time extraction progress
- **Timeout handling**: Extended timeouts for large files

### Error Recovery

- **Partial extraction**: Continues even if some files fail
- **Corruption handling**: Skips corrupted files, processes valid ones
- **Retry logic**: Automatic retry for network-related failures
- **Detailed logging**: Clear error messages for troubleshooting

## Comparison with Other Upload Types

| Feature            | ZIP Upload              | Multiple Files        | Single File           |
| ------------------ | ----------------------- | --------------------- | --------------------- |
| File organization  | ✅ Preserves folders    | ❌ Flat structure     | ❌ Single file only   |
| Batch processing   | ✅ All at once          | ✅ Sequential         | ❌ One at a time      |
| Special processing | ✅ Website, NFT options | ❌ None               | ✅ Archive extraction |
| Upload speed       | ✅ Single transfer      | ❌ Multiple transfers | ✅ Single transfer    |
| File access        | ✅ Individual files     | ✅ Individual files   | ✅ Single file        |

## Troubleshooting

### Common Issues

**ZIP file won't extract**

- Verify ZIP file isn't corrupted
- Check file size isn't too large (>10GB)
- Ensure stable internet connection
- Try re-creating the ZIP file

**Some files missing after extraction**

- Check for file name conflicts (case sensitivity)
- Verify ZIP doesn't contain unsupported characters
- Look for files with very long paths
- Check browser console for specific errors

**Slow processing**

- Large ZIP files take time to extract
- Many small files process slower than few large files
- Network speed affects upload time
- Keep browser tab open during processing

**Files not accessible**

- Wait a few minutes for Swarm network propagation
- Check reference hash is correct
- Verify file paths match ZIP structure
- Try different Swarm gateway

### Error Messages

| Error                   | Cause                 | Solution                             |
| ----------------------- | --------------------- | ------------------------------------ |
| "Failed to extract ZIP" | Corrupted archive     | Re-create ZIP file                   |
| "ZIP file too large"    | Size exceeds limits   | Split into smaller archives          |
| "Invalid ZIP format"    | Not a valid ZIP file  | Check file format                    |
| "Extraction timeout"    | Large file processing | Try smaller ZIP or better connection |

## Performance Tips

### Optimization Strategies

- **Compress efficiently**: Use appropriate compression levels
- **Remove unnecessary files**: Clean up before zipping
- **Organize logically**: Group related files together
- **Test locally**: Verify ZIP structure before uploading

### Size Recommendations

| ZIP Size     | Processing Time | Recommendations          |
| ------------ | --------------- | ------------------------ |
| < 50MB       | 1-2 minutes     | Quick processing         |
| 50MB - 500MB | 2-10 minutes    | Standard uploads         |
| 500MB - 2GB  | 10-30 minutes   | Ensure stable connection |
| 2GB - 10GB   | 30+ minutes     | Consider splitting       |
| > 10GB       | Hours           | Split into multiple ZIPs |

### Network Considerations

- **Stable connection**: Essential for large files
- **Bandwidth**: Higher bandwidth = faster processing
- **Browser resources**: Close other tabs for large uploads
- **Patience**: Large archives take time to process

---

_Next: Learn about [Archive Processing](./archive-processing.md) for technical details on how different archive formats are handled._
