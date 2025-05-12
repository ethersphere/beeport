# Registry Data Migration Script

This script fetches all `BatchCreated` events from the old StampsRegistry contract and saves them to a JSON file. This data can be used to migrate to the new contract or for analysis purposes.

## Setup

1. Install dependencies:
   ```bash
   npm install ethers@^6.0.0
   ```

2. Optional: Configure environment variables in `.env.local`:
   ```
   GNOSIS_RPC_URL=your_rpc_url_here  # Optional, defaults to public RPC
   ```

## Usage

Run the script:
```bash
npx ts-node misc/migrate_registry_data.ts
```

The script will:
1. Connect to Gnosis Chain
2. Fetch all BatchCreated events from the contract creation block
3. Process and organize the data
4. Save it to `misc/registry_data.json`

## Output Format

The script generates a JSON file with the following structure:

```typescript
{
  metadata: {
    contractAddress: string,
    startBlock: number,
    endBlock: number,
    totalBatches: number,
    uniqueOwners: number,
    exportDate: string,
  },
  batchesByOwner: {
    [ownerAddress: string]: Array<{
      batchId: string,
      totalAmount: string,
      normalisedBalance: string,
      owner: string,
      payer: string,
      depth: number,
      bucketDepth: number,
      immutable_: boolean,
      blockNumber: number,
      transactionHash: string,
      timestamp: number,
      date: string,
    }>,
  },
  allBatches: Array<BatchData>, // Same structure as above
}
```

## Data Usage

The exported data can be used to:
1. Analyze batch creation patterns
2. Verify data before migration
3. Import data into the new contract
4. Generate reports on stamp usage

## Error Handling

The script includes error handling for:
- Network connection issues
- Event parsing failures
- File system operations

If any errors occur, they will be logged to the console and the script will exit with a non-zero status code. 