/**
 * Standalone verification script for StampsRegistry on Gnosis chain.
 *
 * Usage
 * ─────
 *   npx hardhat run scripts/verify_registry.ts --network gnosis
 *
 *   # Or pass the address explicitly:
 *   REGISTRY_ADDRESS=0xYourAddress npx hardhat run scripts/verify_registry.ts --network gnosis
 */

import { run, deployments } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  let registryAddress: string | undefined = process.env.REGISTRY_ADDRESS;

  if (!registryAddress) {
    try {
      const deployment = await deployments.get('StampsRegistry');
      registryAddress = deployment.address;
      console.log(`📦 Loaded address from deployments cache: ${registryAddress}`);
    } catch {
      console.error(
        '❌ No REGISTRY_ADDRESS env var set and no deployment found.\n' +
          '   Set REGISTRY_ADDRESS=0x... or run the deploy script first.'
      );
      process.exit(1);
    }
  }

  const swarmContractAddress =
    process.env.SWARM_CONTRACT_ADDRESS ||
    '0x45a1502382541Cd610CC9068e88727426b696293';

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('StampsRegistry Verification');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`Registry address  : ${registryAddress}`);
  console.log(`SwarmContract     : ${swarmContractAddress}`);
  console.log('══════════════════════════════════════════════════════════\n');

  // ── GnosisScan ────────────────────────────────────────────────────────────
  console.log('▶ Step 1 – GnosisScan (Etherscan API) …');
  try {
    await run('verify:verify', {
      address: registryAddress,
      constructorArguments: [swarmContractAddress],
      contract: 'contracts/StampsRegistry.sol:StampsRegistry',
    });
    console.log(`✅ GnosisScan verified: https://gnosisscan.io/address/${registryAddress}#code\n`);
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (msg.toLowerCase().includes('already verified')) {
      console.log('ℹ️  Already verified on GnosisScan.\n');
    } else {
      console.warn(`⚠️  Failed: ${msg}\n`);
    }
  }

  // ── Sourcify ──────────────────────────────────────────────────────────────
  console.log('▶ Step 2 – Sourcify (v2) …');
  try {
    await run('sourcify', {
      address: registryAddress,
      constructorArguments: [swarmContractAddress],
    });
    console.log('✅ Sourcify verified!\n');
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    if (msg.toLowerCase().includes('already') || msg.toLowerCase().includes('full match')) {
      console.log('ℹ️  Already verified on Sourcify.\n');
    } else {
      console.warn(`⚠️  Failed: ${msg}\n`);
    }
  }

  console.log('Done.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
