# Contract Deployment Guide

This guide explains how to deploy the SwarmBatchSwapper contract to Gnosis Chain.

## Prerequisites

1. **Environment Setup**: Create a `.env` file with the following variables:

   ```bash
   WALLET_SECRET=your_private_key_here
   PRIVATE_RPC_MAINNET=https://gnosis-rpc.publicnode.com
   MAINNET_ETHERSCAN_KEY=your_gnosisscan_api_key
   GNOSIS_CUSTOM_REGISTRY_ADDRESS=0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3
   ```

2. **Install Dependencies**:

   ```bash
   npm install
   ```

3. **Compile Contracts**:
   ```bash
   npm run compile
   ```

## Deployment Scripts

### Deploy All Contracts

Deploy both StampsRegistry and SwarmBatchSwapper:

```bash
# Local deployment (for testing)
npm run deploy:local

# Gnosis Chain deployment
npm run deploy:gnosis
```

### Deploy Only SwarmBatchSwapper

If StampsRegistry is already deployed:

```bash
# Local deployment
npm run deploy:swapper:local

# Gnosis Chain deployment
npm run deploy:swapper:gnosis
```

## Contract Addresses

The deployment script will automatically:

1. **Use existing StampsRegistry**: If already deployed, it will use that address
2. **Fallback to environment**: Uses `GNOSIS_CUSTOM_REGISTRY_ADDRESS` if StampsRegistry not found
3. **Configure with Gnosis addresses**:
   - SushiSwap Router: `0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506`
   - BZZ Token: `0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da`
   - USDC Token: `0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83`
   - BZZ/USDC Pool: `0x6f30b7cf40cb423c1d23478a9855701ecf43931e`

## Post-Deployment

After successful deployment:

1. **Update Constants**: Copy the deployed address and update `src/app/components/constants.ts`:

   ```typescript
   export const SWARM_BATCH_SWAPPER_ADDRESS = 'YOUR_DEPLOYED_ADDRESS_HERE';
   ```

2. **Verify Contract**: The script automatically verifies on GnosisScan if you have an API key

3. **Test Integration**: The smart contract mode will automatically activate when the address is not the zero address

## Contract Features

The SwarmBatchSwapper contract provides:

- **Single Transaction**: Combines token swap + batch creation/top-up
- **Gas Efficiency**: Reduces transaction costs compared to separate operations
- **Automatic Slippage**: Built-in slippage protection for swaps
- **Excess Return**: Returns unused tokens to the user
- **Multi-Token Support**: Works with any ERC20 token that has SushiSwap liquidity

## Troubleshooting

### Common Issues

1. **Insufficient Gas**: Increase gas limit in hardhat.config.ts
2. **Verification Failed**: Check your GnosisScan API key
3. **StampsRegistry Not Found**: Ensure the registry address is correct in your .env

### Manual Verification

If automatic verification fails:

```bash
npx hardhat verify --network gnosis DEPLOYED_ADDRESS "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" "STAMPS_REGISTRY_ADDRESS" "0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da" "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83" "0x6f30b7cf40cb423c1d23478a9855701ecf43931e" --contract contracts/SwarmBatchSwapper.sol:SwarmBatchSwapper
```

## Security Considerations

- **Owner Functions**: The contract has owner-only functions for configuration updates
- **Reentrancy Protection**: Uses OpenZeppelin's ReentrancyGuard
- **Safe Transfers**: Uses SafeERC20 for all token operations
- **Slippage Protection**: Built-in minimum amount checks
