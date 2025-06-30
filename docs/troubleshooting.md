# Troubleshooting Guide

## Common Upload Issues

### Upload Fails Immediately

#### "Missing file, postage batch ID, or wallet"

**Cause**: Required components not properly connected or selected.

**Solutions**:

1. **Connect wallet**: Ensure MetaMask or compatible wallet is connected
2. **Select file**: Choose a file before attempting upload
3. **Select postage stamp**: Choose an existing stamp or create a new one
4. **Refresh page**: Sometimes connection state gets out of sync

#### "Upload failed with status 400/500"

**Cause**: Server-side error or invalid request.

**Solutions**:

1. **Check file format**: Ensure file type is supported
2. **Verify stamp validity**: Stamp may be expired or invalid
3. **Try smaller file**: Large files may exceed server limits
4. **Wait and retry**: Temporary server issues

### Network and Connection Issues

#### "Network error during upload"

**Cause**: Internet connection problems or network instability.

**Solutions**:

1. **Check internet connection**: Verify stable internet access
2. **Try different network**: Switch to different WiFi or mobile data
3. **Disable VPN**: VPN may interfere with upload
4. **Close other applications**: Free up bandwidth
5. **Retry upload**: Network issues are often temporary

#### "Upload timeout"

**Cause**: File too large for current connection speed or server timeout.

**Solutions**:

1. **Use faster internet**: Switch to higher bandwidth connection
2. **Compress file**: Reduce file size before uploading
3. **Try during off-peak hours**: Less network congestion
4. **Split large files**: Break into smaller chunks
5. **Keep browser tab active**: Don't switch tabs during upload

### File-Specific Issues

#### "File too large"

**Cause**: File exceeds size limits or stamp capacity.

**Solutions**:

1. **Compress file**: Use ZIP, RAR, or other compression
2. **Choose larger stamp**: Select stamp with more capacity
3. **Split file**: Break into multiple smaller files
4. **Remove unnecessary content**: Clean up file before upload

#### "Invalid file format"

**Cause**: File type not supported or corrupted file.

**Solutions**:

1. **Check file extension**: Ensure file has proper extension
2. **Verify file integrity**: Try opening file locally first
3. **Convert format**: Use different file format if needed
4. **Re-create file**: Generate new version of the file

### Postage Stamp Issues

#### "Insufficient funds" or "Stamp capacity exceeded"

**Cause**: Postage stamp doesn't have enough capacity for the file.

**Solutions**:

1. **Check stamp utilization**: View stamp details for available space
2. **Top up stamp**: Add more capacity to existing stamp
3. **Create new stamp**: Purchase larger stamp
4. **Use different stamp**: Select stamp with more capacity

#### "Stamp not found" or "Invalid batch ID"

**Cause**: Stamp doesn't exist or has expired.

**Solutions**:

1. **Verify stamp ID**: Check stamp ID is correct
2. **Check expiration**: Stamp may have expired
3. **Create new stamp**: Purchase fresh postage stamp
4. **Wait for propagation**: New stamps may take time to be recognized

### Browser and Interface Issues

#### "Page not responding" or "Browser crash"

**Cause**: Large files or many files overwhelming browser memory.

**Solutions**:

1. **Close other tabs**: Free up browser memory
2. **Restart browser**: Clear memory and start fresh
3. **Use smaller batches**: Upload fewer files at once
4. **Try different browser**: Chrome, Firefox, Safari, Edge
5. **Clear browser cache**: Remove stored data

#### "Upload progress stuck"

**Cause**: Browser or network issue preventing progress updates.

**Solutions**:

1. **Wait patiently**: Large files may appear stuck but are processing
2. **Check network activity**: Look for ongoing data transfer
3. **Refresh page**: Restart upload process
4. **Try incognito mode**: Avoid extension interference

### Archive Processing Issues

#### "Failed to extract ZIP/TAR"

**Cause**: Corrupted archive or unsupported compression method.

**Solutions**:

1. **Test archive locally**: Extract on your computer first
2. **Re-create archive**: Generate new ZIP/TAR file
3. **Use standard compression**: Avoid exotic compression methods
4. **Check file names**: Avoid special characters in filenames

#### "Some files missing after extraction"

**Cause**: File name conflicts or extraction errors.

**Solutions**:

1. **Check for duplicates**: Remove duplicate filenames
2. **Avoid special characters**: Use only letters, numbers, hyphens
3. **Verify archive structure**: Ensure proper folder organization
4. **Test with smaller archive**: Try subset of files first

### NFT Collection Issues

#### "No images found in images folder"

**Cause**: ZIP doesn't contain properly structured images folder.

**Solutions**:

1. **Check folder name**: Must be exactly "images" (case-insensitive)
2. **Verify folder contents**: Ensure images are directly in folder
3. **Check file formats**: Use standard image formats (PNG, JPG, GIF)
4. **Avoid subfolders**: Images should be directly in images/ folder

#### "No JSON metadata files found"

**Cause**: ZIP doesn't contain properly structured json folder.

**Solutions**:

1. **Check folder name**: Must be exactly "json" (case-insensitive)
2. **Verify JSON format**: Use JSON validator to check files
3. **Check file extensions**: Files must end with .json
4. **Ensure valid JSON**: Fix syntax errors in metadata files

### Webpage Upload Issues

#### "Website not loading"

**Cause**: Missing index.html or incorrect configuration.

**Solutions**:

1. **Include index.html**: Must be in root of archive
2. **Check file paths**: Use relative paths in HTML/CSS
3. **Verify archive structure**: Ensure proper website organization
4. **Test locally**: Open files in browser before uploading

#### "Broken links or missing assets"

**Cause**: Incorrect file paths or missing files.

**Solutions**:

1. **Use relative paths**: Avoid absolute URLs
2. **Check case sensitivity**: Filenames must match exactly
3. **Include all assets**: Ensure CSS, JS, images are in archive
4. **Test file structure**: Verify all links work locally

## Error Code Reference

### HTTP Status Codes

| Code | Meaning               | Common Causes                    | Solutions                             |
| ---- | --------------------- | -------------------------------- | ------------------------------------- |
| 400  | Bad Request           | Invalid file or parameters       | Check file format and settings        |
| 401  | Unauthorized          | Wallet not connected             | Connect wallet and sign message       |
| 403  | Forbidden             | Invalid signature or permissions | Reconnect wallet, retry signing       |
| 404  | Not Found             | Stamp or endpoint not found      | Verify stamp ID, check network        |
| 413  | Payload Too Large     | File exceeds size limits         | Compress file or use smaller file     |
| 422  | Unprocessable Entity  | Stamp not ready or invalid       | Wait for stamp to be usable           |
| 429  | Too Many Requests     | Rate limiting                    | Wait and retry later                  |
| 500  | Internal Server Error | Server-side issue                | Retry later or contact support        |
| 502  | Bad Gateway           | Network routing issue            | Try different network or retry        |
| 503  | Service Unavailable   | Server overloaded                | Wait and retry later                  |
| 504  | Gateway Timeout       | Request took too long            | Use faster connection or smaller file |

### Application Error Messages

| Error Message                | Cause                        | Solution                   |
| ---------------------------- | ---------------------------- | -------------------------- |
| "Failed to process archive"  | Corrupted or invalid archive | Re-create archive file     |
| "Stamp utilization exceeded" | Not enough stamp capacity    | Use larger stamp or top up |
| "Upload session expired"     | Upload took too long         | Restart upload process     |
| "File validation failed"     | File corrupted or invalid    | Check file integrity       |
| "Network request failed"     | Connection issue             | Check internet and retry   |
| "Browser memory exceeded"    | Too many/large files         | Use smaller batches        |

## Performance Optimization

### For Large Files (>1GB)

1. **Stable connection**: Use wired internet when possible
2. **Close other applications**: Free up bandwidth and memory
3. **Use compression**: Reduce file size before upload
4. **Monitor progress**: Keep browser tab active
5. **Plan timing**: Upload during off-peak hours

### For Many Files (>100 files)

1. **Batch uploads**: Split into smaller groups
2. **Use ZIP archives**: More efficient than multiple individual files
3. **Organize files**: Group related files together
4. **Remove duplicates**: Clean up before uploading
5. **Monitor browser memory**: Watch for performance issues

### For Slow Networks

1. **Compress aggressively**: Use maximum compression
2. **Upload during off-peak**: Less network congestion
3. **Use mobile data**: Sometimes faster than WiFi
4. **Split large files**: Break into manageable chunks
5. **Be patient**: Allow extra time for completion

## Browser-Specific Issues

### Chrome

- **Memory issues**: Clear cache, restart browser
- **Extension conflicts**: Try incognito mode
- **Security warnings**: Allow site permissions

### Firefox

- **Upload limits**: Check about:config settings
- **Memory management**: Enable strict memory mode
- **Security settings**: Adjust privacy settings

### Safari

- **File handling**: Enable file downloads
- **Memory limits**: Close other tabs
- **Security restrictions**: Allow site permissions

### Edge

- **Compatibility mode**: Disable IE compatibility
- **Security settings**: Adjust SmartScreen settings
- **Memory management**: Clear browser data

## Getting Help

### Before Contacting Support

1. **Try basic solutions**: Refresh, reconnect wallet, retry
2. **Check browser console**: Look for error messages
3. **Test with different file**: Isolate file-specific issues
4. **Document the issue**: Note exact error messages
5. **Try different browser**: Rule out browser-specific issues

### Information to Provide

When reporting issues, include:

- **Browser and version**: Chrome 120, Firefox 115, etc.
- **Operating system**: Windows 11, macOS 14, Ubuntu 22.04
- **File details**: Size, type, name
- **Error messages**: Exact text of any errors
- **Steps to reproduce**: What you did before the error
- **Network details**: Connection type and speed
- **Wallet information**: Type and version (without private keys!)

### Self-Diagnosis Tools

1. **Browser developer tools**: Check console for errors
2. **Network tab**: Monitor upload progress and failures
3. **File validation**: Test files locally before upload
4. **Connection test**: Verify internet speed and stability
5. **Wallet connection**: Ensure proper wallet connectivity

---

_For specific feature issues, see the individual guides: [Single File](./single-file-upload.md), [Multiple Files](./multiple-file-upload.md), [ZIP Files](./zip-file-upload.md), [Webpages](./webpage-upload.md), [NFT Collections](./nft-collection-upload.md)_
