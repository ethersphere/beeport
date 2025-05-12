# StampsRegistry Smart Contract

This directory contains the StampsRegistry smart contract, which provides a registry for Swarm Postage Stamps.

## Overview

The StampsRegistry contract allows users to create and manage batches of stamps for the Swarm network. It serves as a registry that tracks ownership and provides methods for retrieving batch information.

## Deployment with Hardhat

### Prerequisites

1. Node.js and npm installed
2. Hardhat and required dependencies installed:
   ```bash
   npm install --save-dev hardhat @nomicfoundation/hardhat-toolbox @nomicfoundation/hardhat-verify @nomicfoundation/hardhat-ethers hardhat-deploy ethers@^6.0.0 dotenv
   ```

### Environment Variables

Create a `.env.local` file in the project root with the following variables:

```
# Hardhat Deployment
DEPLOYER_PRIVATE_KEY=your_private_key_here
GNOSIS_RPC_URL=https://gnosis-rpc.publicnode.com
GNOSIS_API_KEY=your_gnosisscan_api_key_here
SWARM_CONTRACT_ADDRESS=0x45a1502382541Cd610CC9068e88727426b696293
```

### Deployment Commands

To deploy to Gnosis Chain:

```bash
npx hardhat deploy --network gnosis --tags StampsRegistry
```

The deployment script will:

1. Deploy the StampsRegistry contract
2. Automatically verify the contract on GnosisScan (if API key is provided)

### Verification

If the automatic verification fails, you can manually verify the contract:

```bash
npx hardhat verify --network gnosis DEPLOYED_CONTRACT_ADDRESS SWARM_CONTRACT_ADDRESS
```

## Contract Interaction

Once deployed, you can interact with the contract using the following functions:

1. `createBatchRegistry`: Create a new batch of stamps
2. `getOwnerBatches`: Get all batches for a specific owner
3. `getOwnerBatchCount`: Get the count of batches for a specific owner
4. `getBatchPayer`: Get the payer address for a specific batch ID
5. `updateSwarmContract`: Update the Swarm contract address (admin only)

## Notes

The terms "Batch" and "Stamps" are used interchangeably throughout the codebase. "Batch" refers to a collection of stamps created in a single transaction and is the terminology used in the Swarm protocol, while "Stamps" is a more user-friendly term used to describe the same concept.
