#!/usr/bin/env node

/**
 * Test Relay API liquidity limits
 * Finds the maximum swap amount that works for different routes
 * Run with: node scripts/testRelayAPI.js
 */

const GNOSIS_CHAIN_ID = 100;
const GNOSIS_BZZ_ADDRESS = '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da';

// Your wallet address
const WALLET_ADDRESS = '0xb1c7f17ed88189abf269bf68a3b2ed83c5276aae';

// Test amounts in BZZ (will be converted to wei)
const TEST_AMOUNTS = [1, 5, 10, 25, 50, 100, 200];

// Routes to test
const ROUTES = [
  {
    name: 'Same-chain (Gnosis xDAI → BZZ)',
    originChainId: GNOSIS_CHAIN_ID,
    originCurrency: '0x0000000000000000000000000000000000000000', // Native xDAI
  },
  {
    name: 'Ethereum (ETH → BZZ)',
    originChainId: 1,
    originCurrency: '0x0000000000000000000000000000000000000000', // Native ETH
  },
  {
    name: 'Polygon (MATIC → BZZ)',
    originChainId: 137,
    originCurrency: '0x0000000000000000000000000000000000000000', // Native MATIC
  },
  {
    name: 'Arbitrum (ETH → BZZ)',
    originChainId: 42161,
    originCurrency: '0x0000000000000000000000000000000000000000', // Native ETH
  },
  {
    name: 'Base (ETH → BZZ)',
    originChainId: 8453,
    originCurrency: '0x0000000000000000000000000000000000000000', // Native ETH
  },
];

function bzzToWei(bzz) {
  // BZZ has 16 decimals, not 18!
  return (BigInt(bzz) * BigInt('10000000000000000')).toString(); // 10^16
}

async function testQuote(route, bzzAmount) {
  const request = {
    user: WALLET_ADDRESS,
    recipient: WALLET_ADDRESS,
    originChainId: route.originChainId,
    destinationChainId: GNOSIS_CHAIN_ID,
    originCurrency: route.originCurrency,
    destinationCurrency: GNOSIS_BZZ_ADDRESS,
    amount: bzzToWei(bzzAmount),
    tradeType: 'EXACT_OUTPUT',
    slippageTolerance: '500',
    refundOnOrigin: true,
  };

  try {
    const response = await fetch('https://api.relay.link/quote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data.message || 'Unknown error',
        errorCode: data.errorCode,
      };
    }

    return {
      success: true,
      costUSD: parseFloat(data.details?.currencyIn?.amountUsd || 0),
      timeEstimate: data.details?.timeEstimate || 0,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

async function testRoute(route) {
  console.log('\n' + '═'.repeat(80));
  console.log(`📍 ${route.name}`);
  console.log('═'.repeat(80));

  const results = [];
  let maxWorkingAmount = 0;

  for (const amount of TEST_AMOUNTS) {
    process.stdout.write(`Testing ${amount.toString().padStart(4)} BZZ... `);

    const result = await testQuote(route, amount);
    results.push({ amount, ...result });

    if (result.success) {
      maxWorkingAmount = amount;
      console.log(`✅ $${result.costUSD.toFixed(2)} (${result.timeEstimate}s)`);
    } else {
      const errorMsg = result.error.substring(0, 60);
      console.log(`❌ ${errorMsg}`);

      // If it fails, no point testing larger amounts
      if (
        errorMsg.includes('no routes found') ||
        errorMsg.includes('liquidity') ||
        errorMsg.includes('NO_SWAP')
      ) {
        console.log(`   ⚠️  Liquidity limit reached`);
        break;
      }
    }

    // Rate limiting
    await new Promise(resolve => setTimeout(resolve, 800));
  }

  return { route: route.name, maxWorkingAmount, results };
}

async function main() {
  console.log('🔍 Relay API Liquidity Test');
  console.log(`Wallet: ${WALLET_ADDRESS}`);
  console.log(`Testing amounts: ${TEST_AMOUNTS.join(', ')} BZZ\n`);

  const allResults = [];

  for (const route of ROUTES) {
    const result = await testRoute(route);
    allResults.push(result);
  }

  // Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 LIQUIDITY LIMITS SUMMARY');
  console.log('═'.repeat(80));

  allResults.forEach(({ route, maxWorkingAmount }) => {
    if (maxWorkingAmount === 0) {
      console.log(`❌ ${route.padEnd(35)} - NO ROUTE AVAILABLE`);
    } else if (maxWorkingAmount >= 200) {
      console.log(`✅ ${route.padEnd(35)} - Works for 200+ BZZ`);
    } else {
      console.log(`⚠️  ${route.padEnd(35)} - Max: ${maxWorkingAmount} BZZ`);
    }
  });

  console.log('\n' + '═'.repeat(80));
  console.log('💡 RECOMMENDATIONS');
  console.log('═'.repeat(80));

  const bestRoute = allResults.reduce((best, current) =>
    current.maxWorkingAmount > best.maxWorkingAmount ? current : best
  );

  if (bestRoute.maxWorkingAmount > 0) {
    console.log(`✅ Best route: ${bestRoute.route}`);
    console.log(`   Maximum tested: ${bestRoute.maxWorkingAmount} BZZ\n`);
  }

  const failedRoutes = allResults.filter(r => r.maxWorkingAmount === 0);
  if (failedRoutes.length > 0) {
    console.log(`❌ Routes with no liquidity:`);
    failedRoutes.forEach(r => console.log(`   - ${r.route}`));
    console.log('');
  }

  const limitedRoutes = allResults.filter(r => r.maxWorkingAmount > 0 && r.maxWorkingAmount < 200);
  if (limitedRoutes.length > 0) {
    console.log(`⚠️  Routes with limited liquidity:`);
    limitedRoutes.forEach(r => {
      console.log(`   - ${r.route}: max ${r.maxWorkingAmount} BZZ`);
      console.log(
        `     → Split larger swaps into ${Math.ceil(100 / r.maxWorkingAmount)}+ transactions`
      );
    });
    console.log('');
  }

  console.log('═'.repeat(80));
}

main().catch(console.error);
