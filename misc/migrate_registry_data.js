const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Configuration
const GNOSIS_RPC_URL =
  process.env.GNOSIS_RPC_URL || 'https://go.getblock.io/a18f56245cf042b7863b369ba9d9301f';
const CONTRACT_ADDRESS = '0x1a3dc4cef861a7d3dcdc0d7c5adebf76c2197f20';
const START_BLOCK = 25780238; // Contract creation block
const OUTPUT_FILE = path.join(__dirname, 'registry_data.json');

// Contract ABI for the BatchCreated event
const EVENT_ABI = [
  'event BatchCreated(bytes32 indexed batchId, uint256 totalAmount, uint256 normalisedBalance, address indexed owner, address indexed payer, uint8 depth, uint8 bucketDepth, bool immutable_)',
];

async function fetchBatchEvents() {
  try {
    console.log('Starting data migration...');
    console.log('Connecting to Gnosis Chain...');

    // Connect to Gnosis Chain
    const provider = new ethers.JsonRpcProvider(GNOSIS_RPC_URL);

    // Create contract interface for event parsing
    const iface = new ethers.Interface(EVENT_ABI);

    // Get current block
    const currentBlock = await provider.getBlockNumber();
    console.log(`Current block: ${currentBlock}`);
    console.log(`Fetching events from block ${START_BLOCK} to ${currentBlock}`);

    // Get event signature
    const batchCreatedEvent = iface.getEvent('BatchCreated');
    if (!batchCreatedEvent) {
      throw new Error('BatchCreated event not found in ABI');
    }

    // Fetch all BatchCreated events in chunks with timeout and error handling
    const BLOCK_CHUNK_SIZE = 50000;
    const CHUNK_TIMEOUT_MS = 60000; // 60 seconds
    let events = [];
    for (let from = START_BLOCK; from <= currentBlock; from += BLOCK_CHUNK_SIZE) {
      const to = Math.min(from + BLOCK_CHUNK_SIZE - 1, currentBlock);
      console.log(`Fetching logs from block ${from} to ${to}`);
      try {
        const chunk = await Promise.race([
          provider.getLogs({
            address: CONTRACT_ADDRESS,
            fromBlock: from,
            toBlock: to,
            topics: [batchCreatedEvent.topicHash],
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout fetching logs')), CHUNK_TIMEOUT_MS)
          ),
        ]);
        events = events.concat(chunk);
      } catch (err) {
        console.warn(`Skipping block range ${from} to ${to} due to error: ${err.message}`);
        continue;
      }
    }
    console.log(`Found ${events.length} BatchCreated events`);

    // Process events
    const batchData = await Promise.all(
      events.map(async event => {
        const parsedLog = iface.parseLog({
          topics: event.topics,
          data: event.data,
        });

        if (!parsedLog) {
          console.warn('Failed to parse log:', event);
          return null;
        }

        // Get block timestamp
        const block = await provider.getBlock(event.blockNumber);
        const timestamp = block?.timestamp || 0;

        // Extract and format event data
        return {
          batchId: parsedLog.args[0],
          totalAmount: parsedLog.args[1].toString(),
          normalisedBalance: parsedLog.args[2].toString(),
          owner: parsedLog.args[3],
          payer: parsedLog.args[4],
          depth: Number(parsedLog.args[5]),
          bucketDepth: Number(parsedLog.args[6]),
          immutable_: parsedLog.args[7],
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          timestamp: timestamp,
          // Add human-readable date for reference
          date: new Date(timestamp * 1000).toISOString(),
        };
      })
    );

    // Filter out any null entries from failed parses
    const validBatchData = batchData.filter(data => data !== null);

    // Group batches by owner
    const batchesByOwner = {};
    validBatchData.forEach(batch => {
      if (!batchesByOwner[batch.owner]) {
        batchesByOwner[batch.owner] = [];
      }
      batchesByOwner[batch.owner].push(batch);
    });

    // Create final data structure
    const migrationData = {
      metadata: {
        contractAddress: CONTRACT_ADDRESS,
        startBlock: START_BLOCK,
        endBlock: currentBlock,
        totalBatches: validBatchData.length,
        uniqueOwners: Object.keys(batchesByOwner).length,
        exportDate: new Date().toISOString(),
      },
      batchesByOwner,
      allBatches: validBatchData,
    };

    // Save to file
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(migrationData, null, 2));

    console.log('\nMigration Summary:');
    console.log('------------------');
    console.log(`Total batches found: ${validBatchData.length}`);
    console.log(`Unique owners: ${Object.keys(batchesByOwner).length}`);
    console.log(`Data saved to: ${OUTPUT_FILE}`);
    console.log('\nMigration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

// Run the migration
fetchBatchEvents().catch(console.error);
