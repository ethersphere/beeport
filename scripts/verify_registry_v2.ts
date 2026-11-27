/**
 * Standalone verification script for StampsRegistryV2 on Gnosis chain.
 *
 * Usage
 * ─────
 *   npm run verify:registry-v2
 *
 *   # Pass the address explicitly:
 *   REGISTRY_V2_ADDRESS=0xYourAddress npm run verify:registry-v2
 */

import { run, deployments } from 'hardhat';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

async function main() {
  let registryAddress: string | undefined = process.env.REGISTRY_V2_ADDRESS;

  if (!registryAddress) {
    try {
      const deployment = await deployments.get('StampsRegistryV2');
      registryAddress = deployment.address;
      console.log(`📦 Loaded address from deployments cache: ${registryAddress}`);
    } catch {
      console.error(
        '❌ No REGISTRY_V2_ADDRESS env var set and no deployment found.\n' +
          '   Set REGISTRY_V2_ADDRESS=0x... or run `npm run deploy:registry-v2` first.'
      );
      process.exit(1);
    }
  }

  const swarmContractAddress =
    process.env.SWARM_CONTRACT_ADDRESS ||
    '0x45a1502382541Cd610CC9068e88727426b696293';
  const bzzAddress =
    process.env.GNOSIS_BZZ_ADDRESS || '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da';

  console.log('\n══════════════════════════════════════════════════════════');
  console.log('StampsRegistryV2 Verification');
  console.log('══════════════════════════════════════════════════════════');
  console.log(`Registry V2 address : ${registryAddress}`);
  console.log(`Postage Stamp       : ${swarmContractAddress}`);
  console.log(`BZZ                 : ${bzzAddress}`);
  console.log('══════════════════════════════════════════════════════════\n');

  console.log('▶ Step 1 – GnosisScan (Etherscan API) …');
  try {
    await run('verify:verify', {
      address: registryAddress,
      constructorArguments: [swarmContractAddress, bzzAddress],
      contract: 'contracts/StampsRegistryV2.sol:StampsRegistryV2',
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

  console.log('▶ Step 2 – Sourcify (v2) …');
  try {
    await run('sourcify', {
      address: registryAddress,
      constructorArguments: [swarmContractAddress, bzzAddress],
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
