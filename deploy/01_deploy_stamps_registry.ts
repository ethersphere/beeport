import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log('Deploying StampsRegistry and waiting for confirmations...');

  // Get the Swarm contract address from environment variables
  // This is the address of the PostageStamp contract on Gnosis Chain
  const swarmContractAddress =
    process.env.SWARM_CONTRACT_ADDRESS || '0x45a1502382541Cd610CC9068e88727426b696293';

  // Deploy the StampsRegistry contract
  const stampsRegistry = await deploy('StampsRegistry', {
    from: deployer,
    args: [swarmContractAddress],
    log: true,
    // If we're on a local network, we don't need to wait for confirmations
    waitConfirmations: network.name === 'hardhat' ? 1 : 5,
  });

  log(`StampsRegistry deployed at ${stampsRegistry.address}`);

  // Verify the contract on Etherscan if we're not on a local network
  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    log('Verifying contract on Etherscan...');
    try {
      await hre.run('verify:verify', {
        address: stampsRegistry.address,
        constructorArguments: [swarmContractAddress],
        contract: 'contracts/StampsRegistry.sol:StampsRegistry',
      });
      log('Contract verified successfully');
    } catch (error) {
      log('Error verifying contract:', error);
    }
  }

  log('----------------------------------------------------');
};

export default func;
func.tags = ['StampsRegistry', 'all'];
