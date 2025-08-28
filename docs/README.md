# Swarm Upload Documentation

Welcome to the comprehensive guide for uploading files to the Swarm network using our application. This documentation covers all available upload features and options.

## 📚 Available Guides

### Core Upload Features

- **[Single File Upload](./single-file-upload.md)** - Basic file upload functionality
- **[Multiple File Upload](./multiple-file-upload.md)** - Upload multiple files to the same stamp
- **[ZIP File Upload](./zip-file-upload.md)** - Upload and process ZIP archives

### Advanced Features

- **[Webpage Upload](./webpage-upload.md)** - Create websites from TAR/ZIP files
- **[NFT Collection Upload](./nft-collection-upload.md)** - Upload entire NFT collections with automatic metadata processing
- **[Archive Processing](./archive-processing.md)** - How ZIP, TAR, and GZ files are handled

### Technical Guides

- **[Architecture](./architecture.md)** - Project architecture and third-party integrations
- **[Postage Stamps](./postage-stamps.md)** - Understanding and managing storage stamps
- **[ENS Integration](./ens-integration.md)** - Link your ENS domains to Swarm content
- **[ENS Technical Reference](./ens-technical-reference.md)** - Detailed ENS implementation overview
- **[File Formats & Limits](./file-formats-limits.md)** - Supported formats and size limitations
- **[Troubleshooting](./troubleshooting.md)** - Common issues and solutions

## 🚀 Quick Start

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

## 🔗 Useful Links

- [Swarm Network Documentation](https://docs.ethswarm.org/)
- [Bee API Documentation](https://docs.ethswarm.org/docs/api-reference/)
- [bzz.link Gateway](https://bzz.link/)

## 📋 Feature Overview

| Feature         | File Types | Special Processing          | Use Case             |
| --------------- | ---------- | --------------------------- | -------------------- |
| Single File     | Any        | Optional archive extraction | Individual files     |
| Multiple Files  | Any        | Sequential upload           | Batch operations     |
| ZIP Upload      | .zip       | Extract → TAR conversion    | Archive distribution |
| Webpage Upload  | .tar, .zip | Web server configuration    | Static websites      |
| NFT Collection  | .zip       | Metadata URL rewriting      | NFT projects         |
| ENS Integration | Any        | Content hash linking        | Domain-based access  |

## 🛠️ Technical Requirements

- **Wallet**: MetaMask or compatible Web3 wallet
- **Network**: Any EVM-compatible chain (automatically bridges to Gnosis Chain via LI.FI)
- **Browser**: Modern browser with JavaScript enabled
- **Files**: See individual guides for format requirements

---

_For detailed information on each feature, click on the links above or browse the individual guide files._
