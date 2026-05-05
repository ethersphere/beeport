# Swarm Upload Documentation

Welcome to the documentation for uploading files to Swarm with Beeport.

## Available guides

### Core upload features

- **[Single File Upload](./single-file-upload.md)** - Basic file upload functionality
- **[Multiple File Upload](./multiple-file-upload.md)** - Upload multiple files to the same stamp
- **[Folder Upload](./folder-upload.md)** - Upload entire directories with auto-generated websites
- **[ZIP File Upload](./zip-file-upload.md)** - Upload and process ZIP archives with smart filtering

### Advanced features

- **[Archive Processing](./archive-processing.md)** - TAR/ZIP processing and website creation
- **[Webpage Upload](./webpage-upload.md)** - Create websites from TAR/ZIP files
- **[NFT Collection Upload](./nft-collection-upload.md)** - Upload entire NFT collections with automatic metadata processing

### Technical guides

- **[Architecture](./architecture.md)** - Project architecture and third-party integrations
- **[Postage Stamps](./postage-stamps.md)** - Understanding and managing storage stamps
- **[Self-custody hot key](./self-custody-hot-key.md)** - How the per-wallet derived key owns batches and signs chunks
- **[Client-side chunk pipeline](./client-side-chunk-pipeline.md)** - Presigned `fetch`, `/chunks` vs `/soc`, concurrency caps, workers
- **[ENS Integration](./ens-integration.md)** - Link your ENS domains to Swarm content
- **[ENS Technical Reference](./ens-technical-reference.md)** - Detailed ENS implementation overview
- **[File Formats & Limits](./file-formats-limits.md)** - Supported formats and size limitations
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions
- **[Roadmap / TODO](./TODO.md)** - Prioritised follow-ups and known limitations

### Swarm improvement proposals (drafts)

- **[SWIP — Client-side postage stamping](./swip-XXXX-client-side-postage-stamping.md)** - Self-custody mode α: per-chunk stamp signing in the browser
- **[SWIP — Streamed postage stamp signing](./swip-XXXX-streamed-postage-stamp-signing.md)** - Streaming `/chunks` upload with inline stamps

## Quick start

1. **Connect your wallet** from any EVM-compatible chain (Ethereum, Polygon, Arbitrum, etc.)
2. **Select tokens** - Use ETH, USDC, MATIC, or other major tokens you already have
3. **Choose storage options** - The app automatically bridges your tokens to Gnosis Chain for xBZZ
4. **Purchase or select a postage stamp** for storage
5. **Choose your upload type**:
   - Single file for individual files
   - Multiple files for batch uploads
   - ZIP with special processing options
6. **Configure options** based on your needs
7. **Upload and get your Swarm references**

## Useful links

- [Swarm Network Documentation](https://docs.ethswarm.org/)
- [Bee API Documentation](https://docs.ethswarm.org/docs/api-reference/)
- [bzz.link Gateway](https://bzz.link/)

## Feature overview

| Feature         | File Types  | Special Processing                 | Use Case                      |
| --------------- | ----------- | ---------------------------------- | ----------------------------- |
| Single File     | Any         | Optional archive extraction        | Individual files              |
| Multiple Files  | Any         | Sequential upload                  | Batch operations              |
| Folder Upload   | Directories | Auto-index + TAR + website mode    | Directory sharing / websites  |
| ZIP Upload      | .zip        | Extract + filter + index + TAR     | Archive distribution          |
| TAR Upload      | .tar        | Extract + enhance + index + re-TAR | Archive enhancement           |
| Webpage Upload  | .tar, .zip  | Web server configuration           | Static websites               |
| NFT Collection  | .zip        | Metadata URL rewriting             | NFT projects                  |
| ENS Integration | Any         | Content hash linking               | Domain-based access           |

## Highlights

### Automatic website creation

- **Folder uploads** → Instant browsable websites
- **Auto-generated index.html** with professional branding
- **Smart file filtering** removes system metadata
- **Long filename handling** for TAR compatibility

### Archive processing

- **ZIP extraction** with automatic website mode
- **TAR enhancement** adds missing index files
- **System file cleanup** (PAX headers, \_\_MACOSX, .DS_Store)
- **Cross-platform compatibility** Windows/Mac/Linux

### Behaviour

- **Auto-detection** of best upload method
- **Filename truncation** for TAR format compliance
- **Metadata filtering** for clean, professional results
- **Responsive index pages** work on all devices

## Technical requirements

- **Wallet**: MetaMask or compatible Web3 wallet
- **Network**: Any EVM-compatible chain (automatically bridges to Gnosis Chain via LI.FI)
- **Browser**: Modern browser with JavaScript enabled
- **Files**: See [File formats & limits](./file-formats-limits.md) and per-feature guides

---

_For detailed information on each feature, click on the links above or browse the individual guide files._
