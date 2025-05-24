import {
  getContractCallsQuote,
  ContractCallsQuoteRequest,
  convertQuoteToRoute,
  ChainId,
  getQuote,
} from '@lifi/sdk';
import { parseAbi, encodeFunctionData } from 'viem';

import {
  GetGnosisQuoteParams,
  GetCrossChainQuoteParams,
  ToAmountQuoteParams,
  ToAmountQuoteResponse,
} from './types';
import {
  GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  LIFI_API_KEY,
  DEFAULT_SLIPPAGE,
  MIN_BRIDGE_USD_VALUE,
} from './constants';

import { logTokenRoute, performWithRetry, getGnosisPublicClient } from './utils';

// Buffer percentage to apply to bidirectional quotes to compensate for slippage and fees
const BIDIRECTIONAL_BUFFER_PERCENT = 1; // 1% default buffer

/**
 * Checks if gas forwarding is needed and returns the amount to forward
 */
export const checkGasForwarding = async (
  address: string,
  selectedChainId: number | string,
  fromToken: string
): Promise<bigint> => {
  let fromAmountForGas: bigint = 0n;

  try {
    const gnosisProvider = getGnosisPublicClient();
    const balance = await gnosisProvider.getBalance({
      address: address as `0x${string}`,
    });

    if (balance === 0n) {
      console.log('No balance on Gnosis, adding gas forwarding');

      const gasApiUrl = `https://li.quest/v1/gas/suggestion/100?fromChain=${selectedChainId}&fromToken=${fromToken}`;
      const gasResponse = await fetch(gasApiUrl);
      const gasData = await gasResponse.json();

      if (gasData.available && gasData.recommended) {
        // Double the recommended gas amount to ensure sufficient funds
        fromAmountForGas = BigInt(gasData.fromAmount) * 2n;
        console.log(
          `Adding gas forwarding: ${fromAmountForGas} (~ $${
            Number(gasData.recommended.amountUsd) * 2
          })`
        );
      }
    } else {
      console.log('User already has balance on Gnosis, no gas forwarding needed');
    }
  } catch (error) {
    console.error('Error checking Gnosis balance or fetching gas suggestion:', error);
  }

  return fromAmountForGas;
};

/**
 * Gets a quote for Gnosis chain transaction
 */
export const getGnosisQuote = async ({
  gnosisSourceToken,
  address,
  bzzAmount,
  nodeAddress,
  swarmConfig,
  setEstimatedTime,
  topUpBatchId,
}: GetGnosisQuoteParams & { setEstimatedTime: (time: number) => void }) => {
  // Determine if we're doing a top-up or creating a new batch
  let postagStampTxData;

  if (topUpBatchId) {
    // If topUpBatchId is provided, we're topping up an existing batch
    console.log(`Creating top-up transaction for batch: ${topUpBatchId}`);
    postagStampTxData = encodeFunctionData({
      abi: parseAbi(swarmConfig.swarmContractAbi),
      functionName: 'topUpBatch',
      args: [topUpBatchId as `0x${string}`, swarmConfig.swarmBatchInitialBalance],
    });
  } else {
    // Otherwise, use the original createBatchRegistry function
    postagStampTxData = encodeFunctionData({
      abi: parseAbi(swarmConfig.swarmContractAbi),
      functionName: 'createBatchRegistry',
      args: [
        address,
        nodeAddress,
        swarmConfig.swarmBatchInitialBalance,
        swarmConfig.swarmBatchDepth,
        swarmConfig.swarmBatchBucketDepth,
        swarmConfig.swarmBatchNonce,
        swarmConfig.swarmBatchImmutable,
      ],
    });
  }

  // Create quote request
  const gnosisContractCallsQuoteRequest: ContractCallsQuoteRequest = {
    fromChain: ChainId.DAI,
    fromToken: gnosisSourceToken,
    fromAddress: address,
    toChain: ChainId.DAI,
    toToken: swarmConfig.swarmToken,
    toAmount: bzzAmount,
    slippage: DEFAULT_SLIPPAGE,
    allowExchanges: ['sushiswap'],
    contractCalls: [
      {
        fromAmount: bzzAmount,
        fromTokenAddress: swarmConfig.swarmToken,
        toContractAddress: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
        toContractCallData: postagStampTxData,
        toContractGasLimit: swarmConfig.swarmContractGasLimit,
      },
    ],
  };

  // Get quote
  const gnosisContactCallsQuoteResponse = await getContractCallsQuote(
    gnosisContractCallsQuoteRequest
  );

  console.info('>> Gnosis Calls Quote', gnosisContactCallsQuoteResponse);
  logTokenRoute(gnosisContactCallsQuoteResponse.includedSteps, 'Gnosis Calls Quote');

  // Extract the estimated execution duration
  if (setEstimatedTime && gnosisContactCallsQuoteResponse.estimate?.executionDuration) {
    setEstimatedTime(gnosisContactCallsQuoteResponse.estimate.executionDuration);
    console.log(
      'Gnosis Estimated Time:',
      gnosisContactCallsQuoteResponse.estimate.executionDuration
    );
  }

  return {
    gnosisContactCallsQuoteResponse,
    gnosisContractCallsRoute: convertQuoteToRoute(gnosisContactCallsQuoteResponse),
  };
};

/**
 * Gets a quote for cross chain transactions
 */
export const getCrossChainQuote = async ({
  selectedChainId,
  fromToken,
  address,
  toAmount,
  gnosisDestinationToken,
  setEstimatedTime,
}: GetCrossChainQuoteParams & { setEstimatedTime: (time: number) => void }) => {
  // Use getToAmountQuote to get required fromAmount
  const toAmountQuoteParams: ToAmountQuoteParams = {
    fromChain: selectedChainId.toString(),
    toChain: ChainId.DAI.toString(),
    fromToken: fromToken,
    toToken: gnosisDestinationToken,
    fromAddress: address as string,
    toAmount: toAmount,
  };

  console.log('Fetching toAmount quote for cross-chain transaction...');

  // Try getToAmountContractQuote first, then fall back to getToAmountQuote if it fails
  let toAmountQuoteResponse;
  try {
    console.log('Trying getToAmountContractQuote first...');
    toAmountQuoteResponse = await getToAmountContractQuote(toAmountQuoteParams);
    console.log('Successfully got quote from getToAmountContractQuote');
  } catch (error) {
    console.warn('getToAmountContractQuote failed, falling back to getToAmountQuote:', error);
    try {
      toAmountQuoteResponse = await getToAmountQuote(toAmountQuoteParams, LIFI_API_KEY);
      console.log('Successfully got quote from fallback getToAmountQuote');
    } catch (fallbackError) {
      console.error('Both quote methods failed:', fallbackError);
      throw new Error('Failed to get quote using both methods');
    }
  }

  console.info('>> Initial Cross Chain Quote (toAmount)', toAmountQuoteResponse);

  // Extract the fromAmount from the response
  const requiredFromAmount = toAmountQuoteResponse.estimate.fromAmount;
  console.log('Required fromAmount:', requiredFromAmount);

  // Check if user has any balance on Gnosis for gas forwarding
  const gasForwarding = await checkGasForwarding(address as string, selectedChainId, fromToken);

  // Calculate minimum bridge amount in the token's value
  const minCrossChainFromAmount = calculateMinCrossChainFromAmount(toAmountQuoteResponse);
  console.log(`Minimum bridge amount: ${minCrossChainFromAmount} (~ $${MIN_BRIDGE_USD_VALUE})`);

  // Ensure we're bridging at least the minimum value
  const requiredAmountBigInt = BigInt(requiredFromAmount) + BigInt(gasForwarding.toString());
  const minBridgeAmountBigInt = BigInt(minCrossChainFromAmount);

  // Use the larger of required amount or minimum bridge amount
  const finalAmount =
    requiredAmountBigInt > minBridgeAmountBigInt ? requiredAmountBigInt : minBridgeAmountBigInt;

  // Convert to string for the API
  const fromAmountToUse = finalAmount.toString();
  console.log(`Required amount: ${requiredAmountBigInt}, Minimum: ${minBridgeAmountBigInt}`);
  console.log(`Using bridge amount: ${fromAmountToUse}`);

  // Create the actual quote request with gas forwarding
  const quoteRequest = {
    fromChain: selectedChainId.toString(),
    fromToken: fromToken,
    fromAddress: address.toString(),
    fromAmount: fromAmountToUse,
    toChain: ChainId.DAI.toString(),
    toToken: gnosisDestinationToken,
    fromAmountForGas: gasForwarding as any, // Type assertion to work around SDK issue #239
    slippage: DEFAULT_SLIPPAGE,
    order: 'FASTEST' as const,
  };

  // Can't comply because of https://github.com/lifinance/sdk/issues/239
  const crossChainContractQuoteResponse = await getQuote(quoteRequest);

  console.info('>> Cross Chain Quote with Gas Forwarding', crossChainContractQuoteResponse);
  logTokenRoute(
    crossChainContractQuoteResponse.includedSteps,
    'Cross Chain Quote with Gas Forwarding'
  );

  // Extract the estimated execution duration
  if (setEstimatedTime && crossChainContractQuoteResponse.estimate?.executionDuration) {
    setEstimatedTime(crossChainContractQuoteResponse.estimate.executionDuration);
  }
  console.log(
    'Estimated Bridge Time:',
    crossChainContractQuoteResponse.estimate?.executionDuration
  );

  return {
    crossChainContractQuoteResponse,
    crossChainContractCallsRoute: convertQuoteToRoute(crossChainContractQuoteResponse),
  };
};

/**
 * Calculates the minimum bridge amount based on MIN_BRIDGE_USD_VALUE
 */
const calculateMinCrossChainFromAmount = (quoteResponse: any): string => {
  // If the response doesn't have USD value info, return a small default amount
  if (!quoteResponse.estimate?.fromAmountUSD || !quoteResponse.estimate?.fromAmount) {
    return '1000000'; // Small default value
  }

  try {
    // Get the USD value and token amount from the quote
    const fromAmountUsd = parseFloat(quoteResponse.estimate.fromAmountUSD);
    const fromAmount = quoteResponse.estimate.fromAmount;

    console.log(`Current bridge value: $${fromAmountUsd}, token amount: ${fromAmount}`);

    if (fromAmountUsd <= 0) return fromAmount;

    // If the current USD value is already >= the minimum, return the original amount
    if (fromAmountUsd >= MIN_BRIDGE_USD_VALUE) {
      console.log(`Current value $${fromAmountUsd} already meets minimum $${MIN_BRIDGE_USD_VALUE}`);
      return fromAmount;
    }

    // Calculate how many tokens would equal MIN_BRIDGE_USD_VALUE using BigInt for precision
    // We'll use a scaled ratio approach to maintain precision with BigInt
    const PRECISION = 1000000; // 6 decimal places of precision
    const scaledRatio = Math.ceil((MIN_BRIDGE_USD_VALUE / fromAmountUsd) * PRECISION);
    const fromAmountBigInt = BigInt(fromAmount);
    const minTokenAmount = (fromAmountBigInt * BigInt(scaledRatio)) / BigInt(PRECISION);

    console.log(`Current USD value: $${fromAmountUsd}, Target USD value: $${MIN_BRIDGE_USD_VALUE}`);
    console.log(`Ratio: ${scaledRatio / PRECISION}, Original amount: ${fromAmount}`);
    console.log(`Calculated min token amount: ${minTokenAmount}`);

    return minTokenAmount.toString();
  } catch (error) {
    console.error('Error calculating min cross chain amount:', error);
    return '1000000'; // Fallback value if calculation fails
  }
};

/**
 * Gets a quote for a fixed output amount using the REST API
 */
export const getToAmountQuote = async (
  params: ToAmountQuoteParams,
  apiKey?: string
): Promise<ToAmountQuoteResponse> => {
  return performWithRetry(
    async () => {
      const { fromChain, toChain, fromToken, toToken, fromAddress, toAmount } = params;
      const toAddress = params.toAddress || fromAddress;

      const url = `https://li.quest/v1/quote/toAmount?fromChain=${fromChain}&toChain=${toChain}&fromToken=${fromToken}&toToken=${toToken}&fromAddress=${fromAddress}&toAddress=${toAddress}&toAmount=${toAmount}`;

      const headers: HeadersInit = {
        accept: 'application/json',
      };

      if (apiKey) {
        headers['x-lifi-api-key'] = apiKey;
      }

      const options = {
        method: 'GET',
        headers,
      };

      console.log(`Fetching toAmount quote from: ${url}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP error! Status: ${response.status}, Details: ${errorText}`);
      }

      const data = await response.json();
      return data;
    },
    'getToAmountQuote',
    result => {
      // Validate that we have a proper response with the required fields
      return result && result.estimate && typeof result.estimate.fromAmount === 'string';
    },
    5, // 5 retries
    500 // 500ms delay between retries
  );
};

/**
 * Gets a quote for toAmount with contract calls as a backup method
 */
export const getToAmountContractQuote = async (params: ToAmountQuoteParams): Promise<any> => {
  return performWithRetry(
    async () => {
      const { fromChain, toChain, fromToken, toToken, fromAddress, toAmount } = params;

      // Create quote request
      const contractCallsQuoteRequest: ContractCallsQuoteRequest = {
        fromChain: fromChain.toString(),
        fromToken: fromToken,
        fromAddress: fromAddress.toString(),
        toChain: toChain.toString(),
        toToken: toToken,
        toAmount: toAmount.toString(),
        contractCalls: [],
        slippage: DEFAULT_SLIPPAGE,
      };

      console.log(`Getting contract calls quote for toAmount`);
      console.log('ContractCallsQuoteRequest:', contractCallsQuoteRequest);

      // Get quote
      const initialQuoteResponse = await getContractCallsQuote(contractCallsQuoteRequest);

      console.info('>> Initial Contract Calls Quote', initialQuoteResponse);

      return initialQuoteResponse;
    },
    'getToAmountContractQuote',
    result => {
      // Validate that we have a proper response with the required fields
      return result && result.estimate && typeof result.estimate.fromAmount === 'string';
    },
    5, // 5 retries
    500 // 500ms delay between retries
  );
};

/**
 * Gets a more accurate cross-chain quote using bidirectional approach
 * 1. Forward quote: Gnosis -> Remote chain to understand exchange rate
 * 2. Reverse calculation: Use rate to estimate required remote chain amount
 * 3. Verification quote: Remote chain -> Gnosis to verify and adjust
 */
export const getBidirectionalCrossChainQuote = async ({
  selectedChainId,
  fromToken,
  address,
  toAmount,
  gnosisDestinationToken,
  setEstimatedTime,
}: GetCrossChainQuoteParams & { setEstimatedTime: (time: number) => void }) => {
  console.log('🔄 Starting bidirectional cross-chain quote...');
  console.log('Input parameters:', {
    selectedChainId,
    fromToken,
    address,
    toAmount,
    gnosisDestinationToken,
  });

  // Validate input toAmount first
  if (!toAmount || toAmount === '0' || toAmount === '') {
    console.error('❌ Invalid toAmount input:', toAmount);
    throw new Error('Invalid toAmount provided to bidirectional quote');
  }

  // Test if toAmount is a valid number
  const toAmountBigInt = BigInt(toAmount);
  console.log('Target amount on Gnosis:', toAmount, '(', toAmountBigInt.toString(), ')');

  // Step 1: Get initial quote Remote -> Gnosis with the actual target amount
  // This tells us: "How much do we need on the remote chain to get our target amount on Gnosis?"
  console.log('🔄 Step 1: Getting initial quote (Remote -> Gnosis) for target amount...');

  const initialQuoteParams = {
    fromChain: selectedChainId.toString(),
    toChain: ChainId.DAI.toString(),
    fromToken: fromToken,
    toToken: gnosisDestinationToken,
    fromAddress: address as string,
    toAmount: toAmount, // Use the actual target amount
  };

  let initialQuote;
  try {
    // Use getToAmountQuote to get the required fromAmount for our target toAmount
    const toAmountQuoteParams = {
      fromChain: selectedChainId.toString(),
      toChain: ChainId.DAI.toString(),
      fromToken: fromToken,
      toToken: gnosisDestinationToken,
      fromAddress: address,
      toAmount: toAmount,
    };

    initialQuote = await getToAmountQuote(toAmountQuoteParams);
    console.log('✅ Initial quote successful:', {
      requiredFromAmount: initialQuote.estimate.fromAmount,
      targetToAmount: toAmount,
      ratio: `1 ${fromToken.slice(-4)} = ${Number(toAmount) / Number(initialQuote.estimate.fromAmount)} ${gnosisDestinationToken.slice(-4)}`,
    });
  } catch (error) {
    console.error('❌ Initial quote failed:', error);
    throw new Error('Failed to get initial quote for target amount');
  }

  // Step 2: Verify with reverse quote Remote -> Gnosis
  // Take the amount we calculated and see how much we actually get on Gnosis
  console.log('🔄 Step 2: Verifying with forward quote (Remote -> Gnosis)...');

  const requiredFromAmountBigInt = BigInt(initialQuote.estimate.fromAmount);
  console.log('Required amount on remote chain:', requiredFromAmountBigInt.toString());

  const verificationQuoteParams = {
    fromChain: selectedChainId.toString(),
    toChain: ChainId.DAI.toString(),
    fromToken: fromToken,
    toToken: gnosisDestinationToken,
    fromAddress: address as string,
    fromAmount: requiredFromAmountBigInt.toString(),
  };

  let verificationQuote;
  try {
    verificationQuote = await getQuote(verificationQuoteParams);
    console.log('✅ Verification quote successful:', {
      fromAmount: verificationQuote.estimate.fromAmount,
      actualToAmount: verificationQuote.estimate.toAmount,
      targetToAmount: toAmount,
    });
  } catch (error) {
    console.error('❌ Verification quote failed:', error);
    throw new Error('Failed to get verification quote');
  }

  // Step 3: Compare actual vs target and adjust if needed
  const actualToAmountBigInt = BigInt(verificationQuote.estimate.toAmount);
  const targetToAmountBigInt = BigInt(toAmount);

  console.log('🔍 Comparison analysis:', {
    targetAmount: targetToAmountBigInt.toString(),
    actualAmount: actualToAmountBigInt.toString(),
    difference: (actualToAmountBigInt - targetToAmountBigInt).toString(),
    shortfall: actualToAmountBigInt < targetToAmountBigInt,
  });

  let finalFromAmount = verificationQuote.estimate.fromAmount;
  let finalQuote = verificationQuote;

  // If we're getting less than the target, we need to increase the fromAmount
  if (actualToAmountBigInt < targetToAmountBigInt) {
    console.log('🔄 Step 3: Adjusting upward - need more input to reach target...');

    // Calculate how much more we need
    // adjustedFromAmount = (requiredFromAmount * targetAmount) / actualAmount
    const adjustedFromAmountBigInt =
      (requiredFromAmountBigInt * targetToAmountBigInt) / actualToAmountBigInt;

    // Add the configured buffer to account for slippage and fees
    const bufferAmountBigInt =
      (adjustedFromAmountBigInt * BigInt(BIDIRECTIONAL_BUFFER_PERCENT)) / 100n;
    const finalFromAmountBigInt = adjustedFromAmountBigInt + bufferAmountBigInt;

    console.log('🔍 Adjustment calculation:', {
      originalFromAmount: requiredFromAmountBigInt.toString(),
      adjustedFromAmount: adjustedFromAmountBigInt.toString(),
      bufferPercent: `${BIDIRECTIONAL_BUFFER_PERCENT}%`,
      bufferAmount: bufferAmountBigInt.toString(),
      finalFromAmount: finalFromAmountBigInt.toString(),
      calculation: `(${requiredFromAmountBigInt.toString()} * ${targetToAmountBigInt.toString()}) / ${actualToAmountBigInt.toString()} + ${BIDIRECTIONAL_BUFFER_PERCENT}% buffer`,
    });

    try {
      const adjustedQuoteParams = {
        ...verificationQuoteParams,
        fromAmount: finalFromAmountBigInt.toString(),
      };

      const adjustedQuote = await getQuote(adjustedQuoteParams);
      const adjustedToAmountBigInt = BigInt(adjustedQuote.estimate.toAmount);

      console.log('✅ Adjusted quote:', {
        adjustedFromAmount: finalFromAmountBigInt.toString(),
        adjustedToAmount: adjustedToAmountBigInt.toString(),
        targetAmount: targetToAmountBigInt.toString(),
        improvement: adjustedToAmountBigInt >= targetToAmountBigInt ? 'success' : 'still short',
      });

      // Use adjusted quote if it gets us closer to the target
      if (adjustedToAmountBigInt > actualToAmountBigInt) {
        finalFromAmount = adjustedQuote.estimate.fromAmount;
        finalQuote = adjustedQuote;
        console.log('✅ Using adjusted amount');
      }
    } catch (adjustError) {
      console.warn('⚠️ Adjustment failed, using original amount:', adjustError);
    }
  } else {
    console.log('✅ Initial quote is sufficient, applying standard buffer...');

    // Even if the initial quote is sufficient, apply the standard buffer
    const bufferAmountBigInt =
      (requiredFromAmountBigInt * BigInt(BIDIRECTIONAL_BUFFER_PERCENT)) / 100n;
    const bufferedFromAmountBigInt = requiredFromAmountBigInt + bufferAmountBigInt;

    console.log('🔍 Standard buffer application:', {
      originalFromAmount: requiredFromAmountBigInt.toString(),
      bufferPercent: `${BIDIRECTIONAL_BUFFER_PERCENT}%`,
      bufferAmount: bufferAmountBigInt.toString(),
      bufferedFromAmount: bufferedFromAmountBigInt.toString(),
    });

    try {
      const bufferedQuoteParams = {
        ...verificationQuoteParams,
        fromAmount: bufferedFromAmountBigInt.toString(),
      };

      const bufferedQuote = await getQuote(bufferedQuoteParams);
      finalFromAmount = bufferedQuote.estimate.fromAmount;
      finalQuote = bufferedQuote;
      console.log('✅ Using buffered amount for better reliability');
    } catch (bufferError) {
      console.warn('⚠️ Buffer application failed, using original amount:', bufferError);
    }
  }

  // Step 4: Add gas forwarding and minimum bridge amount logic
  console.log('🔄 Step 4: Adding gas forwarding and minimum bridge amount...');

  const gasForwarding = await checkGasForwarding(address as string, selectedChainId, fromToken);
  const minCrossChainFromAmount = calculateMinCrossChainFromAmountFromQuote(finalQuote);

  const requiredAmountBigInt = BigInt(finalFromAmount) + BigInt(gasForwarding.toString());
  const minBridgeAmountBigInt = BigInt(minCrossChainFromAmount);

  const finalBridgeAmount =
    requiredAmountBigInt > minBridgeAmountBigInt ? requiredAmountBigInt : minBridgeAmountBigInt;

  console.log('🔍 Final calculations:', {
    baseAmount: finalFromAmount,
    gasForwarding: gasForwarding.toString(),
    minBridgeAmount: minCrossChainFromAmount,
    finalBridgeAmount: finalBridgeAmount.toString(),
  });

  // Step 5: Get final quote with gas forwarding
  const finalQuoteRequest = {
    fromChain: selectedChainId.toString(),
    fromToken: fromToken,
    fromAddress: address.toString(),
    fromAmount: finalBridgeAmount.toString(),
    toChain: ChainId.DAI.toString(),
    toToken: gnosisDestinationToken,
    fromAmountForGas: gasForwarding as any, // Type assertion to work around SDK issue #239
    slippage: DEFAULT_SLIPPAGE,
    order: 'FASTEST' as const,
  };

  const finalQuoteWithGas = await getQuote(finalQuoteRequest);

  console.log('✅ Bidirectional quote complete:', {
    finalFromAmount: finalQuoteWithGas.estimate.fromAmount,
    finalToAmount: finalQuoteWithGas.estimate.toAmount,
    executionDuration: finalQuoteWithGas.estimate?.executionDuration,
  });

  logTokenRoute(finalQuoteWithGas.includedSteps, 'Bidirectional Cross Chain Quote');

  if (setEstimatedTime && finalQuoteWithGas.estimate?.executionDuration) {
    setEstimatedTime(finalQuoteWithGas.estimate.executionDuration);
  }

  return {
    crossChainContractQuoteResponse: finalQuoteWithGas,
    crossChainContractCallsRoute: convertQuoteToRoute(finalQuoteWithGas),
    bidirectionalData: {
      initialFromAmount: initialQuote.estimate.fromAmount,
      verifiedToAmount: actualToAmountBigInt.toString(),
      targetToAmount: targetToAmountBigInt.toString(),
      adjustments: actualToAmountBigInt < targetToAmountBigInt ? 'increased' : 'none',
      finalFromAmount: finalQuoteWithGas.estimate.fromAmount,
    },
  };
};

/**
 * Helper function to calculate minimum bridge amount from a quote response
 */
const calculateMinCrossChainFromAmountFromQuote = (quoteResponse: any): string => {
  if (!quoteResponse.estimate?.fromAmountUSD || !quoteResponse.estimate?.fromAmount) {
    return '1000000';
  }

  try {
    const fromAmountUsd = parseFloat(quoteResponse.estimate.fromAmountUSD);
    const fromAmount = quoteResponse.estimate.fromAmount;

    if (fromAmountUsd <= 0 || fromAmountUsd >= MIN_BRIDGE_USD_VALUE) {
      return fromAmount;
    }

    const PRECISION = 1000000;
    const scaledRatio = Math.ceil((MIN_BRIDGE_USD_VALUE / fromAmountUsd) * PRECISION);
    const fromAmountBigInt = BigInt(fromAmount);
    const minTokenAmount = (fromAmountBigInt * BigInt(scaledRatio)) / BigInt(PRECISION);

    return minTokenAmount.toString();
  } catch (error) {
    console.error('Error calculating min amount:', error);
    return '1000000';
  }
};

/**
 * Gets a quote for cross chain transactions (ORIGINAL METHOD - KEPT FOR COMPARISON)
 */
