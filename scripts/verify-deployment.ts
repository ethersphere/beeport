const { ethers } = require('hardhat');

async function main() {
  console.log('Verifying SwarmBatchSwapper deployment...');

  // Get the deployed contract
  const SwarmBatchSwapper = await ethers.getContractFactory('SwarmBatchSwapper');

  // You can replace this with the actual deployed address
  const deployedAddress =
    process.env.SWARM_BATCH_SWAPPER_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';

  const swarmBatchSwapper = SwarmBatchSwapper.attach(deployedAddress);

  console.log(`Connected to SwarmBatchSwapper at: ${deployedAddress}`);

  try {
    // Test reading contract configuration
    const sushiRouter = await swarmBatchSwapper.sushiRouter();
    const batchRegistry = await swarmBatchSwapper.batchRegistry();
    const bzzToken = await swarmBatchSwapper.bzzToken();
    const defaultInputToken = await swarmBatchSwapper.defaultInputToken();
    const defaultPool = await swarmBatchSwapper.defaultPool();

    console.log('\n✅ Contract Configuration:');
    console.log(`  SushiSwap Router: ${sushiRouter}`);
    console.log(`  Batch Registry: ${batchRegistry}`);
    console.log(`  BZZ Token: ${bzzToken}`);
    console.log(`  Default Input Token: ${defaultInputToken}`);
    console.log(`  Default Pool: ${defaultPool}`);

    // Test the getExpectedBzzOutput function with BZZ token (should return same amount)
    const testAmount = ethers.parseEther('1.0');
    const expectedBzz = await swarmBatchSwapper.getExpectedBzzOutput(bzzToken, testAmount);

    console.log(`\n✅ BZZ Output Test:`);
    console.log(`  Input: ${ethers.formatEther(testAmount)} BZZ`);
    console.log(`  Expected Output: ${ethers.formatEther(expectedBzz)} BZZ`);

    if (expectedBzz === testAmount) {
      console.log(`  ✅ BZZ passthrough working correctly`);
    } else {
      console.log(`  ❌ BZZ passthrough not working as expected`);
    }

    console.log('\n🎉 SwarmBatchSwapper deployment verification completed successfully!');
  } catch (error) {
    console.error('❌ Error verifying deployment:', error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });
