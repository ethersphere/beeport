import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log('----------------------------------------------------');
  log('Deploying StampsRegistryV2 and waiting for confirmations...');

  // Upstream Postage Stamp contract on Gnosis Chain. Same default as
  // the V1 registry deploy script — override via env if you target a
  // different upstream deployment.
  const swarmContractAddress =
    process.env.SWARM_CONTRACT_ADDRESS || '0x45a1502382541Cd610CC9068e88727426b696293';

  // BZZ token on Gnosis. Hard-coded in the V1 contract; passed as a
  // constructor arg in V2 to keep the contract upstream-redeploy-friendly
  // and easier to test against forks / mocks.
  const bzzAddress = process.env.GNOSIS_BZZ_ADDRESS || '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da';

  const stampsRegistryV2 = await deploy('StampsRegistryV2', {
    from: deployer,
    args: [swarmContractAddress, bzzAddress],
    log: true,
    waitConfirmations: network.name === 'hardhat' ? 1 : 5,
  });

  log(`StampsRegistryV2 deployed at ${stampsRegistryV2.address}`);
  log(`  Postage Stamp: ${swarmContractAddress}`);
  log(`  BZZ:           ${bzzAddress}`);

  if (network.name !== 'hardhat' && network.name !== 'localhost') {
    log('Verifying contract on GnosisScan...');
    try {
      await hre.run('verify:verify', {
        address: stampsRegistryV2.address,
        constructorArguments: [swarmContractAddress, bzzAddress],
        contract: 'contracts/StampsRegistryV2.sol:StampsRegistryV2',
      });
      log('Contract verified successfully on GnosisScan');
    } catch (error) {
      log('Error verifying on GnosisScan:', error);
    }

    log('Verifying contract on Sourcify...');
    try {
      await hre.run('sourcify', { address: stampsRegistryV2.address });
      log('Contract verified successfully on Sourcify');
    } catch (error) {
      log('Error verifying on Sourcify:', error);
    }
  }

  log('----------------------------------------------------');
};

export default func;
func.tags = ['StampsRegistryV2', 'all'];
