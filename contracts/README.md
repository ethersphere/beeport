# Swarm Stamps Smart Contracts

This directory contains two smart contracts for purchasing Swarm Postage Stamps on Gnosis chain.

---

## Contracts

### StampsRegistry

A registry for Swarm Postage Stamps that wraps the core Swarm postage contract. Users interact with this contract to create or top up stamp batches using BZZ tokens they already hold.

### SushiSwapStampsRouter

Swaps **any Gnosis-chain token → BZZ** via SushiSwap V3 and atomically creates or tops up a Swarm stamp batch in a single transaction. Eliminates the need for Relay for same-chain swaps.

**Features:**
- Single-hop swaps (e.g. USDC → BZZ)
- Multi-hop swaps (e.g. xDAI → WXDAI → USDC → BZZ)
- Native xDAI support (auto-wraps to WXDAI)
- Quote functions callable via `eth_call` (zero gas)
- Compatible with SushiSwap V3 (Uniswap V3 interface)

**Gnosis addresses used by the router:**

| Contract | Address |
|----------|---------|
| BZZ | `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da` |
| WXDAI | `0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d` |
| SushiSwap V3 Factory | `0xf78031cbca409f2fb6876bdfdbc1b2df24cf9bef` |
| SushiSwap V3 QuoterV2 | `0xb1e835dc2785b52265711e17fccb0fd018226a6e` |
| BZZ/USDC pool | `0x6f30b7cf40cb423c1d23478a9855701ecf43931e` |

---

## Deployment

### Prerequisites

1. Node.js and npm installed
2. Hardhat dependencies:
   ```bash
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify @nomicfoundation/hardhat-ethers hardhat-deploy ethers@^6.0.0 dotenv
   ```

### Environment Variables

Create a `.env` file in the project root:

```
# Deployer
WALLET_SECRET=your_private_key_here
GNOSIS_RPC_URL=https://rpc.gnosischain.com
MAINNET_ETHERSCAN_KEY=your_gnosisscan_api_key_here

# StampsRegistry deployment
SWARM_CONTRACT_ADDRESS=0x45a1502382541Cd610CC9068e88727426b696293

# SushiSwapStampsRouter deployment (uses existing registry)
GNOSIS_STAMPS_REGISTRY=0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3
```

### Deploy StampsRegistry

```bash
npx hardhat deploy --network gnosis --tags StampsRegistry
```

### Deploy SushiSwapStampsRouter

```bash
npx hardhat deploy --network gnosis --tags SushiSwapStampsRouter
```

After deployment, add the router address to your `.env.local`:
```
NEXT_PUBLIC_SUSHI_STAMPS_ROUTER_ADDRESS=<deployed address>
```

### Verification

Both deploy scripts automatically attempt verification after deployment using two methods:

| Method | Tool | API key needed |
|--------|------|---------------|
| **GnosisScan** (Etherscan-compatible) | `verify:verify` task | Yes (`MAINNET_ETHERSCAN_KEY`) |
| **Sourcify** (v2, Blockscout native) | `sourcify` task | No |

#### Standalone verification scripts (run any time after deployment)

```bash
# Verify SushiSwapStampsRouter (uses address from deployments/ cache)
npx hardhat run scripts/verify_router.ts --network gnosis

# Override address explicitly
ROUTER_ADDRESS=0x... npx hardhat run scripts/verify_router.ts --network gnosis

# Verify StampsRegistry
npx hardhat run scripts/verify_registry.ts --network gnosis
REGISTRY_ADDRESS=0x... npx hardhat run scripts/verify_registry.ts --network gnosis
```

#### Manual one-liners

```bash
# GnosisScan (Etherscan API)
npx hardhat verify --network gnosis <ADDRESS> <CONSTRUCTOR_ARG>

# Sourcify (v2 – no API key)
npx hardhat sourcify --network gnosis --address <ADDRESS>
```

Sourcify mirrors are picked up by GnosisScan/Blockscout automatically, so verifying on Sourcify alone is sufficient if you don't have a GnosisScan API key.

---

## Path Encoding

The `SushiSwapStampsRouter` uses Uniswap V3-compatible **exact-output path encoding** (reversed token order):

```
single-hop:  abi.encodePacked(BZZ, uint24(fee), tokenIn)             // 43 bytes
two-hop:     abi.encodePacked(BZZ, uint24(fee2), mid, uint24(fee1), tokenIn)  // 66 bytes
```

In TypeScript (using viem):
```typescript
import { encodePacked } from 'viem';

// USDC → BZZ (single-hop, 1% fee)
const path = encodePacked(
  ['address', 'uint24', 'address'],
  [BZZ_ADDRESS, 10000, USDC_ADDRESS]
);

// xDAI → WXDAI → USDC → BZZ (two-hop)
const path = encodePacked(
  ['address', 'uint24', 'address', 'uint24', 'address'],
  [BZZ_ADDRESS, fee2, USDC_ADDRESS, fee1, WXDAI_ADDRESS]
);
```

## Notes

The terms "Batch" and "Stamps" are used interchangeably. "Batch" is the Swarm protocol term; "Stamps" is the user-friendly term.
