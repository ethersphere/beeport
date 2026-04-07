/**
 * Standalone verification script for SushiSwapStampsRouter on Gnosis chain.
 *
 * Tries both verification methods supported by @nomicfoundation/hardhat-verify v2:
 *   1. GnosisScan (Etherscan-compatible API)   – requires MAINNET_ETHERSCAN_KEY in .env
 *   2. Sourcify                                 – no API key needed
 *
 * Usage
 * ─────
 *   # From the project root:
 *   npx hardhat run scripts/verify_router.ts --network gnosis
 *
 *   # Or pass the address via env variable (overrides the deployments/ cache):
 *   ROUTER_ADDRESS=0xYourDeployedAddress npx hardhat run scripts/verify_router.ts --network gnosis
 *
 * Requirements
 * ────────────
 *   WALLET_SECRET           – deployer private key (for reading deployments)
 *   GNOSIS_RPC_URL          – Gnosis RPC endpoint
 *   MAINNET_ETHERSCAN_KEY   – GnosisScan API key (for Etherscan-style verification)
 *   GNOSIS_STAMPS_REGISTRY  – StampsRegistry address (constructor arg; default shown below)
 */

import { run, deployments } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  // ── Resolve router address ────────────────────────────────────────────────
  let routerAddress: string | undefined = process.env.ROUTER_ADDRESS;

  if (!routerAddress) {
    try {
      const deployment = await deployments.get('SushiSwapStampsRouter');
      routerAddress = deployment.address;
      console.log(`📦 Loaded address from deployments cache: ${routerAddress}`);
    } catch {
      console.error(
        '❌ No ROUTER_ADDRESS env var set and no deployment found in deployments/ cache.\n' +
          '   Run the deploy script first, or set ROUTER_ADDRESS=0x...'
      );
      process.exit(1);
    }
  }

  // ── Resolve constructor arg ───────────────────────────────────────────────
  const stampsRegistry =
    process.env.GNOSIS_STAMPS_REGISTRY ||
    '0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3';

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('SushiSwapStampsRouter Verification');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`Router address    : ${routerAddress}`);
  console.log(`StampsRegistry    : ${stampsRegistry}`);
  console.log(`Network           : gnosis (chainId 100)`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── 1. GnosisScan / Etherscan API verification ────────────────────────────
  console.log('▶ Step 1 – GnosisScan (Etherscan API) verification …');
  try {
    await run('verify:verify', {
      address: routerAddress,
      constructorArguments: [stampsRegistry],
      contract: 'contracts/SushiSwapStampsRouter.sol:SushiSwapStampsRouter',
    });
    console.log(`✅ GnosisScan verified: https://gnosisscan.io/address/${routerAddress}#code\n`);
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (msg.toLowerCase().includes('already verified')) {
      console.log(`ℹ️  Already verified on GnosisScan.\n`);
    } else {
      console.warn(`⚠️  GnosisScan verification failed:\n   ${msg}\n`);
      console.log('   Manual command:');
      console.log(
        `   npx hardhat verify --network gnosis ${routerAddress} ${stampsRegistry}\n`
      );
    }
  }

  // ── 2. Sourcify verification (no API key, v2) ─────────────────────────────
  console.log('▶ Step 2 – Sourcify (v2) verification …');
  try {
    await run('sourcify', {
      address: routerAddress,
      constructorArguments: [stampsRegistry],
    });
    console.log('✅ Sourcify verified!');
    console.log(
      `   View: https://repo.sourcify.dev/contracts/full_match/100/${routerAddress}/\n`
    );
  } catch (err: any) {
    const msg: string = err?.message ?? String(err);
    if (
      msg.toLowerCase().includes('already verified') ||
      msg.toLowerCase().includes('already full match')
    ) {
      console.log('ℹ️  Already verified on Sourcify.\n');
    } else {
      console.warn(`⚠️  Sourcify verification failed:\n   ${msg}\n`);
      console.log('   Manual command:');
      console.log(`   npx hardhat sourcify --network gnosis --address ${routerAddress}\n`);
    }
  }

  console.log('══════════════════════════════════════════════════════════');
  console.log('Verification complete.');
  console.log('══════════════════════════════════════════════════════════');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
