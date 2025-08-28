# ENS Integration - Technical Reference

## Summary

The ENS (Ethereum Name Service) integration provides a complete solution for linking ENS domains to Swarm-hosted content, with robust error handling, comprehensive domain management, and seamless user experience.

## Core Features

### 1. **Content Hash Linking**

- **Primary Function**: Set ENS domain content hash to point to Swarm content
- **Access Methods**: Content becomes accessible via:
  - `yourname.eth` (ENS-compatible browsers)
  - `yourname.eth.limo` (ENS gateway)
  - `yourname.eth.link` (ENS gateway)
- **Content Hash Format**: Automatically encodes Swarm references into proper ENS content hash format (ENSIP-7 compliant)

### 2. **Domain Management**

- **Automatic Domain Discovery**: Fetches user's owned domains via ENS subgraph
- **Domain Validation**: Real-time verification of domain ownership and configuration
- **Support for Multiple Domain Types**:
  - .eth domains (primary ENS domains)
  - DNS domains with ENS integration
  - Subdomains and wrapped domains
  - Other ENS TLDs

### 3. **Domain Registration**

- **Two-Step Registration Process**:
  - Commit phase (prevents front-running attacks)
  - Registration phase (60-second waiting period)
- **Availability Checking**: Real-time domain availability and pricing
- **Price Display**: Shows registration cost in ETH for 1-year duration
- **Automatic Resolver Setup**: Uses ENS Public Resolver by default

### 4. **Smart Network Management**

- **Automatic Network Switching**: Detects and switches to Ethereum Mainnet
- **Network Validation**: ENS operations only work on Ethereum Mainnet (Chain ID: 1)
- **Error Handling**: Clear messaging for network-related issues

### 5. **Ownership & Permission Verification**

- **Comprehensive Ownership Checks**:
  - BaseRegistrar ownership (for .eth domains)
  - Registry controller permissions
  - NameWrapper ownership (for wrapped domains)
  - Subdomain management rights
- **Parent Domain Inheritance**: Subdomain management through parent domain ownership

## User Interface Components

### 1. **ENS Integration Modal**

- **Two Modes**:
  - "Set Content Hash" (for existing domains)
  - "Register Domain" (for new domain registration)
- **Smart Domain Input**:
  - Dropdown for owned domains
  - Manual input for unlisted domains
  - Search functionality for large domain lists

### 2. **Domain Dropdown Component**

- **Searchable Interface**: Filter through owned domains
- **Visual Indicators**: Domain icons and selection states
- **Loading States**: Proper loading indicators during domain fetching

### 3. **Integration Access Point**

- **Upload History Integration**: ENS button appears next to website uploads
- **Contextual Access**: Only available for website-type content
- **Visual Feedback**: Tooltip explaining ENS functionality

## Technical Implementation

### 1. **Smart Contract Integration**

- **ENS Registry**: Domain ownership verification
- **ENS Resolver**: Content hash setting/getting
- **BaseRegistrar**: .eth domain ownership
- **RegistrarController**: Domain registration
- **NameWrapper**: Wrapped domain support

### 2. **Data Sources**

- **ENS Subgraph**: Domain discovery and metadata
- **Wagmi Hooks**: Real-time ENS data resolution
- **Viem**: Ethereum contract interactions

### 3. **Content Hash Encoding**

- **ENSIP-7 Compliance**: Proper Swarm content hash encoding
- **Format**: `0xe40101fa011b20{swarmHash}` (Swarm-ns + CIDv1 + Swarm-manifest + codec + hash)

## User Workflow

### For Existing Domains:

1. Upload content to Swarm
2. Access Upload History
3. Click ENS button on website uploads
4. Select owned domain from dropdown
5. Set content hash transaction
6. Access content via ENS domain

### For New Domains:

1. Switch to "Register Domain" mode
2. Enter desired domain name
3. Check availability and price
4. Complete two-step registration process
5. Switch to "Set Content Hash" mode
6. Link newly registered domain to content

## Requirements & Prerequisites

### User Requirements:

- **Wallet Connection**: Must have connected Ethereum wallet
- **Network**: Must be on Ethereum Mainnet
- **ETH Balance**: Sufficient ETH for gas fees
- **Domain Ownership**: Must own ENS domain (for content hash setting)

### Domain Requirements:

- **Resolver Configuration**: Domain must have resolver set
- **Valid Registration**: Domain must be properly registered in ENS
- **Management Rights**: User must have management permissions

## Error Handling & Validation

### Comprehensive Error Messages:

- Network switching requirements
- Domain ownership verification
- Resolver configuration issues
- Transaction failure explanations
- Gas fee insufficiency warnings

### Real-time Validation:

- Domain existence checking
- Ownership verification
- Resolver status validation
- Content hash conflict detection

## Integration Points

### Upload History Integration:

- ENS buttons appear on website-type uploads
- Associated domains displayed in upload records
- Direct links to ENS gateway access

### Local Storage Integration:

- Domain associations saved to upload history
- Persistent tracking of ENS-linked content

## Key Files

### Core Components:

- `src/app/components/ENSIntegration.tsx` - Main ENS integration modal (1,530 lines)
- `src/app/components/ENSDomainDropdown.tsx` - Domain selection dropdown
- `src/app/components/UploadHistorySection.tsx` - Integration access point
- `docs/ens-integration.md` - Comprehensive user documentation

### Features Implemented:

- ✅ Domain ownership verification
- ✅ Content hash setting/getting
- ✅ Domain registration (commit-reveal process)
- ✅ Automatic domain discovery
- ✅ Network switching
- ✅ Subdomain support
- ✅ Wrapped domain support
- ✅ Real-time validation
- ✅ Comprehensive error handling
- ✅ User documentation

This ENS integration provides a complete solution for linking decentralized content to human-readable domain names, with robust error handling, comprehensive domain management, and seamless user experience.
