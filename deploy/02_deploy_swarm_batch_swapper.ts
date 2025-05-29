import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log, get } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log('Deploying SwarmBatchSwapper and waiting for confirmations...');

  // Get the StampsRegistry address from the previous deployment
  let batchRegistryAddress: string;
  try {
    const stampsRegistry = await get('StampsRegistry');
    batchRegistryAddress = stampsRegistry.address;
    log(`Using StampsRegistry at: ${batchRegistryAddress}`);
  } catch (error) {
    // Fallback to environment variable if StampsRegistry not deployed
    batchRegistryAddress =
      process.env.GNOSIS_CUSTOM_REGISTRY_ADDRESS || '0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3';
    log(`Using fallback StampsRegistry address: ${batchRegistryAddress}`);
  }

  // Contract addresses on Gnosis Chain
  const sushiRouterAddress = '0x1b02dA8Cb0d097eB8D57A175b88c7D8b47997506'; // SushiSwap V2 Router
  const bzzTokenAddress = '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da'; // BZZ token
  const defaultInputTokenAddress = '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83'; // USDC
  const defaultPoolAddress = '0x6f30b7cf40cb423c1d23478a9855701ecf43931e'; // BZZ/USDC pool

  // Deploy the SwarmBatchSwapper contract
  const swarmBatchSwapper = await deploy('SwarmBatchSwapper', {
    from: deployer,
    args: [
      sushiRouterAddress,
      batchRegistryAddress,
      bzzTokenAddress,
      defaultInputTokenAddress,
      defaultPoolAddress,
      '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI Token
    ],
    log: true,
    // If we're on a local network, we don't need to wait for confirmations
    waitConfirmations: network.name === 'hardhat' ? 1 : 5,
  });

  log(`SwarmBatchSwapper deployed at ${swarmBatchSwapper.address}`);
  log('Constructor arguments:');
  log(`  SushiSwap Router: ${sushiRouterAddress}`);
  log(`  Batch Registry: ${batchRegistryAddress}`);
  log(`  BZZ Token: ${bzzTokenAddress}`);
  log(`  Default Input Token (USDC): ${defaultInputTokenAddress}`);
  log(`  Default Pool: ${defaultPoolAddress}`);

  // Verify the contract on Etherscan if we're not on a local network
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    log('Verifying contract on Etherscan...');
    try {
      await hre.run('verify:verify', {
        address: swarmBatchSwapper.address,
        constructorArguments: [
          sushiRouterAddress,
          batchRegistryAddress,
          bzzTokenAddress,
          defaultInputTokenAddress,
          defaultPoolAddress,
          '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', // WXDAI Token
        ],
        contract: 'contracts/SwarmBatchSwapper.sol:SwarmBatchSwapper',
      });
      log('Contract verified successfully');
    } catch (error) {
      log('Error verifying contract:', error);
    }
  }

  // Update the constants file with the deployed address
  log('----------------------------------------------------');
  log('IMPORTANT: Update the following in your constants file:');
  log(`export const SWARM_BATCH_SWAPPER_ADDRESS = '${swarmBatchSwapper.address}';`);
  log('----------------------------------------------------');
};

export default func;
func.tags = ['SwarmBatchSwapper', 'all'];
func.dependencies = ['StampsRegistry']; // Deploy after StampsRegistry
