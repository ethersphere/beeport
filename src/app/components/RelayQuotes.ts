import { parseAbi, encodeFunctionData, formatEther } from 'viem';
import { ChainId } from '@lifi/sdk';
import {
  GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  GNOSIS_BZZ_ADDRESS,
  DEFAULT_SLIPPAGE,
  GAS_TOPUP_THRESHOLD_XDAI,
  GAS_TOPUP_AMOUNT_USD,
  RELAY_STATUS_CHECK_INTERVAL_MS,
  RELAY_STATUS_MAX_ATTEMPTS,
  TRANSACTION_TIMEOUT_MS,
} from './constants';
import { performWithRetry, getGnosisPublicClient } from './utils';

// Relay API Error Codes and Messages
// Based on: https://docs.relay.link/references/api/handling-errors
export interface RelayError {
  message: string;
  errorCode: string;
  errorData?: string;
}

export const RELAY_ERROR_MESSAGES: Record<string, string> = {
  // Expected Errors - User/Request Issues
  AMOUNT_TOO_LOW: 'The swap amount is too small. Please increase the amount and try again.',
  CHAIN_DISABLED: 'This blockchain is currently unavailable. Please try a different chain.',
  EXTRA_TXS_NOT_SUPPORTED: 'Additional transactions are not supported for this swap type.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  INSUFFICIENT_FUNDS: 'Insufficient balance in your wallet. Please add funds and try again.',
  INSUFFICIENT_LIQUIDITY:
    'Not enough liquidity available for this swap. Try a smaller amount or different tokens.',
  INVALID_ADDRESS: 'Invalid wallet address. Please check your wallet connection.',
  INVALID_EXTRA_TXS: 'Transaction configuration error. Please try again.',
  INVALID_GAS_LIMIT_FOR_DEPOSIT_SPECIFIED_TXS:
    'Gas limit configuration error for this transaction type.',
  INVALID_INPUT_CURRENCY:
    'The selected input token is not supported. Please choose a different token.',
  INVALID_OUTPUT_CURRENCY:
    'The selected output token is not supported. Please choose a different token.',
  INVALID_SLIPPAGE_TOLERANCE: 'Invalid slippage tolerance setting. Please try again.',
  NO_INTERNAL_SWAP_ROUTES_FOUND:
    'No swap route available for these tokens. Try different tokens or amounts.',
  NO_QUOTES: 'No quotes available for this swap. Please try different parameters.',
  NO_SWAP_ROUTES_FOUND: 'No route found for this swap. Try different tokens, amounts, or chains.',
  ROUTE_TEMPORARILY_RESTRICTED:
    'This route is temporarily unavailable due to high traffic. Please try again later.',
  SANCTIONED_CURRENCY: 'This token is restricted and cannot be traded.',
  SANCTIONED_WALLET_ADDRESS: 'This wallet address is restricted from trading.',
  SWAP_IMPACT_TOO_HIGH: 'Price impact is too high for this swap. Try a smaller amount.',
  UNAUTHORIZED: 'Authentication required. Please connect your wallet.',
  UNSUPPORTED_CHAIN: 'This blockchain is not supported. Please select a different chain.',
  UNSUPPORTED_CURRENCY: 'This token is not supported. Please select a different token.',
  UNSUPPORTED_EXECUTION_TYPE: 'This transaction type is not supported.',
  UNSUPPORTED_ROUTE: 'This swap combination is not supported.',
  USER_RECIPIENT_MISMATCH: 'Sender and recipient addresses must match for this swap type.',

  // Unexpected Errors - Infrastructure Issues
  DESTINATION_TX_FAILED: 'Transaction failed on the destination chain. Please try again.',
  ERC20_ROUTER_ADDRESS_NOT_FOUND: 'Token router not found. Please try again or contact support.',
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again.',
  SWAP_QUOTE_FAILED: 'Failed to calculate swap price. Please try again.',
  PERMIT_FAILED: 'Token approval failed. Please try the transaction again.',

  // User Action Errors
  USER_REJECTED: 'Transaction was cancelled by user.',
};

/**
 * Parses Relay API error response and returns user-friendly message
 */
export const parseRelayError = (error: any): { userMessage: string; errorCode?: string } => {
  try {
    // Check for user rejection errors first (most common case)
    const errorMessage = error?.message || error?.toString() || '';

    // Handle user rejection cases
    if (
      errorMessage.includes('User rejected') ||
      errorMessage.includes('User denied') ||
      errorMessage.includes('user rejected') ||
      errorMessage.includes('rejected the request') ||
      errorMessage.includes('User cancelled') ||
      errorMessage.includes('Transaction was rejected')
    ) {
      return {
        userMessage: 'Transaction was cancelled by user.',
        errorCode: 'USER_REJECTED',
      };
    }

    // Handle insufficient funds errors
    if (
      errorMessage.includes('insufficient funds') ||
      errorMessage.includes('Insufficient funds') ||
      errorMessage.includes('insufficient balance')
    ) {
      return {
        userMessage: 'Insufficient balance in your wallet. Please add funds and try again.',
        errorCode: 'INSUFFICIENT_FUNDS',
      };
    }

    // Try to parse JSON error response for Relay API errors
    let errorData: RelayError;

    if (typeof error === 'string') {
      try {
        errorData = JSON.parse(error);
      } catch {
        // If it's a string but not JSON, check for common error patterns
        if (errorMessage.includes('Network Error') || errorMessage.includes('fetch')) {
          return {
            userMessage: 'Network error occurred. Please check your connection and try again.',
          };
        }
        return { userMessage: 'An error occurred. Please try again.' };
      }
    } else if (error?.message) {
      try {
        errorData = JSON.parse(error.message);
      } catch {
        // Not a JSON error, return the original message if it's user-friendly
        if (errorMessage.length < 100 && !errorMessage.includes('0x')) {
          return { userMessage: errorMessage };
        }
        return { userMessage: 'An error occurred. Please try again.' };
      }
    } else {
      return { userMessage: 'An unexpected error occurred. Please try again.' };
    }

    // Handle structured Relay API errors
    if (errorData?.errorCode && RELAY_ERROR_MESSAGES[errorData.errorCode]) {
      return {
        userMessage: RELAY_ERROR_MESSAGES[errorData.errorCode],
        errorCode: errorData.errorCode,
      };
    }

    // Fallback to original message if error code not found
    return {
      userMessage: errorData.message || 'An error occurred. Please try again.',
      errorCode: errorData.errorCode,
    };
  } catch {
    return { userMessage: 'An unexpected error occurred. Please try again.' };
  }
};

/**
 * Checks the gas balance on Gnosis chain
 * @param address The wallet address to check
 * @returns Promise<boolean> True if balance is >= GAS_TOPUP_THRESHOLD_XDAI, false otherwise
 */
const checkGnosisGasBalance = async (address: string): Promise<boolean> => {
  try {
    console.log('🔍 Checking Gnosis gas balance for:', address);

    const { client } = getGnosisPublicClient();
    const balance = await client.getBalance({ address: address as `0x${string}` });

    // Convert balance to ether (xDAI)
    const balanceInEther = parseFloat(formatEther(balance));

    console.log(`💰 Gnosis balance: ${balanceInEther} xDAI`);

    // Return true if balance is >= threshold
    const hasEnoughGas = balanceInEther >= GAS_TOPUP_THRESHOLD_XDAI;
    console.log(`⛽ Has enough gas (>=${GAS_TOPUP_THRESHOLD_XDAI} xDAI): ${hasEnoughGas}`);

    return hasEnoughGas;
  } catch (error) {
    console.error('❌ Error checking Gnosis gas balance:', error);
    // If we can't check the balance, default to enabling gas top-up for safety
    return false;
  }
};

/**
 * Checks the current BZZ token allowance for the Swarm registry contract
 */
const checkBzzAllowance = async (userAddress: string, requiredAmount: string): Promise<boolean> => {
  try {
    const publicClient = getGnosisPublicClient().client;

    const allowance = await publicClient.readContract({
      address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
      abi: parseAbi([
        'function allowance(address owner, address spender) external view returns (uint256)',
      ]),
      functionName: 'allowance',
      args: [userAddress as `0x${string}`, GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`],
    });

    const hasEnoughAllowance = BigInt(allowance.toString()) >= BigInt(requiredAmount);

    console.log('🔍 BZZ allowance check:', {
      user: userAddress,
      spender: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
      currentAllowance: allowance.toString(),
      requiredAmount,
      hasEnoughAllowance,
    });

    return hasEnoughAllowance;
  } catch (error) {
    console.warn('⚠️ Failed to check BZZ allowance, will include approval:', error);
    return false; // If we can't check, include approval to be safe
  }
};

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
  topupGasAmount?: string;
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
        gas?: string;
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

  try {
    if (topUpBatchId) {
      // Top up existing batch
      console.log(`Creating top-up transaction for batch: ${topUpBatchId}`);
      console.log('Top-up parameters:', {
        batchId: topUpBatchId,
        topupAmount: swarmConfig.swarmBatchInitialBalance,
      });

      contractCallData = encodeFunctionData({
        abi: parseAbi(swarmConfig.swarmContractAbi),
        functionName: 'topUpBatch',
        args: [topUpBatchId as `0x${string}`, swarmConfig.swarmBatchInitialBalance],
      });
    } else {
      // Create new batch
      console.log('Creating new batch with parameters:', {
        owner: address,
        nodeAddress,
        initialBalance: swarmConfig.swarmBatchInitialBalance,
        depth: swarmConfig.swarmBatchDepth,
        bucketDepth: swarmConfig.swarmBatchBucketDepth,
        nonce: swarmConfig.swarmBatchNonce,
        immutable: swarmConfig.swarmBatchImmutable,
      });

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

    console.log('✅ Contract call data encoded successfully:', {
      length: contractCallData.length,
      data: contractCallData.slice(0, 10) + '...',
    });
  } catch (error) {
    console.error('❌ Failed to encode contract call data:', error);
    throw new Error(
      `Failed to encode Swarm contract call: ${error instanceof Error ? error.message : String(error)}`
    );
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

  // Step 3: Check if approval is needed and prepare transactions
  // Following Relay ERC20 best practices: https://docs.relay.link/guides/calling#erc20-best-practices
  const txs = [];

  // Only check allowance for cross-chain transactions (same-chain will be handled differently)
  let needsApproval = true;
  if (selectedChainId === ChainId.DAI) {
    // For same-chain transactions, check current allowance
    needsApproval = !(await checkBzzAllowance(address, bzzAmount));
  }

  if (needsApproval) {
    console.log('🔐 BZZ approval needed - preparing infinite approval...');

    // Use infinite approval (max uint256) to avoid future approval transactions
    const MAX_UINT256 =
      '115792089237316195423570985008687907853269984665640564039457584007913129639935';

    const approvalData = encodeFunctionData({
      abi: parseAbi(['function approve(address spender, uint256 amount) external returns (bool)']),
      functionName: 'approve',
      args: [GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
    });

    console.log('✅ BZZ approval data prepared:', {
      spender: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
      amount: 'MAX_UINT256 (infinite)',
      data: approvalData.slice(0, 10) + '...',
    });

    // Add approval transaction first
    txs.push({
      to: GNOSIS_BZZ_ADDRESS,
      value: '0',
      data: approvalData,
    });
  } else {
    console.log('✅ BZZ approval sufficient - skipping approval transaction');
  }

  // Always add the Swarm contract call
  txs.push({
    to: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
    value: '0',
    data: contractCallData,
  });

  console.log(`📋 Prepared ${txs.length} transaction(s):`, {
    includesApproval: needsApproval,
    includesContractCall: true,
  });

  // Step 4: Check gas balance on Gnosis chain for cross-chain swaps
  let shouldTopupGas = false;
  if (selectedChainId !== ChainId.DAI) {
    // Only check gas balance for cross-chain swaps
    const hasEnoughGas = await checkGnosisGasBalance(address);
    shouldTopupGas = !hasEnoughGas; // Top up if balance < GAS_TOPUP_THRESHOLD_XDAI

    console.log(
      `⛽ Gas top-up decision: ${shouldTopupGas ? 'ENABLED' : 'DISABLED'} (cross-chain swap)`
    );
  } else {
    console.log('⛽ Gas top-up: DISABLED (same-chain swap)');
  }

  // Step 5: Create Relay quote request
  const relayQuoteRequest: RelayQuoteRequest = {
    user: address,
    recipient: address,
    originChainId: selectedChainId,
    destinationChainId: ChainId.DAI, // Always Gnosis
    originCurrency,
    destinationCurrency,
    amount: bzzAmount,
    tradeType: 'EXACT_OUTPUT', // We need exact BZZ amount
    txs,
    slippageTolerance: (DEFAULT_SLIPPAGE * 100).toString(), // Convert to integer percentage (5 for 5%)
    refundOnOrigin: true,
    topupGas: shouldTopupGas, // Conditionally enable gas forwarding
    ...(shouldTopupGas && { topupGasAmount: GAS_TOPUP_AMOUNT_USD }), // Gas top-up amount from constants
  };

  // Step 6: Make API request to Relay
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
        console.error('❌ Relay API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorText,
        });

        // Parse and throw structured error for better handling
        const { userMessage, errorCode } = parseRelayError(errorText);
        const error = new Error(userMessage);
        (error as any).relayErrorCode = errorCode;
        (error as any).originalError = errorText;
        throw error;
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
 * Following Relay's step execution pattern: https://docs.relay.link/references/api/step-execution
 */
export const executeRelaySteps = async (
  relayQuoteResponse: RelayQuoteResponse,
  walletClient: any,
  publicClient: any,
  setStatusMessage: (status: any) => void,
  onTransactionConfirmed?: () => void
): Promise<void> => {
  console.log('🚀 Starting Relay step execution...');

  let timerStarted = false; // Track if we've started the timer

  for (let i = 0; i < relayQuoteResponse.steps.length; i++) {
    const step = relayQuoteResponse.steps[i];
    console.log(`📋 Executing step ${i + 1}/${relayQuoteResponse.steps.length}: ${step.id}`);

    // Use user-friendly messages instead of technical Relay descriptions
    const getUserFriendlyMessage = (stepId: string, description: string) => {
      const lowerDesc = description.toLowerCase();

      if (
        lowerDesc.includes('depositing funds to the relayer') ||
        (lowerDesc.includes('depositing') && lowerDesc.includes('relayer'))
      ) {
        return 'Depositing funds';
      }

      if (lowerDesc.includes('swap') && lowerDesc.includes('bzz')) {
        return 'Processing swap';
      }

      // For other steps, use a generic message
      return 'Processing transaction';
    };

    setStatusMessage({
      step: step.id,
      message: getUserFriendlyMessage(step.id, step.description),
    });

    // Skip steps with no items or empty items array
    if (!step.items || step.items.length === 0) {
      console.log(`⏭️ Skipping step ${step.id} - no items to process`);
      continue;
    }

    // Process each item in the step
    for (let j = 0; j < step.items.length; j++) {
      const item = step.items[j];
      console.log(`📝 Processing item ${j + 1}/${step.items.length} in step ${step.id}`);

      // Skip completed items
      if (item.status === 'complete') {
        console.log(`✅ Item ${j + 1} already complete, skipping`);
        continue;
      }

      // Handle incomplete items with data
      if (item.status === 'incomplete' && item.data) {
        console.log('💫 Executing transaction:', {
          to: item.data.to,
          value: item.data.value,
          chainId: item.data.chainId,
          gas: item.data.gas,
        });

        try {
          // Execute the transaction with proper error handling
          const txHash = await walletClient.sendTransaction({
            to: item.data.to as `0x${string}`,
            data: item.data.data as `0x${string}`,
            value: BigInt(item.data.value || '0'),
            gas: item.data.gas ? BigInt(item.data.gas) : undefined,
            maxFeePerGas: item.data.maxFeePerGas ? BigInt(item.data.maxFeePerGas) : undefined,
            maxPriorityFeePerGas: item.data.maxPriorityFeePerGas
              ? BigInt(item.data.maxPriorityFeePerGas)
              : undefined,
            chain: { id: item.data.chainId },
          });

          console.log(`✅ Transaction sent: ${txHash}`);

          // Wait for transaction confirmation
          setStatusMessage({
            step: step.id,
            message: `Waiting for transaction confirmation...`,
          });

          const receipt = await publicClient.waitForTransactionReceipt({
            hash: txHash,
            timeout: TRANSACTION_TIMEOUT_MS,
          });

          if (receipt.status === 'success') {
            console.log(`✅ Transaction confirmed: ${txHash}`);

            // Start timer after first transaction confirmation
            if (!timerStarted && onTransactionConfirmed) {
              onTransactionConfirmed();
              timerStarted = true;
            }

            // If there's a check endpoint, monitor the Relay status
            if (item.check) {
              setStatusMessage({
                step: step.id,
                message: `Transaction confirmed, monitoring status...`,
              });

              await monitorRelayStatus(item.check.endpoint, setStatusMessage, step.id);
            }
          } else {
            throw new Error(`Transaction failed: ${txHash}`);
          }
        } catch (error) {
          console.error(`❌ Failed to execute step ${step.id}, item ${j + 1}:`, error);

          // Provide more detailed error information
          const errorMessage = error instanceof Error ? error.message : String(error);
          setStatusMessage({
            step: 'Error',
            message: `Step ${step.id} failed`,
            error: errorMessage,
            isError: true,
          });

          throw new Error(`Step ${step.id} failed: ${errorMessage}`);
        }
      } else if (item.status === 'incomplete' && !item.data) {
        // Handle items that need polling (data might be missing initially)
        console.log(`⏳ Item ${j + 1} has no data, polling may be required`);

        if (item.check) {
          setStatusMessage({
            step: step.id,
            message: `Waiting for step data...`,
          });

          await monitorRelayStatus(item.check.endpoint, setStatusMessage, step.id);
        }
      }
    }
  }

  console.log('🎉 All Relay steps completed successfully!');
};

/**
 * Monitors the status of a Relay operation
 * Status types: waiting, pending, success, failure, refund
 * https://docs.relay.link/references/api/step-execution
 */
const monitorRelayStatus = async (
  statusEndpoint: string,
  setStatusMessage: (status: any) => void,
  stepId: string
): Promise<void> => {
  const maxAttempts = RELAY_STATUS_MAX_ATTEMPTS;
  let attempts = 0;

  console.log(`🔍 Starting status monitoring for step ${stepId}: ${statusEndpoint}`);

  while (attempts < maxAttempts) {
    try {
      const response = await fetch(`https://api.relay.link${statusEndpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.warn(`⚠️ Status check failed with ${response.status}, retrying...`);
        attempts++;
        await new Promise(resolve => setTimeout(resolve, RELAY_STATUS_CHECK_INTERVAL_MS));
        continue;
      }

      const statusData = await response.json();
      console.log(`📊 Relay status for ${stepId}:`, statusData);

      // Handle different status types according to Relay docs
      switch (statusData.status) {
        case 'success':
          console.log(`✅ Relay operation completed successfully for step ${stepId}`);
          setStatusMessage({
            step: stepId,
            message: 'Cross-chain swap completed successfully',
          });
          return;

        case 'waiting':
          console.log(`⏳ Deposit transaction for ${stepId} is yet to be indexed`);
          setStatusMessage({
            step: stepId,
            message: 'Confirming your transaction...',
          });
          break;

        case 'pending':
          console.log(`🔄 Deposit transaction for ${stepId} was indexed, fill is pending`);
          setStatusMessage({
            step: stepId,
            message: 'Processing cross-chain transfer...',
          });
          break;

        case 'failure':
          console.error(`❌ Relay operation failed for step ${stepId}, attempting refund`);
          throw new Error(`Cross-chain swap failed, attempting refund`);

        case 'refund':
          console.error(`💸 Funds were refunded due to failure for step ${stepId}`);
          throw new Error(`Swap failed and funds were refunded`);

        default:
          console.log(`🔄 Unknown status '${statusData.status}' for step ${stepId}, continuing...`);
          setStatusMessage({
            step: stepId,
            message: 'Processing your swap...',
          });
      }

      // Wait before next check
      await new Promise(resolve => setTimeout(resolve, RELAY_STATUS_CHECK_INTERVAL_MS));
      attempts++;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Relay operation failed')) {
        // Re-throw Relay-specific errors
        throw error;
      }

      console.error(`⚠️ Error checking Relay status for ${stepId}:`, error);
      attempts++;

      if (attempts >= maxAttempts) {
        throw new Error(`Status monitoring timed out for step ${stepId}`);
      }

      await new Promise(resolve => setTimeout(resolve, RELAY_STATUS_CHECK_INTERVAL_MS));
    }
  }

  throw new Error(`Operation timed out for step ${stepId} after ${maxAttempts} attempts`);
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
