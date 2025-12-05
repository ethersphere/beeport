#!/usr/bin/env node

/**
 * Test a specific route with custom amounts
 * Usage: node scripts/testSingleRoute.js [chainId] [startAmount] [endAmount] [step]
 * Example: node scripts/testSingleRoute.js 1 10 100 10
 */

const GNOSIS_CHAIN_ID = 100;
const GNOSIS_BZZ_ADDRESS = '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da';
const WALLET_ADDRESS = '0xb1c7f17ed88189abf269bf68a3b2ed83c5276aae';

// Parse command line arguments
const args = process.argv.slice(2);
const chainId = parseInt(args[0]) || 100;
const startAmount = parseInt(args[1]) || 1;
const endAmount = parseInt(args[2]) || 50;
const step = parseInt(args[3]) || 5;

const CHAIN_NAMES = {
  1: 'Ethereum',
  100: 'Gnosis',
  137: 'Polygon',
  42161: 'Arbitrum',
  8453: 'Base',
  10: 'Optimism',
};

function bzzToWei(bzz) {
  // BZZ has 16 decimals, not 18!
  return (BigInt(bzz) * BigInt('10000000000000000')).toString(); // 10^16
}

async function testAmount(chainId, bzzAmount) {
  const request = {
    user: WALLET_ADDRESS,
    recipient: WALLET_ADDRESS,
    originChainId: chainId,
    destinationChainId: GNOSIS_CHAIN_ID,
    originCurrency: '0x0000000000000000000000000000000000000000',
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
      };
    }

    return {
      success: true,
      costUSD: parseFloat(data.details?.currencyIn?.amountUsd || 0),
      gasFeeUSD: parseFloat(data.fees?.gas?.amountUsd || 0),
      relayerFeeUSD: parseFloat(data.fees?.relayer?.amountUsd || 0),
      timeEstimate: data.details?.timeEstimate || 0,
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('🔍 Single Route Liquidity Test');
  console.log('═'.repeat(70));
  console.log(`Chain: ${CHAIN_NAMES[chainId] || chainId}`);
  console.log(`Destination: BZZ on Gnosis`);
  console.log(`Range: ${startAmount} - ${endAmount} BZZ (step: ${step})`);
  console.log('═'.repeat(70));
  console.log('');

  let maxWorking = 0;
  let minFailing = null;

  for (let amount = startAmount; amount <= endAmount; amount += step) {
    process.stdout.write(`${amount.toString().padStart(4)} BZZ → `);

    const result = await testAmount(chainId, amount);

    if (result.success) {
      maxWorking = amount;
      const total = result.costUSD;
      const fees = result.gasFeeUSD + result.relayerFeeUSD;
      console.log(`✅ $${total.toFixed(2)} (fees: $${fees.toFixed(2)}, ${result.timeEstimate}s)`);
    } else {
      if (!minFailing) minFailing = amount;
      console.log(`❌ ${result.error.substring(0, 50)}`);
    }

    await new Promise(resolve => setTimeout(resolve, 800));
  }

  console.log('');
  console.log('═'.repeat(70));
  console.log('RESULT');
  console.log('═'.repeat(70));

  if (maxWorking > 0) {
    console.log(`✅ Maximum working amount: ${maxWorking} BZZ`);
    if (minFailing) {
      console.log(`❌ Liquidity fails at: ${minFailing} BZZ`);
      console.log(`💡 Liquidity limit is between ${maxWorking} - ${minFailing} BZZ`);
    } else {
      console.log(`💡 All tested amounts work! Try higher amounts.`);
    }
  } else {
    console.log(`❌ No amounts work - route may not be available`);
  }

  console.log('═'.repeat(70));
}

main().catch(console.error);

