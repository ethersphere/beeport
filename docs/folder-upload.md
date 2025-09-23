# Folder Upload Guide

## Overview

Folder upload is a powerful feature that allows you to upload entire directories to Swarm as a single archive. The system automatically creates TAR archives, handles folder structures, and can automatically generate index.html files for web browsing.

## How Folder Upload Works

### Automatic Website Creation

When you upload a folder, the system:

1. **Scans for index files**: Checks if `index.html` or `index.htm` exists
2. **Auto-generates index**: Creates a branded index.html if none exists
3. **Creates TAR archive**: Packages all files into a single TAR
4. **Uploads as website**: Automatically configures for web browsing
5. **Provides clean URLs**: Files accessible via web browser

### File Processing Pipeline

```
Select Folder → Scan Files → Generate Index (if needed) → Create TAR → Upload as Website
```

## Getting Started

### Step 1: Enable Folder Upload

1. **Connect your wallet** and navigate to Upload tab
2. **Check "Multiple files in a folder (one hash)"** ✓
3. The interface switches to folder selection mode
4. Button text changes to "Select Folder (auto-index)"

### Step 2: Select Your Folder

1. **Click "Select Folder (auto-index)"**
2. **Browser security prompt**: "Allow access to folder contents"
   - This is normal browser security behavior
   - Click "Allow" or "Upload" to proceed
3. **Folder structure preserved**: All subfolders and files included
4. **Automatic filtering**: System metadata files removed

### Step 3: Review and Upload

1. **Folder name displayed**: Shows selected folder name
2. **File processing**: System analyzes folder contents
3. **Index generation**: Creates index.html if missing
4. **Upload progress**: Real-time status updates
5. **Website ready**: Accessible via Swarm gateway

## Automatic Index Generation

### When Index is Created

The system generates `index.html` when:

- No `index.html` or `index.htm` exists in root folder
- Folder contains files that need web navigation
- Upload is processed as a website (automatic for folders)

### Generated Index Features

#### Professional Branding

- **Swarm color scheme**: Black theme with orange highlights
- **Clean typography**: Professional, readable font stack
- **Responsive design**: Works on desktop and mobile
- **Modern styling**: CSS Grid and Flexbox layouts

#### File Navigation

- **Complete file list**: All files in the folder
- **Clickable links**: Direct access to each file
- **File type icons**: Visual indicators for different file types
- **Organized display**: Sorted alphabetically
- **New tab opening**: Links open in new tabs

#### Content Structure

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Folder Name - Swarm Distributed Storage</title>
    <!-- Responsive meta tags -->
    <!-- Swarm-branded CSS -->
  </head>
  <body>
    <header>
      <h1>📁 Folder Name</h1>
      <p>X files available</p>
    </header>

    <main>
      <ul class="file-list">
        <li><a href="file1.jpg">📄 file1.jpg</a></li>
        <li><a href="file2.pdf">📄 file2.pdf</a></li>
        <!-- ... all files ... -->
      </ul>
    </main>

    <footer>
      <a href="https://ethswarm.org">Powered by Swarm</a>
    </footer>
  </body>
</html>
```

## Smart File Filtering

### Automatic Cleanup

The system automatically filters out:

#### macOS Metadata

- **PAX Headers**: `PaxHeader/` directories
- **macOS Metadata**: `__MACOSX/` folders and contents
- **DS Store files**: `.DS_Store` files
- **Resource forks**: `._filename` files

#### Windows Metadata

- **Thumbnail cache**: `Thumbs.db` files

#### Other System Files

- **Hidden files**: Files starting with `.` (configurable)
- **Temporary files**: OS-generated temp files

### Benefits

- **Clean archives**: No system clutter
- **Smaller sizes**: Reduced upload size
- **Cross-platform**: Works consistently across OS
- **Professional results**: Clean file listings

## Filename Compatibility

### TAR Filename Limits

TAR format has a **100-character filename limit**. The system handles this automatically:

#### Smart Truncation

```
❌ Long filename (120 chars):
very_long_filename_that_exceeds_tar_limits_and_would_cause_upload_failures_in_the_swarm_network_d6102566.jpg

✅ Auto-shortened (≤100 chars):
very_long_filename_that_exceeds_tar_limits_and_would_cause_upload_failures_in_the_sw_a1b2c3d4.jpg
```

#### Truncation Strategy

1. **Preserve extension**: File type always maintained
2. **Preserve directory**: Folder structure kept intact
3. **Add unique hash**: Prevents filename collisions
4. **Maintain readability**: Keeps meaningful part of name

### Supported File Types

All file types are supported:

- **Documents**: PDF, DOC, TXT, MD, etc.
- **Images**: JPG, PNG, GIF, SVG, WebP
- **Code**: HTML, CSS, JS, JSON, etc.
- **Media**: MP4, MP3, MOV, etc.
- **Archives**: ZIP, TAR, GZ (nested handling)
- **Any format**: No restrictions on file types

## Folder Structure Examples

### Simple Document Folder

**Local structure**:

```
my-documents/
├── report.pdf
├── presentation.pptx
├── data.xlsx
└── notes.txt
```

**Result**: Browsable website with index showing all 4 files

**URLs**:

```
https://bzz.link/bzz/HASH/           → Generated index.html
https://bzz.link/bzz/HASH/report.pdf → Direct file access
https://bzz.link/bzz/HASH/notes.txt  → Direct file access
```

### Complex Project Folder

**Local structure**:

```
my-project/
├── README.md
├── docs/
│   ├── api.md
│   └── user-guide.md
├── src/
│   ├── index.js
│   ├── utils.js
│   └── components/
│       ├── Header.js
│       └── Footer.js
├── assets/
│   ├── logo.png
│   └── styles.css
└── tests/
    └── test.js
```

**Result**:

- Generated index.html listing all files
- Preserved folder structure
- Web-browsable project archive

### Website Folder

**Local structure** (already has index.html):

```
my-website/
├── index.html          ← Existing index
├── about.html
├── contact.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── images/
    └── logo.png
```

**Result**:

- Uses existing index.html (not auto-generated)
- Full website functionality preserved
- All assets properly linked

## Upload Process

### Progress Stages

1. **Analyzing folder**: Scanning files and structure
2. **Checking for index**: Looking for existing index files
3. **Generating index**: Creating index.html if needed
4. **Creating archive**: Building TAR with all files
5. **Uploading to Swarm**: Transferring to network
6. **Website ready**: Providing access URLs

### Real-time Updates

```
📂 Analyzing folder structure...           [10%]
🔍 Checking for existing index files...    [25%]
📝 Generating index.html...                [40%]
📦 Creating TAR archive...                 [60%]
🚀 Uploading to Swarm network...           [80%]
✅ Website ready! Access via: bzz://...    [100%]
```

### Error Handling

- **File access denied**: Clear browser permissions guidance
- **Large folders**: Progress tracking and timeout handling
- **Corrupt files**: Skip problematic files, continue with rest
- **Network issues**: Automatic retry with exponential backoff

## Advanced Features

### Nested Folder Support

Unlimited folder depth:

```
deep-structure/
├── level1/
│   ├── level2/
│   │   ├── level3/
│   │   │   └── deep-file.txt
│   │   └── file2.txt
│   └── file1.txt
└── root-file.txt
```

All files accessible with preserved paths:

```
https://bzz.link/bzz/HASH/level1/level2/level3/deep-file.txt
```

### Large Folder Handling

- **Memory efficient**: Streaming processing for large folders
- **Progress tracking**: Real-time progress for long uploads
- **Browser stability**: Optimized to prevent browser crashes
- **Cancellation support**: Ability to cancel long-running uploads

### Mixed Content Support

Folders can contain:

- **Regular files**: Documents, images, code
- **Executable files**: Scripts, programs
- **Archive files**: ZIP, TAR files (preserved as-is)
- **Special formats**: Any file type supported

## Browser Compatibility

### Security Permissions

All modern browsers support folder upload but require explicit permission:

#### Chrome/Edge

- Shows: "Allow access to folder contents"
- Security measure: Prevents unauthorized file access
- One-time permission per upload session

#### Firefox

- Shows: "Upload folder" dialog
- Automatic permission for selected folders
- Clear folder selection interface

#### Safari

- Limited support on older versions
- Full support on Safari 14+
- Same permission model as Chrome

### Performance Considerations

| Folder Size | Files  | Expected Time | Browser Impact |
| ----------- | ------ | ------------- | -------------- |
| < 100MB     | < 100  | 1-3 minutes   | Minimal        |
| 100-500MB   | < 500  | 3-10 minutes  | Low            |
| 500MB-2GB   | < 1000 | 10-30 minutes | Moderate       |
| > 2GB       | > 1000 | 30+ minutes   | High\*         |

\*For very large folders, consider splitting into smaller batches

## Use Cases

### Content Publishing

**Blog or Documentation Site**:

```
blog-content/
├── posts/
│   ├── 2024-01-01-welcome.md
│   ├── 2024-01-15-tutorial.md
│   └── 2024-02-01-update.md
├── assets/
│   ├── images/
│   └── css/
└── about.md
```

Result: Browsable content archive with generated index

### Project Sharing

**Code Project**:

```
my-app/
├── src/
├── docs/
├── tests/
├── package.json
├── README.md
└── LICENSE
```

Result: Complete project archive accessible via web

### Media Collections

**Photo Album**:

```
vacation-photos/
├── 2024/
│   ├── january/
│   ├── february/
│   └── march/
├── videos/
└── thumbnail.jpg
```

Result: Browsable photo gallery with automatic index

### Backup Archives

**Personal Backup**:

```
documents-backup/
├── financial/
├── personal/
├── work/
└── archive-info.txt
```

Result: Organized, browsable backup on decentralized storage

## Best Practices

### Folder Organization

1. **Use clear naming**: Descriptive folder and file names
2. **Logical structure**: Group related files together
3. **Include documentation**: Add README files for context
4. **Reasonable depth**: Avoid overly deep folder nesting
5. **Clean before upload**: Remove unnecessary files

### File Management

1. **Check file sizes**: Large files increase upload time
2. **Compress when appropriate**: Reduce image sizes
3. **Remove duplicates**: Clean up redundant files
4. **Test locally**: Verify folder structure works
5. **Include metadata**: Add descriptions where helpful

### Performance Optimization

1. **Batch similar content**: Group related files
2. **Monitor progress**: Keep browser tab active
3. **Stable connection**: Ensure reliable internet
4. **Close other tabs**: Free up browser resources
5. **Restart if needed**: Refresh browser for large uploads

## Troubleshooting

### Common Issues

**Browser asks for folder permission**

- ✅ Normal security behavior
- Click "Allow" or "Upload" to proceed
- Required for folder access

**Upload fails or times out**

- Check internet connection stability
- Try smaller folder or split into batches
- Ensure sufficient postage stamp capacity
- Refresh browser and retry

**Files missing from upload**

- Check for unsupported characters in filenames
- Verify files weren't corrupted during selection
- Look for very long file paths (>100 chars)
- Check browser console for specific errors

**Generated index looks wrong**

- Check if existing index.html was preserved
- Verify all files are included in folder
- Look for special characters in filenames
- Ensure folder structure is as expected

### Error Messages

| Error                         | Cause                        | Solution                               |
| ----------------------------- | ---------------------------- | -------------------------------------- |
| "Folder access denied"        | Browser security             | Grant folder permission                |
| "Upload timeout"              | Large folder/slow connection | Split folder or improve connection     |
| "Invalid filename"            | Special characters           | Rename problematic files               |
| "Insufficient stamp capacity" | Folder too large             | Get larger stamp or reduce folder size |

### Performance Issues

**Slow upload**:

- Normal for large folders
- Keep browser tab open
- Avoid other bandwidth-heavy activities
- Monitor progress indicators

**Browser freezes**:

- Folder may be too large
- Close other tabs to free memory
- Try smaller batches
- Restart browser if needed

**Index generation fails**:

- Check for file permission issues
- Verify folder contains valid files
- Look for corrupted files
- Try recreating the folder

## Migration Guide

### From Traditional File Sharing

1. **Organize files** into logical folder structure
2. **Clean up metadata** (system will auto-filter most)
3. **Add documentation** (README files)
4. **Upload folder** using Beeport
5. **Share Swarm URL** instead of traditional links

### From ZIP/Archive Sharing

1. **Extract existing archives** to folders
2. **Reorganize structure** if needed
3. **Upload as folder** (better than re-archiving)
4. **Benefit from auto-index** generation
5. **Easier file access** via web browser

### From Website Hosting

1. **Download website files** to local folder
2. **Ensure index.html exists** (or let system generate)
3. **Verify relative paths** in HTML/CSS
4. **Upload folder** as website
5. **Update DNS/links** to point to Swarm

---

_Related: Learn about [ZIP File Upload](./zip-file-upload.md) for archive processing and [Webpage Upload](./webpage-upload.md) for website deployment._
