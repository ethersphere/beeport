import { parseAbi, encodeFunctionData } from 'viem';
import { ChainId } from '@lifi/sdk';
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS, GNOSIS_BZZ_ADDRESS, DEFAULT_SLIPPAGE } from './constants';
import { performWithRetry } from './utils';

// Relay API types
export interface RelayQuoteRequest {
  user: string;
  recipient: string;
  originChainId: number;
  destinationChainId: number;
  originCurrency: string;
  destinationCurrency: string;
  amount: string;
  tradeType: 'EXACT_INPUT' | 'EXACT_OUTPUT';
  txs?: Array<{
    to: string;
    value: string;
    data: string;
  }>;
  slippageTolerance?: string;
  refundOnOrigin?: boolean;
  topupGas?: boolean;
}

export interface RelayQuoteResponse {
  steps: Array<{
    id: string;
    action: string;
    description: string;
    kind: string;
    requestId?: string;
    items: Array<{
      status: string;
      data: {
        from: string;
        to: string;
        data: string;
        value: string;
        maxFeePerGas?: string;
        maxPriorityFeePerGas?: string;
        chainId: number;
      };
      check?: {
        endpoint: string;
        method: string;
      };
    }>;
  }>;
  fees: {
    gas: {
      currency: any;
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    relayer: {
      currency: any;
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    // ... other fee types
  };
  details: {
    currencyIn: {
      currency: any;
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    currencyOut: {
      currency: any;
      amount: string;
      amountFormatted: string;
      amountUsd: string;
    };
    timeEstimate: number;
    // ... other details
  };
}

export interface RelayQuoteParams {
  selectedChainId: number;
  fromToken: string;
  address: string;
  bzzAmount: string;
  nodeAddress: string;
  swarmConfig: any;
  topUpBatchId?: string;
  setEstimatedTime?: (time: number) => void;
  isForEstimation?: boolean;
}

/**
 * Gets a quote using Relay API for cross-chain swaps to BZZ with contract calls
 */
export const getRelayQuote = async ({
  selectedChainId,
  fromToken,
  address,
  bzzAmount,
  nodeAddress,
  swarmConfig,
  topUpBatchId,
  setEstimatedTime,
  isForEstimation = false,
}: RelayQuoteParams): Promise<{
  relayQuoteResponse: RelayQuoteResponse;
  totalAmountUSD: number;
  contractCallData: string;
}> => {
  console.log(
    `🔄 Getting Relay quote for ${isForEstimation ? 'price estimation' : 'swap execution'}...`
  );

  // Step 1: Prepare contract call data for Swarm
  let contractCallData: string;

  if (topUpBatchId) {
    // Top up existing batch
    console.log(`Creating top-up transaction for batch: ${topUpBatchId}`);
    contractCallData = encodeFunctionData({
      abi: parseAbi(swarmConfig.swarmContractAbi),
      functionName: 'topUpBatch',
      args: [topUpBatchId as `0x${string}`, swarmConfig.swarmBatchInitialBalance],
    });
  } else {
    // Create new batch
    contractCallData = encodeFunctionData({
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

  // Step 2: Determine if this is same-chain or cross-chain
  const isSameChain = selectedChainId === ChainId.DAI;
  const originCurrency = fromToken;
  const destinationCurrency = GNOSIS_BZZ_ADDRESS;

  console.log('Relay quote parameters:', {
    originChainId: selectedChainId,
    destinationChainId: ChainId.DAI,
    originCurrency,
    destinationCurrency,
    bzzAmount,
    isSameChain,
    isForEstimation,
  });

  // Step 3: Create Relay quote request
  const relayQuoteRequest: RelayQuoteRequest = {
    user: address,
    recipient: address,
    originChainId: selectedChainId,
    destinationChainId: ChainId.DAI, // Always Gnosis
    originCurrency,
    destinationCurrency,
    amount: bzzAmount,
    tradeType: 'EXACT_OUTPUT', // We need exact BZZ amount
    txs: [
      {
        to: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
        value: '0',
        data: contractCallData,
      },
    ],
    slippageTolerance: (DEFAULT_SLIPPAGE * 100).toString(), // Convert to integer percentage (5 for 5%)
    refundOnOrigin: true,
    topupGas: true, // Enable gas forwarding for cross-chain
  };

  // Step 4: Make API request to Relay
  const relayQuoteResponse = await performWithRetry(
    async () => {
      console.log('🌐 Calling Relay API with request:', relayQuoteRequest);

      const response = await fetch('https://api.relay.link/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(relayQuoteRequest),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Relay API error! Status: ${response.status}, Details: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ Relay API response:', data);
      return data;
    },
    `getRelayQuote-${isForEstimation ? 'estimation' : 'execution'}`,
    undefined,
    isForEstimation ? 3 : 5, // Fewer retries for estimation
    500
  );

  // Step 5: Extract pricing information
  const totalAmountUSD = Number(relayQuoteResponse.details.currencyIn.amountUsd || 0);

  // Step 6: Set estimated time if provided
  if (setEstimatedTime && relayQuoteResponse.details.timeEstimate) {
    setEstimatedTime(relayQuoteResponse.details.timeEstimate);
  }

  console.log(
    `✅ Relay quote complete. Total: $${totalAmountUSD.toFixed(2)}, Steps: ${relayQuoteResponse.steps.length}`
  );

  // Log fee breakdown
  console.log('💰 Fee breakdown:', {
    gas: relayQuoteResponse.fees.gas.amountUsd,
    relayer: relayQuoteResponse.fees.relayer.amountUsd,
    total: totalAmountUSD,
  });

  return {
    relayQuoteResponse,
    totalAmountUSD,
    contractCallData,
  };
};

/**
 * Executes a Relay quote by processing each step sequentially
 */
export const executeRelaySteps = async (
  relayQuoteResponse: RelayQuoteResponse,
  walletClient: any,
  setStatusMessage: (status: any) => void
): Promise<void> => {
  console.log('🚀 Starting Relay step execution...');

  for (let i = 0; i < relayQuoteResponse.steps.length; i++) {
    const step = relayQuoteResponse.steps[i];
    console.log(`📋 Executing step ${i + 1}/${relayQuoteResponse.steps.length}: ${step.id}`);

    setStatusMessage({
      step: step.id,
      message: step.description,
    });

    // Process each item in the step
    for (const item of step.items) {
      if (item.status === 'incomplete' && item.data) {
        console.log('💫 Executing transaction:', item.data);

        try {
          // Execute the transaction
          const txHash = await walletClient.sendTransaction({
            to: item.data.to as `0x${string}`,
            data: item.data.data as `0x${string}`,
            value: BigInt(item.data.value || '0'),
            maxFeePerGas: item.data.maxFeePerGas ? BigInt(item.data.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: item.data.maxPriorityFeePerGas
              ? BigInt(item.data.maxPriorityFeePerGas)
              : undefined,
          });

          console.log(`✅ Transaction sent: ${txHash}`);

          // If there's a check endpoint, monitor the status
          if (item.check) {
            await monitorRelayStatus(item.check.endpoint, setStatusMessage);
          }
        } catch (error) {
          console.error(`❌ Failed to execute step ${step.id}:`, error);
          throw error;
        }
      }
    }
  }

  console.log('🎉 All Relay steps completed successfully!');
};

/**
 * Monitors the status of a Relay operation
 */
const monitorRelayStatus = async (
  statusEndpoint: string,
  setStatusMessage: (status: any) => void
): Promise<void> => {
  const maxAttempts = 60; // 5 minutes with 5-second intervals
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`https://api.relay.link${statusEndpoint}`);
      const statusData = await response.json();

      console.log('📊 Relay status:', statusData);

      if (statusData.status === 'complete') {
        console.log('✅ Relay operation completed');
        return;
      } else if (statusData.status === 'failed') {
        throw new Error('Relay operation failed');
      }

      // Update status message with progress
      setStatusMessage({
        step: 'Processing',
        message: `Transaction in progress... (${attempts + 1}/${maxAttempts})`,
      });

      // Wait 5 seconds before next check
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    } catch (error) {
      console.error('Error checking Relay status:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  throw new Error('Relay operation timed out');
};

/**
 * Unified function that replaces the old modular quote system
 * Uses Relay API for both price estimation and execution
 */
export const getRelaySwapQuotes = async (params: RelayQuoteParams) => {
  const { relayQuoteResponse, totalAmountUSD, contractCallData } = await getRelayQuote(params);

  return {
    // For price estimation
    totalAmountUSD,

    // For swap execution
    relayQuoteResponse,
    contractCallData,

    // Metadata
    isGnosisOnly: params.selectedChainId === ChainId.DAI,
    selectedChainId: params.selectedChainId,
    steps: relayQuoteResponse.steps,
    estimatedTime: relayQuoteResponse.details.timeEstimate,
  };
};
