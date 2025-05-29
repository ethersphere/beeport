# Swarm Contracts

This directory contains smart contracts for the Swarm network integration.

## Contracts

### StampsRegistry.sol

A registry contract for Swarm Postage Stamps that allows users to create and manage batches of stamps for the Swarm network. It serves as a registry that tracks ownership and provides methods for retrieving batch information.

### SwarmBatchSwapper.sol

A smart contract that combines token swapping and batch creation/top-up operations into a single transaction. This contract integrates with SushiSwap to automatically swap tokens to BZZ and then create or top up Swarm batches, providing a more efficient user experience.

## Overview

The contracts work together to provide a complete solution for purchasing Swarm storage:

1. **StampsRegistry**: Core registry for tracking batch ownership and metadata
2. **SwarmBatchSwapper**: User-facing contract that handles token swaps and batch operations

## Deployment with Hardhat

### Prerequisites

1. Node.js and npm installed
2. Hardhat and required dependencies installed:
   ```bash
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify @nomicfoundation/hardhat-ethers hardhat-deploy ethers@^6.0.0 dotenv
   npm install @openzeppelin/contracts
   ```

### Environment Variables

Create a `.env` file in the project root with the following variables:

```
# Hardhat Deployment
WALLET_SECRET=your_private_key_here
PRIVATE_RPC_MAINNET=https://gnosis-rpc.publicnode.com
MAINNET_ETHERSCAN_KEY=your_gnosisscan_api_key_here
GNOSIS_CUSTOM_REGISTRY_ADDRESS=0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3
```

### Deployment Commands

Deploy all contracts:

```bash
npm run deploy:gnosis
```

Deploy only SwarmBatchSwapper (if StampsRegistry already exists):

```bash
npm run deploy:swapper:gnosis
```

Local testing:

```bash
npm run deploy:local
npm run deploy:swapper:local
```

The deployment scripts will:

1. Deploy the StampsRegistry contract (if needed)
2. Deploy the SwarmBatchSwapper contract with proper configuration
3. Automatically verify contracts on GnosisScan (if API key is provided)

### Verification

If automatic verification fails, you can manually verify:

**StampsRegistry:**

```bash
npx hardhat verify --network gnosis DEPLOYED_CONTRACT_ADDRESS SWARM_CONTRACT_ADDRESS
```

**SwarmBatchSwapper:**

```bash
npx hardhat verify --network gnosis DEPLOYED_ADDRESS "0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506" "STAMPS_REGISTRY_ADDRESS" "0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da" "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83" "0x6f30b7cf40cb423c1d23478a9855701ecf43931e" --contract contracts/SwarmBatchSwapper.sol:SwarmBatchSwapper
```

## Contract Interaction

### StampsRegistry Functions

1. `createBatchRegistry`: Create a new batch of stamps
2. `getOwnerBatches`: Get all batches for a specific owner
3. `getOwnerBatchCount`: Get the count of batches for a specific owner
4. `getBatchPayer`: Get the payer address for a specific batch ID
5. `updateSwarmContract`: Update the Swarm contract address (admin only)

### SwarmBatchSwapper Functions

1. `swapAndCreateBatch`: Swap tokens and create a new batch in one transaction
2. `swapAndTopUpBatch`: Swap tokens and top up an existing batch
3. `getExpectedBzzOutput`: Get expected BZZ output for a given input amount
4. `updateConfig`: Update contract configuration (owner only)

## Notes

The terms "Batch" and "Stamps" are used interchangeably throughout the codebase. "Batch" refers to a collection of stamps created in a single transaction and is the terminology used in the Swarm protocol, while "Stamps" is a more user-friendly term used to describe the same concept.
