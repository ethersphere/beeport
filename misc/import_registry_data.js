const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { ethers } = require('ethers');
const fs = require('fs');

// CONFIGURATION
const RPC_URL = process.env.GNOSIS_RPC_URL || 'https://gnosis-rpc.publicnode.com';
const WALLET_SECRET = process.env.WALLET_SECRET;
const CONTRACT_ADDRESS = '0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3'; // <-- update this!
const ABI = [
  // Function has different parameter order than the JSON structure!
  'function migrateBatchRegistry(address _owner, bytes32 _batchId, uint256 _totalAmount, uint256 _normalisedBalance, address _nodeAddress, uint8 _depth, uint8 _bucketDepth, bool _immutable, uint256 _timestamp) external',
];

// 1. Load JSON data
const dataPath = path.join(__dirname, 'registry_data.json');
const json = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
const batches = json.allBatches;

// Add array of payers to skip
const SKIP_PAYERS = [
  '0xb1C7F17Ed88189Abf269Bf68A3B2Ed83C5276aAe'.toLowerCase(),
  '0xB1620c0547744DeDD30F40a863c09D1964532F8C'.toLowerCase(),
];

async function main() {
  if (!WALLET_SECRET) throw new Error('WALLET_SECRET not set in environment');
  if (!CONTRACT_ADDRESS.startsWith('0x')) throw new Error('Set CONTRACT_ADDRESS in script!');

  // 2. Setup provider and wallet
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(WALLET_SECRET, provider);

  // 3. Setup contract
  const contract = new ethers.Contract(CONTRACT_ADDRESS, ABI, wallet);

  // 4. Migrate each batch
  for (const batch of batches) {
    // Skip if payer is in SKIP_PAYERS
    if (SKIP_PAYERS.includes(batch.payer.toLowerCase())) {
      console.log(`Skipping batch ${batch.batchId} (payer ${batch.payer} is in SKIP_PAYERS)`);
      continue;
    }
    try {
      console.log(`Migrating batch: ${batch.batchId}`);

      // Log the data we're about to send for debugging
      console.log('Batch data:', {
        owner: batch.payer,
        batchId: batch.batchId,
        totalAmount: batch.totalAmount,
        normalisedBalance: batch.normalisedBalance,
        nodeAddress: batch.owner, // We're using owner as nodeAddress based on contract
        depth: batch.depth,
        bucketDepth: batch.bucketDepth,
        immutable_: batch.immutable_,
        timestamp: batch.timestamp,
      });

      // Call with correct parameter order based on contract function signature
      const tx = await contract.migrateBatchRegistry(
        batch.payer, // _owner (using payer as the owner)
        batch.batchId, // _batchId
        batch.totalAmount, // _totalAmount
        batch.normalisedBalance, // _normalisedBalance
        batch.owner, // _nodeAddress (using owner as nodeAddress)
        batch.depth, // _depth
        batch.bucketDepth, // _bucketDepth
        batch.immutable_, // _immutable
        batch.timestamp // _timestamp
      );
      console.log(`  Tx sent: ${tx.hash}`);
      await tx.wait();
      console.log(`  Tx confirmed!`);
    } catch (err) {
      console.error(`  Error migrating batch ${batch.batchId}:`, err);
    }
  }
}

main().catch(console.error);
