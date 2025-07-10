# ENS Integration Guide

## Overview

The ENS (Ethereum Name Service) integration allows you to link your ENS domains to your Swarm-hosted content. This enables users to access your content using human-readable domain names instead of complex Swarm reference hashes.

## How It Works

When you set an ENS domain's content hash to point to your Swarm content, users can access your files by visiting:

- `yourname.eth` (in ENS-compatible browsers)
- `yourname.eth.limo` (via ENS gateway)
- `yourname.eth.link` (via ENS gateway)

## Prerequisites

Before using ENS integration, make sure you have:

1. **An ENS domain** - You must own an ENS domain (e.g., `myname.eth`)
2. **A resolver set** - Your domain must have a resolver configured
3. **ETH for gas** - You need ETH to pay for the transaction on Ethereum mainnet
4. **Wallet connected to Ethereum Mainnet** - You must be connected to Ethereum mainnet (Chain ID: 1)

### Important: Network Requirements

ENS domains are managed exclusively on **Ethereum Mainnet**. If you're connected to any other network (Polygon, Arbitrum, etc.), you'll need to switch to Ethereum Mainnet to manage ENS content hashes.

## Step-by-Step Guide

### 1. Upload Your Content

First, upload your content to Swarm using the upload interface. This will give you a Swarm reference hash.

### 2. Access ENS Integration

1. Go to the **Upload History** section
2. Find the upload you want to link to an ENS domain
3. Click the **ENS** button next to the reference hash

### 3. Enter Your Domain

1. In the modal that opens, enter your ENS domain name (e.g., `myname.eth`)
2. Make sure you own this domain
3. Verify that your domain has a resolver set

### 4. Set Content Hash

1. Click **"Set Content Hash"**
2. Your wallet will prompt you to confirm the transaction
3. Pay the gas fee to complete the transaction
4. Wait for confirmation

### 5. Access Your Content

Once the transaction is confirmed, your content will be accessible at:

- `yourname.eth` (ENS-compatible browsers)
- `yourname.eth.limo`
- `yourname.eth.link`

## Testing Your Setup

### Verify Domain Ownership

Before trying to set a content hash, verify that you own the domain:

1. Go to [app.ens.domains](https://app.ens.domains)
2. Connect your wallet
3. Search for your domain
4. You should see "Manager" and "Owner" fields showing your address

### Test with a Known Domain

To verify the ENS integration works, you can test with a domain you know exists:

1. Try entering a well-known domain like `vitalik.eth` or `nick.eth`
2. You should see a clear error message: "You do not own this domain"
3. This confirms the system is working correctly

### Check Domain Registration

If you're unsure whether a domain exists:

1. Visit [app.ens.domains](https://app.ens.domains)
2. Search for the domain name
3. If it shows "Available", it's not registered
4. If it shows owner details, it's registered

## Supported Domain Types

- **.eth domains** - Primary ENS domains
- **DNS domains** - Imported DNS domains with ENS integration
- **Other ENS TLDs** - Any domain registered through ENS

## Requirements

### Domain Ownership

You must own the ENS domain to set its content hash. The system will verify ownership before allowing the transaction.

### Resolver Configuration

Your domain must have a resolver set. If you get an error about "no resolver set":

1. Go to the [ENS Manager](https://app.ens.domains/)
2. Find your domain
3. Set a resolver (use the Public Resolver if unsure)
4. Wait for the transaction to confirm
5. Try the ENS integration again

### Gas Fees

Setting an ENS content hash requires a transaction on Ethereum mainnet, which costs gas. Gas fees vary based on network congestion.

## Common Use Cases

### 1. Personal Website

Upload your personal website files and link them to `yourname.eth`:

```
Upload: website.tar → Get reference: abc123...
Link: yourname.eth → Points to your website
Access: yourname.eth.limo → View your website
```

### 2. NFT Collection

Upload your NFT collection and link it to your project domain:

```
Upload: nft-collection.zip → Get reference: def456...
Link: coolnfts.eth → Points to your collection
Access: coolnfts.eth.limo → Browse your NFTs
```

### 3. Documentation

Upload documentation and link it to a subdomain:

```
Upload: docs.tar → Get reference: ghi789...
Link: docs.yourproject.eth → Points to documentation
Access: docs.yourproject.eth.limo → Read docs
```

## Best Practices

### Choose the Right Content

- **Static websites** work perfectly with ENS + Swarm
- **Single page apps** (React, Vue, etc.) work well
- **Documentation sites** are ideal for this setup
- **Media galleries** and portfolios work great

### Domain Management

- Use **descriptive names** that match your content
- Consider using **subdomains** for organization
- Keep your **resolver updated** for reliability

### Content Organization

- For websites, ensure you have an `index.html` file
- Use the **"Upload as webpage"** option for web content
- Test your content accessibility before setting ENS

## Troubleshooting

### "Please switch to Ethereum Mainnet"

This warning appears when you're connected to a different blockchain network.

**Solution:**

- Switch your wallet to Ethereum Mainnet (Chain ID: 1)
- ENS domains are only managed on Ethereum mainnet
- Other networks like Polygon, Arbitrum, etc. cannot manage ENS records

### "Domain is not registered or configured in ENS"

This error means the domain doesn't exist or resolve to an address in the ENS registry.

**Solutions:**

- Double-check the domain name spelling
- Verify the domain exists at [app.ens.domains](https://app.ens.domains)
- Make sure the domain has been properly configured (has an address record)
- If the domain doesn't exist, register it first
- Try a different domain that you know exists

### "You do not own this domain"

- Verify you own the domain in the ENS manager
- Check that you're using the correct wallet
- Ensure the domain name is spelled correctly
- The error will show the current owner's address

### "Domain has no resolver set"

- Go to the [ENS Manager](https://app.ens.domains)
- Set a resolver for your domain
- Use the Public Resolver if unsure
- Wait for the transaction to confirm

### "Domain has no owner" / "Domain may have expired"

- Check if the domain has expired
- Renew the domain if necessary
- Some domains might be in a grace period

### "Transaction failed"

- Check you have enough ETH for gas
- Verify your wallet is connected to Ethereum mainnet
- Try again when gas prices are lower
- Ensure you have permission to modify the domain

### "Content not loading"

- Verify the Swarm reference is correct
- Check that your content was uploaded successfully
- Try accessing via different ENS gateways
- Wait a few minutes for DNS propagation

## Technical Details

### Content Hash Format

The system automatically encodes your Swarm reference into the proper ENS content hash format:

```
Swarm Reference: abc123...
ENS Content Hash: 0xe40101abc123...
```

### Contract Interactions

The integration interacts with:

- **ENS Registry** - To verify domain ownership
- **Domain Resolver** - To set the content hash
- **Ethereum Mainnet** - All transactions occur on mainnet

### Security

- All transactions are signed by your wallet
- Domain ownership is verified on-chain
- Content hashes are stored on the blockchain
- No private keys are transmitted or stored

## Cost Considerations

### Gas Fees

- Setting content hash costs ~50,000-100,000 gas
- Gas prices vary with network congestion
- Consider setting multiple domains in one session

### Domain Costs

- ENS domains have annual registration fees
- Resolver setup may require additional gas
- Subdomain setup costs depend on the parent domain

## Advanced Usage

### Multiple Domains

You can link multiple ENS domains to the same Swarm content:

1. Upload content once to get a reference
2. Use the ENS integration multiple times
3. Point different domains to the same reference

### Dynamic Updates

To update your content:

1. Upload new content to Swarm
2. Use ENS integration to update the content hash
3. Your domain will now point to the new content

---

For more information about ENS, visit the [ENS Documentation](https://docs.ens.domains/).
