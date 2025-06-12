# Multiple File Upload Guide

## Overview

Multiple file upload allows you to upload several files at once to the same postage stamp. Each file gets its own unique reference while sharing the same storage stamp, making it perfect for batch operations and organizing related files.

## How to Upload Multiple Files

### Step 1: Enable Multiple File Mode

1. Connect your wallet
2. Navigate to the Upload section
3. **Check** the "Upload multiple files" checkbox
4. The interface will switch to multiple file mode

### Step 2: Select Your Files

1. Click **"Choose files"** (note the plural)
2. Select multiple files using:
   - **Ctrl+Click** (Windows/Linux) to select individual files
   - **Cmd+Click** (Mac) to select individual files
   - **Shift+Click** to select a range of files
   - **Ctrl+A/Cmd+A** to select all files in a folder

### Step 3: Review Selected Files

After selection, you'll see:

- **File count**: "X files selected"
- **File list**: Names and sizes of all selected files
- **Total size**: Combined size of all files
- **Size warnings**: Alerts for very large uploads

### Step 4: Configure Settings

Multiple file uploads have simplified settings:

- No archive processing options (files uploaded as-is)
- No webpage configuration (individual files)
- No NFT collection processing (use single file mode for that)

### Step 5: Select Postage Stamp

1. Choose a stamp with sufficient capacity for all files
2. Consider the total size of all files combined
3. Ensure stamp won't expire soon

### Step 6: Upload

1. Click **"Upload X files"** button
2. Monitor overall progress
3. Watch individual file results

## Upload Process

### Sequential Processing

Files are uploaded one by one to avoid overwhelming the API:

1. **File 1/X**: First file uploads
2. **File 2/X**: Second file uploads
3. **...continues until all files complete**

### Progress Tracking

- **Overall progress**: Shows completion across all files
- **Current file**: Which file is currently uploading
- **Individual results**: Success/failure for each file
- **Real-time updates**: Results appear as files complete

### What You Get

For each successful file:

- **Unique reference hash**: Individual identifier
- **File name**: Original filename preserved
- **Access URL**: Direct link to the file
- **Upload status**: Success or error indication

## Results Screen

### Successful Uploads

Each successful file shows:

```
✓ filename.ext - Success
  Reference: abc123...def456
  [Click to copy reference]
```

### Failed Uploads

Failed files show:

```
✗ filename.ext - Failed
  Error: Network timeout
```

### Mixed Results

If some files succeed and others fail:

- **Green summary**: "X files uploaded successfully"
- **Red summary**: "Y files failed"
- **Individual status**: Each file marked separately

## File Management

### Individual Access

Each file gets its own URL:

```
https://bzz.link/bzz/REFERENCE_HASH/filename.ext
```

### Upload History

- All successful uploads saved individually
- Each file appears as separate history entry
- Organized by upload session and date
- Easy reference copying and sharing

## Best Practices

### File Selection

- **Group related files** for easier management
- **Check total size** before uploading
- **Use consistent naming** for better organization
- **Avoid duplicate filenames** in the same batch

### Batch Size Recommendations

| File Count   | Total Size | Upload Time  | Notes                                   |
| ------------ | ---------- | ------------ | --------------------------------------- |
| 1-10 files   | < 100MB    | 1-5 minutes  | Ideal batch size                        |
| 10-50 files  | 100MB-1GB  | 5-30 minutes | Good for medium batches                 |
| 50-100 files | 1GB-5GB    | 30+ minutes  | Large batch, ensure stable connection   |
| 100+ files   | > 5GB      | Hours        | Consider splitting into smaller batches |

### Network Considerations

- **Stable internet connection** essential for large batches
- **Keep browser tab open** throughout entire process
- **Avoid other bandwidth-heavy activities** during upload
- **Monitor progress** and be prepared to retry failed files

## Error Handling & Retry

### Automatic Retry

- **Failed uploads automatically retry** (up to 3 attempts)
- **5-second delay** between retry attempts
- **Smart retry logic** only for network-related errors
- **Non-retryable errors** (file corruption) skip retry

### Manual Retry

For files that fail completely:

1. Note which files failed
2. Start a new upload session
3. Select only the failed files
4. Upload again

### Common Failure Reasons

- **Network timeouts**: Large files on slow connections
- **Stamp capacity**: Not enough space for all files
- **File corruption**: Damaged files during selection
- **Browser limits**: Too many files selected at once

## Advanced Features

### Session Management

- **Upload session tracking**: Groups files from same batch
- **Partial completion**: Some files can succeed while others fail
- **Resume capability**: Failed files can be re-uploaded separately

### Progress Optimization

- **Intelligent queuing**: Files processed in optimal order
- **Memory management**: Efficient handling of large batches
- **Background processing**: Continues even if you switch tabs

### Stamp Utilization

- **Shared stamp usage**: All files use the same postage stamp
- **Efficient space usage**: No wasted stamp capacity
- **Utilization tracking**: Monitor stamp usage across uploads

## Use Cases

### Document Management

- Upload entire document collections
- Organize project files together
- Share multiple reports or presentations

### Media Collections

- Photo albums or galleries
- Video series or episodes
- Audio playlists or podcasts

### Development Projects

- Source code files
- Asset collections (images, fonts, etc.)
- Documentation sets

### Backup Operations

- Personal file backups
- Project archives
- Data migration to Swarm

## Limitations

### What Multiple Upload Can't Do

- **Archive processing**: No ZIP/TAR extraction
- **Webpage creation**: No website configuration
- **NFT collection processing**: Use single file mode instead
- **Folder structure**: Files uploaded individually, not as folders

### Technical Limits

- **Browser memory**: Very large file counts may cause issues
- **API rate limits**: Sequential processing prevents overload
- **Stamp capacity**: Must fit within selected stamp size
- **Network timeouts**: Large files may timeout on slow connections

## Troubleshooting

### All Files Fail

- Check internet connection
- Verify postage stamp validity and capacity
- Try smaller batch size
- Refresh page and retry

### Some Files Fail

- Note failed filenames
- Check individual file sizes
- Retry failed files separately
- Verify files aren't corrupted

### Slow Upload

- Normal for large batches
- Check network speed
- Reduce batch size for faster processing
- Ensure stable connection

### Browser Issues

- **Memory warnings**: Reduce file count
- **Tab crashes**: Restart browser, try smaller batches
- **Progress stuck**: Refresh and retry

---

_Next: Learn about [ZIP File Upload](./zip-file-upload.md) for archive processing._
