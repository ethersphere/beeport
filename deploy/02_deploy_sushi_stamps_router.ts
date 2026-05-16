import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

/**
 * Deploys the SushiSwapStampsRouter contract on Gnosis Chain.
 *
 * The router swaps any Gnosis-chain token → BZZ via SushiSwap V3 and atomically
 * creates or tops up a Swarm postage-stamp batch in a single transaction.
 *
 * Prerequisites
 * ─────────────
 * Set these in your .env (or .env.local) before running:
 *
 *   WALLET_SECRET           Private key of the deployer account
 *   GNOSIS_RPC_URL          Gnosis RPC (e.g. https://rpc.gnosischain.com)
 *   GNOSIS_STAMPS_REGISTRY  Address of the deployed StampsRegistry contract
 *                           Defaults to: 0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3
 *   MAINNET_ETHERSCAN_KEY   GnosisScan API key for contract verification
 *
 * Deploy command
 * ──────────────
 *   npx hardhat deploy --network gnosis --tags SushiSwapStampsRouter
 *
 * Manual verification (if auto-verify fails)
 * ────────────────────────────────────────────
 *   npx hardhat verify --network gnosis <DEPLOYED_ADDRESS> <STAMPS_REGISTRY_ADDRESS>
 */

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('─────────────────────────────────────────────────────────────────');
  log('Deploying SushiSwapStampsRouter …');

  // The existing StampsRegistry that the router will call after swapping BZZ.
  // Must be the same registry the frontend uses (GNOSIS_CUSTOM_REGISTRY_ADDRESS).
  const stampsRegistryAddress =
    process.env.GNOSIS_STAMPS_REGISTRY ||
    '0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3';

  log(`  StampsRegistry → ${stampsRegistryAddress}`);
  log(`  Deployer       → ${deployer}`);
  log(`  Network        → ${network.name} (chainId: ${network.config.chainId ?? 'unknown'})`);

  const router = await deploy('SushiSwapStampsRouter', {
    from: deployer,
    args: [stampsRegistryAddress],
    log: true,
    waitConfirmations: network.name === 'hardhat' ? 1 : 5,
  });

  log(`SushiSwapStampsRouter deployed at → ${router.address}`);

  // ── Contract Verification ───────────────────────────────────────────────────

  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    // ── 1. Etherscan / GnosisScan API verification ────────────────────────────
    log('Verifying on GnosisScan (Etherscan API) …');
    try {
      await hre.run('verify:verify', {
        address: router.address,
        constructorArguments: [stampsRegistryAddress],
        contract: 'contracts/SushiSwapStampsRouter.sol:SushiSwapStampsRouter',
      });
      log('✅ GnosisScan verification successful');
    } catch (error: any) {
      if (error?.message?.toLowerCase().includes('already verified')) {
        log('ℹ️  Already verified on GnosisScan');
      } else {
        log('⚠️  GnosisScan verification failed – will try Sourcify next');
        log(`   Manual retry: npx hardhat verify --network gnosis ${router.address} ${stampsRegistryAddress}`);
        log(`   Error: ${error?.message ?? error}`);
      }
    }

    // ── 2. Sourcify verification (v2 – no API key required) ──────────────────
    log('Verifying on Sourcify (v2) …');
    try {
      await hre.run('sourcify', {
        address: router.address,
        constructorArguments: [stampsRegistryAddress],
      });
      log('✅ Sourcify verification successful');
      log(`   View: https://repo.sourcify.dev/contracts/full_match/100/${router.address}/`);
    } catch (error: any) {
      if (
        error?.message?.toLowerCase().includes('already verified') ||
        error?.message?.toLowerCase().includes('already full match')
      ) {
        log('ℹ️  Already verified on Sourcify');
      } else {
        log('⚠️  Sourcify verification failed');
        log(`   Manual retry: npx hardhat sourcify --network gnosis --address ${router.address}`);
        log(`   Error: ${error?.message ?? error}`);
      }
    }
  }

  // ── Post-deploy summary ─────────────────────────────────────────────────────

  log('─────────────────────────────────────────────────────────────────');
  log('Deployment summary:');
  log(`  SushiSwapStampsRouter : ${router.address}`);
  log(`  StampsRegistry        : ${stampsRegistryAddress}`);
  log('');
  log('Add this to your .env.local / environment:');
  log(`  NEXT_PUBLIC_SUSHI_STAMPS_ROUTER_ADDRESS=${router.address}`);
  log('');
  log('Known Gnosis SushiSwap V3 addresses (for reference):');
  log('  Factory  : 0xf78031cbca409f2fb6876bdfdbc1b2df24cf9bef');
  log('  Quoter   : 0xb1e835dc2785b52265711e17fccb0fd018226a6e');
  log('  BZZ/USDC pool: 0x6f30b7cf40cb423c1d23478a9855701ecf43931e');
  log('─────────────────────────────────────────────────────────────────');
};

export default func;
func.tags = ['SushiSwapStampsRouter', 'all'];

// This deploy script depends on StampsRegistry already being deployed.
// If you want automatic ordering, uncomment the next line:
// func.dependencies = ['StampsRegistry'];
