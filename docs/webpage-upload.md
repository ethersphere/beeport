# Webpage Upload Guide

## Overview

The webpage upload feature allows you to deploy static websites to the Swarm network. By uploading TAR or ZIP files containing your website files and enabling "Upload as webpage", your site becomes accessible through any Swarm gateway with proper web server configuration.

## How to Create a Website on Swarm

### Step 1: Prepare Your Website Files

#### Required Files

- **index.html**: Main page (required)
- **error.html**: Error page (optional but recommended)
- **CSS files**: Stylesheets for your site
- **JavaScript files**: Interactive functionality
- **Images/Assets**: Any media files your site needs

#### File Structure Example

```
my-website/
├── index.html          (required - main page)
├── error.html          (optional - 404 error page)
├── css/
│   ├── style.css
│   └── responsive.css
├── js/
│   ├── main.js
│   └── utils.js
├── images/
│   ├── logo.png
│   └── background.jpg
└── assets/
    ├── fonts/
    └── icons/
```

### Step 2: Create Archive File

#### Option A: Create TAR File

```bash
# Using command line (Linux/Mac)
tar -czf my-website.tar.gz index.html error.html css/ js/ images/ assets/

# Or create .tar file
tar -cf my-website.tar index.html error.html css/ js/ images/ assets/
```

#### Option B: Create ZIP File

1. Select all your website files and folders
2. Right-click and choose "Compress" or "Add to ZIP"
3. Name it `my-website.zip`

### Step 3: Upload as Webpage

1. **Connect your wallet** and navigate to Upload section
2. **Ensure "Upload multiple files" is unchecked** (single file mode)
3. **Select your TAR or ZIP file**
4. **Check "Serve uncompressed"** (extracts the archive)
5. **Check "Upload as webpage"** ✓ (enables web server features)
6. **Select postage stamp** with sufficient capacity
7. **Click "Upload"**

### Step 4: Access Your Website

After successful upload, your website will be available at:

```
https://bzz.link/bzz/YOUR_REFERENCE_HASH/
```

The trailing slash is important for proper website loading.

## Web Server Configuration

### Index Document

When "Upload as webpage" is checked, the system configures:

- **Index Document**: `index.html`
- **Error Document**: `error.html`

This means:

- Visiting the root URL loads `index.html` automatically
- 404 errors show `error.html` instead of default error page
- Directory browsing is disabled for security

### URL Structure

```
https://bzz.link/bzz/REFERENCE/           → index.html
https://bzz.link/bzz/REFERENCE/about.html → about.html
https://bzz.link/bzz/REFERENCE/css/       → directory listing (if no index.html in css/)
https://bzz.link/bzz/REFERENCE/404        → error.html
```

## Best Practices

### File Organization

- **Use relative paths** in your HTML/CSS (no absolute URLs)
- **Organize assets** in logical folders (css/, js/, images/)
- **Include error.html** for better user experience
- **Test locally first** before uploading

### HTML Considerations

```html
<!-- Good: Relative paths -->
<link rel="stylesheet" href="css/style.css" />
<script src="js/main.js"></script>
<img src="images/logo.png" alt="Logo" />

<!-- Avoid: Absolute paths -->
<link rel="stylesheet" href="/css/style.css" />
<script src="http://example.com/js/main.js"></script>
```

### Performance Optimization

- **Compress images** before including in archive
- **Minify CSS/JS** for faster loading
- **Use efficient file formats** (WebP for images, etc.)
- **Keep total size reasonable** for faster uploads

### SEO and Accessibility

- **Include proper meta tags** in your HTML
- **Use semantic HTML** structure
- **Add alt text** to images
- **Ensure responsive design** for mobile users

## Example Website Structure

### Simple Portfolio Site

```
portfolio.tar
├── index.html
├── error.html
├── about.html
├── contact.html
├── css/
│   ├── main.css
│   └── responsive.css
├── js/
│   └── contact-form.js
└── images/
    ├── profile.jpg
    ├── project1.png
    └── project2.png
```

### Blog or Documentation Site

```
blog.tar
├── index.html
├── error.html
├── posts/
│   ├── post1.html
│   ├── post2.html
│   └── post3.html
├── css/
│   ├── blog.css
│   └── syntax.css
├── js/
│   ├── search.js
│   └── navigation.js
└── assets/
    ├── images/
    └── fonts/
```

## Advanced Features

### Custom Error Pages

Create `error.html` for custom 404 pages:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Page Not Found</title>
    <link rel="stylesheet" href="css/style.css" />
  </head>
  <body>
    <h1>Oops! Page Not Found</h1>
    <p>The page you're looking for doesn't exist.</p>
    <a href="/">Return to Home</a>
  </body>
</html>
```

### Single Page Applications (SPAs)

For React, Vue, or Angular apps:

1. Build your app for production
2. Include all built files in archive
3. Ensure routing works with static files
4. Consider using hash routing for better compatibility

### Progressive Web Apps (PWAs)

- Include `manifest.json` for PWA features
- Add service worker files
- Include all required icons and assets
- Test offline functionality

## Limitations

### What Webpage Upload Can't Do

- **Server-side processing**: No PHP, Python, Node.js, etc.
- **Database connections**: No dynamic data storage
- **Form submissions**: No server-side form processing
- **Real-time features**: No WebSocket servers
- **Authentication**: No server-side user management

### Static Site Only

Webpage upload is designed for static sites:

- ✅ HTML, CSS, JavaScript
- ✅ Images, fonts, assets
- ✅ Client-side frameworks (React, Vue, etc.)
- ❌ Server-side languages
- ❌ Database integration
- ❌ Server-side APIs

## Troubleshooting

### Website Not Loading

- **Check reference hash** is correct
- **Ensure trailing slash** in URL: `/bzz/HASH/`
- **Verify index.html exists** in root of archive
- **Wait a few minutes** for network propagation

### Broken Links/Assets

- **Use relative paths** in HTML/CSS
- **Check file names** match exactly (case-sensitive)
- **Verify file structure** in uploaded archive
- **Test locally** before uploading

### Styling Issues

- **Check CSS file paths** are relative
- **Verify CSS files** are included in archive
- **Test responsive design** on different devices
- **Check for missing fonts** or assets

### JavaScript Not Working

- **Check JS file paths** are relative
- **Verify no server-side dependencies**
- **Test in browser console** for errors
- **Ensure all JS files** are included

## Use Cases

### Personal Websites

- Portfolio sites
- Personal blogs
- Resume/CV sites
- Photography galleries

### Business Sites

- Company landing pages
- Product showcases
- Documentation sites
- Marketing campaigns

### Development Projects

- Project demos
- API documentation
- Open source project sites
- Technical blogs

### Educational Content

- Course materials
- Tutorial sites
- Interactive learning tools
- Research presentations

## Migration from Traditional Hosting

### From WordPress/CMS

1. Export your content to static HTML
2. Use static site generators (Jekyll, Hugo, etc.)
3. Organize files according to best practices
4. Upload as webpage to Swarm

### From Traditional Web Hosting

1. Download all website files
2. Remove server-side code (PHP, etc.)
3. Convert dynamic features to client-side
4. Create archive and upload

---

_Next: Learn about [NFT Collection Upload](./nft-collection-upload.md) for specialized NFT processing._
