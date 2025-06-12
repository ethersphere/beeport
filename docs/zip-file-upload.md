# ZIP File Upload Guide

## Overview

ZIP file upload provides special processing for ZIP archives, allowing you to extract and serve the contents as individual files or process them for specific use cases like websites or NFT collections.

## Upload Options for ZIP Files

When you select a ZIP file, you'll see several checkbox options:

### 1. Serve Uncompressed ☐

**What it does**: Extracts the ZIP file and converts it to TAR format for better web serving.

- **Checked**: ZIP is extracted, files are accessible individually
- **Unchecked**: ZIP file is uploaded as-is (single downloadable archive)

**Recommended**: ✅ Check this for most use cases

### 2. Upload NFT Collection ☐

**What it does**: Processes ZIP as an NFT collection with automatic metadata processing.

- **Only appears**: When ZIP file is selected
- **Requirements**: ZIP must contain `images/` and `json/` folders
- **See**: [NFT Collection Upload Guide](./nft-collection-upload.md) for details

### 3. Upload as Webpage ☐

**What it does**: Configures the extracted files as a static website.

- **Only appears**: When "Serve Uncompressed" is checked
- **Requirements**: Must contain `index.html` file
- **See**: [Webpage Upload Guide](./webpage-upload.md) for details

## Processing Workflow

### Standard ZIP Upload (Serve Uncompressed ✓)

```
ZIP File → Extract → Create TAR → Upload TAR → Individual File Access
```

**Result**: Files accessible at:

```
https://bzz.link/bzz/REFERENCE/filename1.txt
https://bzz.link/bzz/REFERENCE/filename2.jpg
https://bzz.link/bzz/REFERENCE/folder/file.html
```

### Raw ZIP Upload (Serve Uncompressed ✗)

```
ZIP File → Upload as-is → Single Archive Download
```

**Result**: ZIP downloadable at:

```
https://bzz.link/bzz/REFERENCE/archive.zip
```

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
