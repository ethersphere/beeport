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
  CROSS_CHAIN_SAFETY_BUFFER_PERCENT,
  SWARM_BATCH_SWAPPER_ADDRESS,
  SWARM_BATCH_SWAPPER_ABI,
  SUSHISWAP_ROUTER_ADDRESS,
  GNOSIS_USDC_ADDRESS,
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
 * Gets a reliable cross-chain quote using single direction with safety buffer
 * 1. Get quote for required amount (Remote -> Gnosis)
 * 2. Add safety buffer to account for slippage and price movements
 * 3. Get final quote with buffered amount
 */
export const getSafeCrossChainQuote = async ({
  selectedChainId,
  fromToken,
  address,
  toAmount,
  gnosisDestinationToken,
  setEstimatedTime,
}: GetCrossChainQuoteParams & { setEstimatedTime: (time: number) => void }) => {
  console.log('🔄 Starting safe cross-chain quote with safety buffer...');
  console.log('Input parameters:', {
    selectedChainId,
    fromToken,
    address,
    toAmount,
    gnosisDestinationToken,
    safetyBuffer: `${CROSS_CHAIN_SAFETY_BUFFER_PERCENT}%`,
  });

  // Validate input toAmount first
  if (!toAmount || toAmount === '0' || toAmount === '') {
    console.error('❌ Invalid toAmount input:', toAmount);
    throw new Error('Invalid toAmount provided to cross-chain quote');
  }

  const toAmountBigInt = BigInt(toAmount);
  console.log('Target amount on Gnosis:', toAmount, '(', toAmountBigInt.toString(), ')');

  // Step 1: Get initial quote to determine required amount
  console.log('🔄 Step 1: Getting base quote (Remote -> Gnosis) for target amount...');

  const toAmountQuoteParams = {
    fromChain: selectedChainId.toString(),
    toChain: ChainId.DAI.toString(),
    fromToken: fromToken,
    toToken: gnosisDestinationToken,
    fromAddress: address,
    toAmount: toAmount,
  };

  let baseQuote;
  try {
    baseQuote = await getToAmountQuote(toAmountQuoteParams);
    console.log('✅ Base quote successful:', {
      requiredFromAmount: baseQuote.estimate.fromAmount,
      targetToAmount: toAmount,
    });
  } catch (error) {
    console.error('❌ Base quote failed:', error);
    throw new Error('Failed to get base quote for target amount');
  }

  // Step 2: Apply safety buffer to the required amount
  console.log('🔄 Step 2: Applying safety buffer...');

  const baseFromAmountBigInt = BigInt(baseQuote.estimate.fromAmount);
  const bufferAmountBigInt =
    (baseFromAmountBigInt * BigInt(CROSS_CHAIN_SAFETY_BUFFER_PERCENT)) / 100n;
  const bufferedFromAmountBigInt = baseFromAmountBigInt + bufferAmountBigInt;

  console.log('🔍 Buffer calculation:', {
    baseFromAmount: baseFromAmountBigInt.toString(),
    bufferPercent: `${CROSS_CHAIN_SAFETY_BUFFER_PERCENT}%`,
    bufferAmount: bufferAmountBigInt.toString(),
    bufferedFromAmount: bufferedFromAmountBigInt.toString(),
  });

  // Step 3: Add gas forwarding
  console.log('🔄 Step 3: Adding gas forwarding...');

  const gasForwarding = await checkGasForwarding(address as string, selectedChainId, fromToken);
  const totalRequiredAmountBigInt = bufferedFromAmountBigInt + BigInt(gasForwarding.toString());

  console.log('🔍 Gas forwarding calculation:', {
    bufferedAmount: bufferedFromAmountBigInt.toString(),
    gasForwarding: gasForwarding.toString(),
    totalWithGas: totalRequiredAmountBigInt.toString(),
  });

  // Step 4: Apply minimum bridge amount check (only if our amount is smaller)
  console.log('🔄 Step 4: Checking minimum bridge amount...');

  // For storage stamp purchases, we need a specific amount, not a minimum bridge amount
  // Skip minimum bridge logic and use our calculated amount
  let finalFromAmountBigInt = totalRequiredAmountBigInt;

  console.log('🔍 Using calculated amount for storage stamps (bypassing minimum bridge logic):', {
    calculatedAmount: totalRequiredAmountBigInt.toString(),
    finalAmount: finalFromAmountBigInt.toString(),
  });

  // Step 5: Get final quote with calculated amount + gas forwarding
  console.log('🔄 Step 5: Getting final quote with safety buffer...');

  const finalQuoteRequest = {
    fromChain: selectedChainId.toString(),
    fromToken: fromToken,
    fromAddress: address.toString(),
    fromAmount: finalFromAmountBigInt.toString(),
    toChain: ChainId.DAI.toString(),
    toToken: gnosisDestinationToken,
    fromAmountForGas: gasForwarding as any, // Type assertion to work around SDK issue #239
    slippage: DEFAULT_SLIPPAGE,
    order: 'FASTEST' as const,
  };

  const finalQuote = await getQuote(finalQuoteRequest);

  console.log('✅ Safe cross-chain quote complete:', {
    finalFromAmount: finalQuote.estimate.fromAmount,
    finalToAmount: finalQuote.estimate.toAmount,
    executionDuration: finalQuote.estimate?.executionDuration,
    safetyBuffer: `${CROSS_CHAIN_SAFETY_BUFFER_PERCENT}%`,
  });

  logTokenRoute(finalQuote.includedSteps, 'Safe Cross Chain Quote');

  if (setEstimatedTime && finalQuote.estimate?.executionDuration) {
    setEstimatedTime(finalQuote.estimate.executionDuration);
  }

  return {
    crossChainContractQuoteResponse: finalQuote,
    crossChainContractCallsRoute: convertQuoteToRoute(finalQuote),
    safeQuoteData: {
      baseFromAmount: baseQuote.estimate.fromAmount,
      bufferedFromAmount: bufferedFromAmountBigInt.toString(),
      safetyBufferPercent: CROSS_CHAIN_SAFETY_BUFFER_PERCENT,
      gasForwarding: gasForwarding.toString(),
      finalFromAmount: finalQuote.estimate.fromAmount,
      targetToAmount: toAmount,
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

/**
 * Modular function to get quotes for both price estimation and swap execution
 * Returns both USD amounts (for display) and route objects (for execution)
 */
export const getSwapQuotes = async ({
  selectedChainId,
  fromToken,
  address,
  bzzAmount,
  nodeAddress,
  swarmConfig,
  gnosisDestinationToken,
  topUpBatchId,
  setEstimatedTime,
  isForEstimation = false,
}: {
  selectedChainId: number;
  fromToken: string;
  address: string;
  bzzAmount: string;
  nodeAddress: string;
  swarmConfig: any;
  gnosisDestinationToken: string;
  topUpBatchId?: string;
  setEstimatedTime?: (time: number) => void;
  isForEstimation?: boolean;
}) => {
  console.log(
    `🔄 Getting quotes for ${isForEstimation ? 'price estimation' : 'swap execution'}...`
  );

  const gnosisSourceToken = selectedChainId === ChainId.DAI ? fromToken : gnosisDestinationToken;

  // Step 1: Get Gnosis quote
  const { gnosisContactCallsQuoteResponse, gnosisContractCallsRoute } = await performWithRetry(
    () =>
      getGnosisQuote({
        gnosisSourceToken,
        address,
        bzzAmount,
        nodeAddress,
        swarmConfig,
        setEstimatedTime: setEstimatedTime || (() => {}),
        topUpBatchId,
      }),
    `getGnosisQuote-${isForEstimation ? 'estimation' : 'execution'}`,
    undefined,
    5,
    500
  );

  let totalAmountUSD = Number(gnosisContactCallsQuoteResponse.estimate.fromAmountUSD || 0);
  let crossChainContractQuoteResponse = null;
  let crossChainContractCallsRoute = null;
  let safeQuoteData = null;

  // Step 2: Get cross-chain quote if needed
  if (selectedChainId !== ChainId.DAI) {
    console.log(
      `🔄 ${isForEstimation ? 'Price estimation' : 'Execution'}: Getting safe cross-chain quote...`
    );

    const safeQuoteResult = await performWithRetry(
      () =>
        getSafeCrossChainQuote({
          selectedChainId,
          fromToken,
          address: address as string,
          toAmount: gnosisContactCallsQuoteResponse.estimate.fromAmount,
          gnosisDestinationToken,
          setEstimatedTime: isForEstimation ? () => {} : setEstimatedTime || (() => {}),
        }),
      `getSafeCrossChainQuote-${isForEstimation ? 'estimation' : 'execution'}`,
      undefined,
      isForEstimation ? 3 : 5, // Fewer retries for estimation
      500
    );

    crossChainContractQuoteResponse = safeQuoteResult.crossChainContractQuoteResponse;
    crossChainContractCallsRoute = safeQuoteResult.crossChainContractCallsRoute;
    safeQuoteData = safeQuoteResult.safeQuoteData;

    console.log(`✅ ${isForEstimation ? 'Price estimation' : 'Execution'}: Safe quote successful`);
    if (!isForEstimation) {
      console.log('📊 Safe quote data:', safeQuoteData);
    }

    // Calculate total USD amount for cross-chain
    totalAmountUSD = Number(crossChainContractQuoteResponse.estimate.fromAmountUSD || 0);

    // Log bridge fees and gas fees
    const bridgeFees = crossChainContractQuoteResponse.estimate.feeCosts
      ? crossChainContractQuoteResponse.estimate.feeCosts.reduce(
          (total, fee) => total + Number(fee.amountUSD || 0),
          0
        )
      : 0;

    console.log('Bridge fees:', bridgeFees);
    console.log(
      'Gas fees:',
      crossChainContractQuoteResponse.estimate.gasCosts?.[0]?.amountUSD || '0'
    );
    console.log('Cross chain amount:', crossChainContractQuoteResponse.estimate.fromAmountUSD);
  }

  console.log(
    `✅ ${isForEstimation ? 'Price estimation' : 'Swap quotes'} complete. Total: $${totalAmountUSD.toFixed(2)}`
  );

  return {
    // For price estimation
    totalAmountUSD,

    // For swap execution
    gnosisContactCallsQuoteResponse,
    gnosisContractCallsRoute,
    crossChainContractQuoteResponse,
    crossChainContractCallsRoute,
    safeQuoteData,

    // Metadata
    isGnosisOnly: selectedChainId === ChainId.DAI,
    selectedChainId,
  };
};

/**
 * Gets a quote using the SwarmBatchSwapper smart contract approach
 * This eliminates the need for separate swap and batch creation transactions
 */
export const getSmartContractQuote = async ({
  inputToken,
  address,
  bzzAmount,
  nodeAddress,
  swarmConfig,
  topUpBatchId,
  setEstimatedTime,
}: {
  inputToken: string;
  address: string;
  bzzAmount: string;
  nodeAddress: string;
  swarmConfig: any;
  topUpBatchId?: string;
  setEstimatedTime: (time: number) => void;
}) => {
  console.log('🔄 Getting smart contract quote...');

  // Get Gnosis public client to read from SushiSwap router
  const gnosisProvider = getGnosisPublicClient();

  // If input token is BZZ, no swap needed
  if (inputToken.toLowerCase() === swarmConfig.swarmToken.toLowerCase()) {
    console.log('Input token is BZZ, no swap needed');

    // Prepare contract call data for direct BZZ usage
    let contractCallData;
    let functionName;
    let args;

    if (topUpBatchId) {
      functionName = 'swapAndTopUpBatch';
      args = [
        inputToken, // inputToken (BZZ)
        bzzAmount, // inputAmount (exact BZZ needed)
        bzzAmount, // exactBzzNeeded (same as input)
        bzzAmount, // minBzzReceived (same as input, no slippage)
        topUpBatchId, // batchId
        swarmConfig.swarmBatchInitialBalance, // topupAmountPerChunk
      ];
    } else {
      functionName = 'swapAndCreateBatch';
      args = [
        inputToken, // inputToken (BZZ)
        bzzAmount, // inputAmount (exact BZZ needed)
        bzzAmount, // exactBzzNeeded (same as input)
        bzzAmount, // minBzzReceived (same as input, no slippage)
        address, // owner
        nodeAddress, // nodeAddress
        swarmConfig.swarmBatchInitialBalance, // initialPaymentPerChunk
        parseInt(swarmConfig.swarmBatchDepth), // depth
        parseInt(swarmConfig.swarmBatchBucketDepth), // bucketDepth
        swarmConfig.swarmBatchNonce, // nonce
        swarmConfig.swarmBatchImmutable, // immutableFlag
      ];
    }

    contractCallData = encodeFunctionData({
      abi: SWARM_BATCH_SWAPPER_ABI,
      functionName,
      args,
    });

    // Create a simple quote response
    return {
      estimate: {
        fromAmount: bzzAmount,
        fromAmountUSD: '0', // Will be calculated by caller
        toAmount: bzzAmount,
        executionDuration: 30, // Estimate for smart contract call
      },
      contractCallData,
      contractAddress: SWARM_BATCH_SWAPPER_ADDRESS,
      isSmartContract: true,
      functionName,
      args,
    };
  }

  // For other tokens, we need to calculate required input amount via SushiSwap
  try {
    console.log('Calculating required input amount via SushiSwap...');

    // Read from SushiSwap router to get required input amount
    const path = [inputToken, swarmConfig.swarmToken]; // e.g., [USDC, BZZ]

    // First, let's estimate how much input token we need for the required BZZ
    // We'll use a rough estimation and then add buffer for slippage
    const estimatedInputAmount = await gnosisProvider.readContract({
      address: SUSHISWAP_ROUTER_ADDRESS as `0x${string}`,
      abi: [
        {
          inputs: [
            { internalType: 'uint', name: 'amountOut', type: 'uint256' },
            { internalType: 'address[]', name: 'path', type: 'address[]' },
          ],
          name: 'getAmountsIn',
          outputs: [{ internalType: 'uint[]', name: 'amounts', type: 'uint256[]' }],
          stateMutability: 'view',
          type: 'function',
        },
      ],
      functionName: 'getAmountsIn',
      args: [BigInt(bzzAmount), path],
    });

    const requiredInputAmount = (estimatedInputAmount as bigint[])[0];

    // Add safety buffer for slippage (5%)
    const bufferedInputAmount = (requiredInputAmount * 105n) / 100n;

    // Calculate minimum BZZ we should receive (allow for 2% slippage)
    const minBzzReceived = (BigInt(bzzAmount) * 98n) / 100n;

    console.log('Smart contract quote calculation:', {
      requiredInputAmount: requiredInputAmount.toString(),
      bufferedInputAmount: bufferedInputAmount.toString(),
      exactBzzNeeded: bzzAmount,
      minBzzReceived: minBzzReceived.toString(),
    });

    // Prepare contract call data
    let contractCallData;
    let functionName;
    let args;

    if (topUpBatchId) {
      functionName = 'swapAndTopUpBatch';
      args = [
        inputToken, // inputToken
        bufferedInputAmount.toString(), // inputAmount (with buffer)
        bzzAmount, // exactBzzNeeded
        minBzzReceived.toString(), // minBzzReceived (with slippage protection)
        topUpBatchId, // batchId
        swarmConfig.swarmBatchInitialBalance, // topupAmountPerChunk
      ];
    } else {
      functionName = 'swapAndCreateBatch';
      args = [
        inputToken, // inputToken
        bufferedInputAmount.toString(), // inputAmount (with buffer)
        bzzAmount, // exactBzzNeeded
        minBzzReceived.toString(), // minBzzReceived (with slippage protection)
        address, // owner
        nodeAddress, // nodeAddress
        swarmConfig.swarmBatchInitialBalance, // initialPaymentPerChunk
        parseInt(swarmConfig.swarmBatchDepth), // depth
        parseInt(swarmConfig.swarmBatchBucketDepth), // bucketDepth
        swarmConfig.swarmBatchNonce, // nonce
        swarmConfig.swarmBatchImmutable, // immutableFlag
      ];
    }

    contractCallData = encodeFunctionData({
      abi: SWARM_BATCH_SWAPPER_ABI,
      functionName,
      args,
    });

    console.log('✅ Smart contract quote prepared:', {
      requiredInput: bufferedInputAmount.toString(),
      functionName,
      contractAddress: SWARM_BATCH_SWAPPER_ADDRESS,
    });

    // Set estimated time for smart contract execution
    setEstimatedTime(60); // Single transaction should be faster

    return {
      estimate: {
        fromAmount: bufferedInputAmount.toString(),
        fromAmountUSD: '0', // Will be calculated by caller using token price
        toAmount: bzzAmount,
        executionDuration: 60,
      },
      contractCallData,
      contractAddress: SWARM_BATCH_SWAPPER_ADDRESS,
      isSmartContract: true,
      functionName,
      args,
      smartContractData: {
        requiredInputAmount: requiredInputAmount.toString(),
        bufferedInputAmount: bufferedInputAmount.toString(),
        exactBzzNeeded: bzzAmount,
        minBzzReceived: minBzzReceived.toString(),
      },
    };
  } catch (error) {
    console.error('Error calculating smart contract quote:', error);
    throw new Error('Failed to calculate required input amount for smart contract');
  }
};
