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
  console.log('Target toAmount:', toAmount);
  console.log('From chain:', selectedChainId, 'to chain: Gnosis');

  // Step 1: Get forward quote (Gnosis -> Remote chain) to understand exchange rate
  // Use a standard amount (equivalent to ~$100) to get the rate
  const forwardTestAmount = '100000000000000000000'; // 100 tokens (18 decimals)

  console.log('🔄 Step 1: Getting forward quote (Gnosis -> Remote) for rate calculation...');
  const forwardQuoteParams = {
    fromChain: ChainId.DAI.toString(),
    toChain: selectedChainId.toString(),
    fromToken: gnosisDestinationToken,
    toToken: fromToken,
    fromAddress: address as string,
    fromAmount: forwardTestAmount,
  };

  let forwardQuote;
  try {
    forwardQuote = await getQuote(forwardQuoteParams);
    console.log('✅ Forward quote successful:', {
      fromAmount: forwardQuote.estimate.fromAmount,
      toAmount: forwardQuote.estimate.toAmount,
      rate: `1 Gnosis token = ${Number(forwardQuote.estimate.toAmount) / Number(forwardQuote.estimate.fromAmount)} remote tokens`,
    });
  } catch (error) {
    console.error('❌ Forward quote failed:', error);
    throw new Error('Failed to get forward quote for rate calculation');
  }

  // Step 2: Calculate estimated required amount using the forward rate
  const forwardRate =
    Number(forwardQuote.estimate.toAmount) / Number(forwardQuote.estimate.fromAmount);

  // Validate the forward rate to prevent invalid calculations
  if (!forwardRate || forwardRate <= 0 || !isFinite(forwardRate)) {
    console.error('❌ Invalid forward rate calculated:', forwardRate);
    throw new Error('Failed to calculate valid exchange rate from forward quote');
  }

  const estimatedRequiredAmount = Math.ceil(Number(toAmount) / forwardRate);

  // Validate the estimated amount
  if (
    !estimatedRequiredAmount ||
    estimatedRequiredAmount <= 0 ||
    !isFinite(estimatedRequiredAmount)
  ) {
    console.error('❌ Invalid estimated amount calculated:', estimatedRequiredAmount);
    throw new Error('Failed to calculate valid estimated amount');
  }

  console.log('🔄 Step 2: Calculated estimated required amount:', estimatedRequiredAmount);

  // Step 3: Get reverse quote (Remote -> Gnosis) with estimated amount
  console.log('🔄 Step 3: Getting reverse quote (Remote -> Gnosis) for verification...');

  // Add some buffer to account for slippage and fees (10% buffer)
  const bufferedAmount = Math.ceil(estimatedRequiredAmount * 1.1);

  // Validate buffered amount and ensure it's a valid integer
  if (!bufferedAmount || bufferedAmount <= 0 || !isFinite(bufferedAmount)) {
    console.error('❌ Invalid buffered amount calculated:', bufferedAmount);
    throw new Error('Failed to calculate valid buffered amount');
  }

  const reverseQuoteParams = {
    fromChain: selectedChainId.toString(),
    toChain: ChainId.DAI.toString(),
    fromToken: fromToken,
    toToken: gnosisDestinationToken,
    fromAddress: address as string,
    fromAmount: bufferedAmount.toString(),
  };

  let reverseQuote;
  try {
    reverseQuote = await getQuote(reverseQuoteParams);
    console.log('✅ Reverse quote successful:', {
      fromAmount: reverseQuote.estimate.fromAmount,
      toAmount: reverseQuote.estimate.toAmount,
      targetAmount: toAmount,
    });
  } catch (error) {
    console.error('❌ Reverse quote failed:', error);
    throw new Error('Failed to get reverse quote for verification');
  }

  // Step 4: Compare and adjust if needed
  const actualToAmount = Number(reverseQuote.estimate.toAmount);
  const targetAmount = Number(toAmount);
  const discrepancy = ((actualToAmount - targetAmount) / targetAmount) * 100;

  console.log('🔄 Step 4: Analyzing results:', {
    targetAmount,
    actualToAmount,
    discrepancy: `${discrepancy.toFixed(2)}%`,
  });

  let finalFromAmount = reverseQuote.estimate.fromAmount;

  // If we're getting significantly more than needed, try to adjust downward
  if (discrepancy > 5) {
    console.log('🔄 Adjusting downward - got too much output');
    const adjustmentRatio = targetAmount / actualToAmount;
    const adjustedFromAmount = Math.ceil(
      Number(reverseQuote.estimate.fromAmount) * adjustmentRatio
    );

    // Validate the adjusted amount
    if (!adjustedFromAmount || adjustedFromAmount <= 0 || !isFinite(adjustedFromAmount)) {
      console.warn('⚠️ Invalid adjusted amount calculated, using original amount');
    } else {
      try {
        const adjustedQuoteParams = {
          ...reverseQuoteParams,
          fromAmount: adjustedFromAmount.toString(),
        };

        const adjustedQuote = await getQuote(adjustedQuoteParams);
        const adjustedToAmount = Number(adjustedQuote.estimate.toAmount);

        console.log('✅ Adjusted quote:', {
          adjustedFromAmount,
          adjustedToAmount,
          newDiscrepancy: `${(((adjustedToAmount - targetAmount) / targetAmount) * 100).toFixed(2)}%`,
        });

        // Use adjusted amount if it's closer to target
        if (Math.abs(adjustedToAmount - targetAmount) < Math.abs(actualToAmount - targetAmount)) {
          finalFromAmount = adjustedQuote.estimate.fromAmount;
          reverseQuote = adjustedQuote;
          console.log('✅ Using adjusted amount');
        }
      } catch (adjustError) {
        console.warn('⚠️ Adjustment failed, using original amount:', adjustError);
      }
    }
  }

  // Step 5: Add gas forwarding and minimum bridge amount logic
  console.log('🔄 Step 5: Adding gas forwarding and minimum bridge amount...');

  const gasForwarding = await checkGasForwarding(address as string, selectedChainId, fromToken);
  const minCrossChainFromAmount = calculateMinCrossChainFromAmountFromQuote(reverseQuote);

  const requiredAmountBigInt = BigInt(finalFromAmount) + BigInt(gasForwarding.toString());
  const minBridgeAmountBigInt = BigInt(minCrossChainFromAmount);

  const finalBridgeAmount =
    requiredAmountBigInt > minBridgeAmountBigInt ? requiredAmountBigInt : minBridgeAmountBigInt;

  console.log(' Final calculations:', {
    baseAmount: finalFromAmount,
    gasForwarding: gasForwarding.toString(),
    minBridgeAmount: minCrossChainFromAmount,
    finalBridgeAmount: finalBridgeAmount.toString(),
  });

  // Step 6: Get final quote with gas forwarding
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

  const finalQuote = await getQuote(finalQuoteRequest);

  console.log('✅ Bidirectional quote complete:', {
    finalFromAmount: finalQuote.estimate.fromAmount,
    finalToAmount: finalQuote.estimate.toAmount,
    executionDuration: finalQuote.estimate?.executionDuration,
  });

  logTokenRoute(finalQuote.includedSteps, 'Bidirectional Cross Chain Quote');

  if (setEstimatedTime && finalQuote.estimate?.executionDuration) {
    setEstimatedTime(finalQuote.estimate.executionDuration);
  }

  return {
    crossChainContractQuoteResponse: finalQuote,
    crossChainContractCallsRoute: convertQuoteToRoute(finalQuote),
    bidirectionalData: {
      forwardRate,
      estimatedRequiredAmount,
      discrepancy,
      adjustments: discrepancy > 5 ? 'adjusted' : 'none',
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
