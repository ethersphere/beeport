# Single File Upload Guide

## Overview

Single file upload is the most basic upload feature, allowing you to upload individual files to the Swarm network. This is perfect for documents, images, videos, or any other single file you want to store on Swarm.

## How to Upload a Single File

### Step 1: Prepare Your File

- Any file type is supported (images, documents, videos, etc.)
- File size recommendations:
  - **Small files** (< 100MB): Upload quickly
  - **Large files** (100MB - 2GB): May take several minutes
  - **Very large files** (> 2GB): Ensure stable internet connection

### Step 2: Access Upload Interface

1. Connect your wallet
2. Navigate to the Upload section
3. Ensure "Upload multiple files" is **unchecked**

### Step 3: Select Your File

1. Click **"Choose file"**
2. Select your file from your computer
3. The file name and size will be displayed

### Step 4: Configure Options

#### For Archive Files (.zip, .tar, .gz)

If you upload an archive file, you'll see additional options:

**Serve Uncompressed** ☐

- **Checked**: Extracts the archive and serves individual files
- **Unchecked**: Uploads the archive as-is
- _Recommended: Check this for better file access_

#### For TAR Files

**Upload as Webpage** ☐

- **Checked**: Configures the upload as a static website
- **Unchecked**: Regular file upload
- _Use this for website deployments_

#### For ZIP Files

**Upload NFT Collection** ☐

- **Checked**: Processes as NFT collection (requires specific folder structure)
- **Unchecked**: Regular ZIP processing
- _See [NFT Collection Guide](./nft-collection-upload.md) for details_

### Step 5: Select Postage Stamp

1. Choose an existing stamp or create a new one
2. Ensure the stamp has sufficient capacity for your file
3. Check stamp expiration date

### Step 6: Upload

1. Click **"Upload"** button
2. Monitor progress bar
3. Wait for completion

## Upload Process

### Progress Stages

1. **Uploading...** - File transfer in progress
2. **Distributing file chunks...** - Swarm network distribution
3. **Complete** - Upload successful

### What You Get

After successful upload:

- **Reference Hash**: Unique identifier for your file
- **Access URL**: Direct link to view/download your file
- **Copy/Share Options**: Easy sharing tools

## File Access

### Direct Access

```
https://bzz.link/bzz/YOUR_REFERENCE_HASH/filename.ext
```

### For Archives (if "Serve Uncompressed" was checked)

```
https://bzz.link/bzz/YOUR_REFERENCE_HASH/
```

This shows a directory listing of extracted files.

## Best Practices

### File Preparation

- **Compress large files** before upload to save bandwidth
- **Use descriptive filenames** for better organization
- **Check file integrity** before uploading

### Upload Settings

- **Enable "Serve Uncompressed"** for archives you want to browse
- **Use "Upload as Webpage"** for HTML/CSS/JS projects
- **Choose appropriate postage stamp size** for your file

### Network Considerations

- **Stable internet connection** for large files
- **Keep browser tab open** during upload
- **Don't close browser** until upload completes

## Supported File Types

| Category  | Extensions                    | Notes                        |
| --------- | ----------------------------- | ---------------------------- |
| Images    | .jpg, .png, .gif, .svg, .webp | All formats supported        |
| Documents | .pdf, .doc, .txt, .md         | Any document type            |
| Archives  | .zip, .tar, .gz, .rar, .7z    | Special processing available |
| Videos    | .mp4, .avi, .mov, .webm       | Large files may take time    |
| Audio     | .mp3, .wav, .flac, .ogg       | All audio formats            |
| Code      | .js, .html, .css, .json       | Perfect for web projects     |
| Other     | Any extension                 | No restrictions              |

## File Size Limits

| Size Range   | Upload Time  | Recommendations                 |
| ------------ | ------------ | ------------------------------- |
| < 10MB       | Seconds      | Quick uploads                   |
| 10MB - 100MB | 1-5 minutes  | Standard files                  |
| 100MB - 1GB  | 5-30 minutes | Ensure stable connection        |
| 1GB - 10GB   | 30+ minutes  | Use compression, stable network |
| > 10GB       | Hours        | Consider splitting into parts   |

## Troubleshooting

### Common Issues

**Upload Fails**

- Check internet connection
- Verify postage stamp validity
- Try smaller file size
- Refresh page and retry

**Slow Upload**

- Large file size is normal
- Check network speed
- Avoid other bandwidth-heavy activities

**File Not Accessible**

- Wait a few minutes for network propagation
- Try different gateway (bzz.link alternatives)
- Verify reference hash is correct

**Archive Not Extracting**

- Ensure "Serve Uncompressed" is checked
- Verify archive file is not corrupted
- Try re-uploading with different settings

### Error Messages

| Error                | Cause                | Solution               |
| -------------------- | -------------------- | ---------------------- |
| "Missing file"       | No file selected     | Select a file first    |
| "Upload failed"      | Network/server issue | Retry upload           |
| "Insufficient funds" | Postage stamp issue  | Check stamp balance    |
| "File too large"     | Size exceeds limits  | Compress or split file |

## Advanced Features

### Retry Logic

- Automatic retry for failed uploads
- 3 attempts with 5-second delays
- Smart retry only for network errors

### Progress Tracking

- Real-time upload percentage
- Stall detection for large files
- Estimated time remaining

### Upload History

- All uploads automatically saved
- Easy access to previous references
- Organized by date and stamp

---

_Next: Learn about [Multiple File Upload](./multiple-file-upload.md) for batch operations._
