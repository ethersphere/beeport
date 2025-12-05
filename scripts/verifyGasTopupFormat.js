#!/usr/bin/env node

/**
 * Verify the correct format for topupGasAmount
 * Test both formats to see which one works
 * Run with: node scripts/verifyGasTopupFormat.js
 */

const TEST_ADDRESS = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const GNOSIS_CHAIN_ID = 100;
const BZZ_TOKEN = '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da';

async function testGasTopupFormat(topupAmount, description) {
  console.log('\n' + '='.repeat(80));
  console.log(`Testing: ${description}`);
  console.log(`topupGasAmount: "${topupAmount}"`);
  console.log('='.repeat(80));

  const request = {
    user: TEST_ADDRESS,
    recipient: TEST_ADDRESS,
    originChainId: 1, // Ethereum
    destinationChainId: GNOSIS_CHAIN_ID,
    originCurrency: '0x0000000000000000000000000000000000000000', // Native ETH
    destinationCurrency: BZZ_TOKEN,
    amount: '5000000000000000000', // 5 BZZ
    tradeType: 'EXACT_OUTPUT',
    slippageTolerance: '500',
    refundOnOrigin: true,
    topupGas: true,
    topupGasAmount: topupAmount,
  };

  console.log('\n📤 Request:');
  console.log(JSON.stringify(request, null, 2));

  try {
    const response = await fetch('https://api.relay.link/quote', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    console.log(`\n📊 Response Status: ${response.status} ${response.statusText}`);

    const responseText = await response.text();

    if (!response.ok) {
      console.log('\n❌ Error Response:');
      try {
        const errorData = JSON.parse(responseText);
        console.log(JSON.stringify(errorData, null, 2));
      } catch {
        console.log(responseText);
      }
      return { success: false, error: responseText };
    }

    const data = JSON.parse(responseText);
    console.log('\n✅ Success! Gas Top-up Details:');

    // Try to find gas top-up amount in response
    if (data.fees && data.fees.gas) {
      console.log(`  Gas Fee USD: $${data.fees.gas.amountUsd || 'N/A'}`);
    }

    // Look for gas currency in the response
    if (data.details) {
      console.log(`  Currency In USD: $${data.details.currencyIn?.amountUsd || 'N/A'}`);
      console.log(`  Time Estimate: ${data.details.timeEstimate || 'N/A'} seconds`);
    }

    return { success: true, data };
  } catch (error) {
    console.log('\n❌ Network Error:');
    console.error(error.message);
    return { success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🔬 Testing Gas Top-up Amount Format\n');
  console.log('Testing different formats to find which one works:\n');

  const tests = [
    { amount: '1.00', description: 'Decimal format: "1.00" (my assumption)' },
    { amount: '1', description: 'Integer format: "1"' },
    { amount: '100000', description: 'Format from search: "100000" (claimed to be $1)' },
    { amount: '1000000', description: 'Original code: "1000000" (might be $1)' },
    { amount: '2000000', description: 'Documentation default: "2000000" (claimed to be $2)' },
  ];

  const results = [];

  for (const test of tests) {
    const result = await testGasTopupFormat(test.amount, test.description);
    results.push({ ...test, ...result });

    // Wait between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));

  results.forEach(result => {
    const status = result.success ? '✅ WORKS' : '❌ FAILED';
    console.log(`\n${status}: ${result.description}`);
    console.log(`  Value: "${result.amount}"`);
    if (!result.success && result.error) {
      const errorPreview = String(result.error).substring(0, 100);
      console.log(`  Error: ${errorPreview}...`);
    }
  });

  console.log('\n' + '='.repeat(80));
  console.log('CONCLUSION:');
  console.log('The format that works is the correct one to use in your code.');
  console.log('='.repeat(80));
}

runTests().catch(console.error);
