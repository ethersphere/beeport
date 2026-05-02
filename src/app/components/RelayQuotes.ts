import { formatEther } from 'viem';
import { ChainId } from '@lifi/sdk';
import {
  GNOSIS_BZZ_ADDRESS,
  DEFAULT_SLIPPAGE,
  GAS_TOPUP_THRESHOLD_XDAI,
  GAS_TOPUP_AMOUNT_USD,
  RELAY_STATUS_CHECK_INTERVAL_MS,
  RELAY_STATUS_MAX_ATTEMPTS,
  STAMPS_REGISTRY_V2_ADDRESS,
  TRANSACTION_TIMEOUT_MS,
} from './constants';
import { performWithRetry, getGnosisPublicClient } from './utils';
import { encodeRegistryCreateBatchTxs } from './SelfCustodyBatch';
import { getPollingInterval } from '@/app/wagmi';

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
  /** Slippage in percent (e.g. 5 = 5%, 0.5 = 0.5%). When set, overrides DEFAULT_SLIPPAGE. Relay API receives basis points (percent × 100). */
  slippagePercent?: number;
}


/**
 * Optional escape-hatch passed by the caller. Returns `true` if the desired
 * end state has been observed *on-chain* (e.g. the registry batch exists),
 * letting us treat a `fallback`/`refunded` Relay status as a false positive
 * and continue as if the order succeeded.
 *
 * In practice this happens for some Relay routes where the destination fill
 * succeeds but Relay still reports a tiny refund of unused inventory and
 * tags the order as `fallback` — observed concretely on the cross-chain →
 * SushiSwap-on-Gnosis → BZZ → StampsRegistryV2 path, where the on-chain
 * `BatchCreated` event was emitted but `/intents/status` returned
 * `fallback: Refunding`.
 */
export type RelayOnChainSuccessVerifier = () => Promise<boolean>;

/**
 * Executes a Relay quote by processing each step sequentially
 * Following Relay's step execution pattern: https://docs.relay.link/references/api/step-execution
 */
export const executeRelaySteps = async (
  relayQuoteResponse: RelayQuoteResponse,
  walletClient: any,
  publicClient: any,
  setStatusMessage: (status: any) => void,
  onTransactionConfirmed?: () => void,
  verifyOnChainSuccess?: RelayOnChainSuccessVerifier
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
            pollingInterval: getPollingInterval(item.data.chainId),
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

              await monitorRelayStatus(
                item.check.endpoint,
                setStatusMessage,
                step.id,
                verifyOnChainSuccess
              );
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

          await monitorRelayStatus(
            item.check.endpoint,
            setStatusMessage,
            step.id,
            verifyOnChainSuccess
          );
        }
      }
    }
  }

  console.log('🎉 All Relay steps completed successfully!');
};

/**
 * Status returned by Relay's `/intents/status` endpoint.
 *
 * Two API versions exist in the wild and Relay has populated different status
 * sets in each — both endpoints can show up depending on which `check.endpoint`
 * a particular quote step uses. We handle the union of both:
 *
 *  v1 (`/intents/status`)
 *    - failure  → quote failed, no fill
 *    - fallback → fill failed and **refund has been issued** (terminal)
 *    - pending  → indexed, fill in flight
 *    - received → seen but not yet indexed
 *    - success  → filled
 *
 *  v3 (`/intents/status/v3`)
 *    - waiting     → awaiting deposit confirmation
 *    - depositing  → deposit confirmed via /execute, fill pending
 *    - pending     → deposit confirmed, fill pending
 *    - submitted   → destination tx submitted by solver
 *    - success     → destination fill confirmed
 *    - delayed     → fill is delayed but still in progress
 *    - refunded    → refund completed (terminal — equivalent to v1 `fallback`)
 *    - failure     → unsuccessful, no refund issued (rare)
 *
 * Anything else we treat as "still in progress" with a bounded attempt counter
 * so an unrecognised status added by Relay later doesn't cause infinite polling
 * but also doesn't cause spurious failures.
 */
type RelayInProgressStatus =
  | 'waiting'
  | 'received'
  | 'depositing'
  | 'pending'
  | 'submitted'
  | 'delayed'
  | 'unknown';

const RELAY_INPROGRESS_STATUSES: ReadonlySet<RelayInProgressStatus> = new Set([
  'waiting',
  'received',
  'depositing',
  'pending',
  'submitted',
  'delayed',
  'unknown',
]);

const RELAY_TERMINAL_REFUND_STATUSES = new Set(['fallback', 'refunded', 'refund']);
const RELAY_TERMINAL_FAILURE_STATUSES = new Set(['failure', 'failed']);

const formatHashes = (hashes: unknown): string =>
  Array.isArray(hashes) && hashes.length > 0 ? (hashes as string[]).join(', ') : '(none yet)';

/**
 * Poll the Relay status endpoint until we reach a terminal state, surfacing
 * helpful diagnostics on failure.
 *
 * Notable behaviour:
 *  - `success` is a terminal success; we additionally treat any state where
 *    `verifyOnChainSuccess` returns `true` as success, in case Relay's status
 *    lags behind the actual on-chain fill.
 *  - `fallback` (v1) and `refunded` (v3) are recognised as **refund signals**.
 *    Previously these fell into a `default` branch and caused the UI to spin
 *    forever. We now check `verifyOnChainSuccess` first — Relay sometimes
 *    reports `fallback` (with a tiny refund tx of unused inventory on the
 *    origin chain) even when the destination fill landed cleanly. If the
 *    on-chain end state is observed, we promote to success; otherwise we
 *    throw a real refund error including the destination tx hash so users
 *    can inspect it on Gnosisscan.
 *  - In-progress statuses don't count against `RELAY_STATUS_MAX_ATTEMPTS` —
 *    only stale or unrecognised statuses do.
 */
const monitorRelayStatus = async (
  statusEndpoint: string,
  setStatusMessage: (status: any) => void,
  stepId: string,
  verifyOnChainSuccess?: RelayOnChainSuccessVerifier
): Promise<void> => {
  const maxAttempts = RELAY_STATUS_MAX_ATTEMPTS;
  let attempts = 0;
  let inProgressCount = 0;
  // Cap consecutive in-progress polls so a stalled solver doesn't loop forever.
  // 24 * 5s = 2 min ceiling for any single in-progress phase.
  const maxInProgressAttempts = 24;

  // Best-effort on-chain check. Swallow errors so a bad RPC moment doesn't
  // mask the actual Relay status.
  const tryVerify = async (): Promise<boolean> => {
    if (!verifyOnChainSuccess) return false;
    try {
      return await verifyOnChainSuccess();
    } catch (e) {
      console.warn(`⚠️ on-chain verification check failed (will retry):`, e);
      return false;
    }
  };

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
      const rawStatus: string = (statusData?.status ?? '').toString();
      const status = rawStatus.toLowerCase();
      const details = statusData?.details ? `: ${statusData.details}` : '';
      const inHashes = formatHashes(statusData?.inTxHashes);
      const outHashes = formatHashes(statusData?.txHashes);
      console.log(
        `📊 Relay status for ${stepId}: ${status}${details} (in=${inHashes}, out=${outHashes})`
      );

      if (status === 'success') {
        console.log(`✅ Relay operation completed successfully for step ${stepId}`);
        setStatusMessage({
          step: stepId,
          message: 'Cross-chain swap completed successfully',
        });
        return;
      }

      if (RELAY_TERMINAL_REFUND_STATUSES.has(status)) {
        // 'fallback'/'refunded' = Relay says it issued a refund. BUT some
        // routes (notably cross-chain → SushiSwap-on-Gnosis → BZZ + custom
        // `txs[]` post-action) emit `fallback` even when the destination
        // fill succeeded — Relay just refunded a tiny dust amount of unused
        // inventory on the origin chain and tagged the whole order as
        // fallback. So before declaring failure, give the on-chain check a
        // few tries to catch up — destination fills can land a few seconds
        // after the status flips.
        if (verifyOnChainSuccess) {
          for (let i = 0; i < 6; i++) {
            if (await tryVerify()) {
              console.log(
                `✅ Relay reported '${status}' but the on-chain end state is present — treating step ${stepId} as success`
              );
              setStatusMessage({
                step: stepId,
                message: 'Cross-chain swap completed successfully',
              });
              return;
            }
            await new Promise(resolve => setTimeout(resolve, 5_000));
          }
        }

        const hashSuffix =
          Array.isArray(statusData?.txHashes) && statusData.txHashes.length > 0
            ? ` (destination tx: ${statusData.txHashes.join(', ')})`
            : '';
        console.error(
          `💸 Relay refunded the swap for step ${stepId}${details}${hashSuffix}`
        );
        throw new Error(
          `Cross-chain swap was refunded by Relay${
            statusData?.details ? ` (${statusData.details})` : ''
          }. Your funds will return to your wallet on the origin chain.${hashSuffix}`
        );
      }

      if (RELAY_TERMINAL_FAILURE_STATUSES.has(status)) {
        console.error(`❌ Relay reported failure for step ${stepId}${details}`);
        throw new Error(
          `Cross-chain swap failed${
            statusData?.details ? ` (${statusData.details})` : ''
          }. Please retry shortly.`
        );
      }

      if (RELAY_INPROGRESS_STATUSES.has(status as RelayInProgressStatus) || status === '') {
        inProgressCount++;
        const friendly = (() => {
          switch (status) {
            case 'waiting':
            case 'received':
              return 'Confirming your transaction...';
            case 'depositing':
            case 'pending':
              return 'Processing cross-chain transfer...';
            case 'submitted':
              return 'Solver submitted destination transaction...';
            case 'delayed':
              return 'Fill is delayed but still in progress...';
            default:
              return 'Waiting for transaction to be indexed...';
          }
        })();
        setStatusMessage({ step: stepId, message: friendly });

        if (inProgressCount >= maxInProgressAttempts) {
          throw new Error(
            `Relay is still '${status || 'unknown'}' after ${
              (maxInProgressAttempts * RELAY_STATUS_CHECK_INTERVAL_MS) / 1000
            }s. The fill may still complete — check your wallet shortly.`
          );
        }
      } else {
        // Unrecognised status. Counted toward `attempts` so we eventually
        // give up rather than loop indefinitely on something Relay added
        // post-this-release.
        console.warn(`🔄 Unrecognised Relay status '${rawStatus}' for step ${stepId}`);
        setStatusMessage({
          step: stepId,
          message: 'Processing your swap...',
        });
        attempts++;
      }

      await new Promise(resolve => setTimeout(resolve, RELAY_STATUS_CHECK_INTERVAL_MS));
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('refunded by Relay') ||
          error.message.includes('Cross-chain swap failed') ||
          error.message.includes('Relay is still') ||
          error.message.includes('Transaction indexing timed out'))
      ) {
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
 * SELF-CUSTODY bridge-only quote: deliver BZZ to the user's wallet on Gnosis,
 * **without** appending any destination contract calls. The follow-up
 * `createBatch(_owner = hotKey)` is signed by the user's wallet on Gnosis
 * separately so that `msg.sender` (and therefore the on-chain batchId
 * derivation) is the user, not a Relay multicaller.
 *
 * Works for:
 *   • Same-chain Gnosis non-BZZ token (Relay does an on-chain swap)
 *   • True cross-chain (Relay bridges + final delivery is BZZ-on-Gnosis)
 *
 * The Gnosis + BZZ case should NOT call this helper — there's nothing to bridge.
 */
export interface RelayBridgeOnlyQuoteParams {
  selectedChainId: number;
  fromToken: string;
  /** Wallet address that pays / receives BZZ. */
  address: string;
  /** Total BZZ atomic units to deliver to the user's wallet on Gnosis. */
  bzzAmount: string;
  setEstimatedTime?: (time: number) => void;
  isForEstimation?: boolean;
  slippagePercent?: number;
}

export const getRelayBridgeOnlyToBzzQuote = async ({
  selectedChainId,
  fromToken,
  address,
  bzzAmount,
  setEstimatedTime,
  isForEstimation = false,
  slippagePercent,
}: RelayBridgeOnlyQuoteParams): Promise<{
  relayQuoteResponse: RelayQuoteResponse;
  totalAmountUSD: number;
}> => {
  console.log(
    `🌉 Self-custody bridge-only Relay quote ${isForEstimation ? '(estimation)' : '(execution)'}…`
  );

  // Gas top-up: only meaningful for cross-chain. After the bridge the user
  // will sign an approve + createBatch on Gnosis, so they need xDAI.
  let shouldTopupGas = false;
  if (selectedChainId !== ChainId.DAI) {
    const hasEnoughGas = await checkGnosisGasBalance(address);
    shouldTopupGas = !hasEnoughGas;
  }

  const relayQuoteRequest: RelayQuoteRequest = {
    user: address,
    recipient: address,
    originChainId: selectedChainId,
    destinationChainId: ChainId.DAI,
    originCurrency: fromToken,
    destinationCurrency: GNOSIS_BZZ_ADDRESS,
    amount: bzzAmount,
    tradeType: 'EXACT_OUTPUT',
    // No `txs` — pure bridge to BZZ in the user's own wallet.
    slippageTolerance: Math.round((slippagePercent ?? DEFAULT_SLIPPAGE) * 100).toString(),
    refundOnOrigin: true,
    topupGas: shouldTopupGas,
    ...(shouldTopupGas && { topupGasAmount: GAS_TOPUP_AMOUNT_USD }),
  };

  const relayQuoteResponse = await performWithRetry(
    async () => {
      console.log('🌐 Relay self-custody bridge-only request:', relayQuoteRequest);
      const response = await fetch('https://api.relay.link/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayQuoteRequest),
      });
      if (!response.ok) {
        const errorText = await response.text();
        const { userMessage, errorCode } = parseRelayError(errorText);
        const err = new Error(userMessage);
        (err as any).relayErrorCode = errorCode;
        (err as any).originalError = errorText;
        throw err;
      }
      const data = await response.json();
      return data as RelayQuoteResponse;
    },
    `getRelayBridgeOnlyToBzzQuote-${isForEstimation ? 'estimation' : 'execution'}`,
    undefined,
    isForEstimation ? 3 : 5,
    500
  );

  const totalAmountUSD = Number(relayQuoteResponse.details.currencyIn.amountUsd || 0);
  if (setEstimatedTime && relayQuoteResponse.details.timeEstimate) {
    setEstimatedTime(Math.ceil(relayQuoteResponse.details.timeEstimate));
  }

  console.log(
    `✅ Self-custody bridge-only quote: $${totalAmountUSD.toFixed(2)}, steps: ${relayQuoteResponse.steps.length}`
  );

  return { relayQuoteResponse, totalAmountUSD };
};

// ─────────────────────────────────────────────────────────────────────────────
// One-shot self-custody buy via Relay `txs` (StampsRegistryV2)
//
// Restores the legacy single-signature buy UX. Relay bridges/swaps any token
// → BZZ on Gnosis, lands BZZ in the executor multicaller, and runs two `txs`
// in sequence as that multicaller:
//
//   1. BZZ.approve(STAMPS_REGISTRY_V2, totalAmount)
//   2. StampsRegistryV2.createSelfCustodyBatch(wallet, hotKey, …)
//
// Because every call to PostageStamp routes through StampsRegistryV2,
// `batchId = keccak256(STAMPS_REGISTRY_V2, nonce)` is deterministic from the
// UI before broadcast — the multicaller's identity does NOT change the ID.
// ─────────────────────────────────────────────────────────────────────────────

export interface RelayBuyStampQuoteParams {
  selectedChainId: number;
  fromToken: string;
  /** User wallet that signs the deposit on the origin chain. */
  address: string;
  /** Total BZZ atomic units the registry call needs (= initialBalancePerChunk * 2^depth). */
  bzzAmount: string;
  /** Hot-key address that becomes the on-chain `_owner` of the new batch. */
  hotKeyAddress: `0x${string}`;
  /** initialBalancePerChunk in PLUR atomic units. */
  initialBalancePerChunk: bigint;
  /** Stamp depth (passed straight through to the registry call). */
  depth: number;
  /** Stamp bucket depth (typically 16). */
  bucketDepth: number;
  /** 32-byte hex nonce. With or without 0x prefix. */
  nonce: `0x${string}` | string;
  /** Whether the batch is immutable. */
  immutable_: boolean;
  /** 'exact' approves only `bzzAmount`; 'infinite' approves MAX_UINT256. */
  approvalType?: 'exact' | 'infinite';
  setEstimatedTime?: (time: number) => void;
  isForEstimation?: boolean;
  /** Slippage in percent (e.g. 5 = 5%). Converted to basis points for Relay. */
  slippagePercent?: number;
}

/**
 * Gas budget for the two destination-chain txs Relay's executor runs as the
 * multicaller on Gnosis:
 *
 *   1. BZZ.approve(STAMPS_REGISTRY_V2, …)        ≈ 50 k
 *   2. StampsRegistryV2.createSelfCustodyBatch(…) ≈ 565 k
 *      (measured from a real EOA tx — the upstream
 *      `PostageStamp.createBatch` is gas-heavy: several SSTOREs + event;
 *      see GnosisScan tx 0xfdb4924…f257b → gasUsed = 563 943.)
 *
 * Real-world total: ~615 k. Earlier we capped at 600 k and the destination
 * call OOG'd, which Relay reports as `fallback: Refunding` — the symptom the
 * user saw as "cross-chain fails all the time" while same-chain Gnosis (which
 * doesn't go through Relay's executor) was fine.
 *
 * Per Relay docs (`/quote` request body) `txsGasLimit` is the **total** gas
 * for all destination `txs` combined, so we budget ~2× headroom to absorb
 * future contract changes, ABI tweaks, or PostageStamp gas inflation without
 * silently regressing into another wave of refunds. Wasted gas on Gnosis is
 * negligible cost-wise, OOG refunds are not.
 */
const REGISTRY_TXS_GAS_LIMIT = 1_500_000;

export const getRelayBuyStampQuote = async ({
  selectedChainId,
  fromToken,
  address,
  bzzAmount,
  hotKeyAddress,
  initialBalancePerChunk,
  depth,
  bucketDepth,
  nonce,
  immutable_,
  approvalType = 'exact',
  setEstimatedTime,
  isForEstimation = false,
  slippagePercent,
}: RelayBuyStampQuoteParams): Promise<{
  relayQuoteResponse: RelayQuoteResponse;
  totalAmountUSD: number;
}> => {
  console.log(
    `🛒 One-shot Relay buy-stamp quote ${isForEstimation ? '(estimation)' : '(execution)'}…`
  );

  // Gas top-up: only meaningful for cross-chain. After the bridge the user
  // has nothing else to sign on Gnosis (the registry call runs as Relay's
  // multicaller), so we don't strictly need xDAI on the user's wallet —
  // but topping up keeps `topUp` / `increaseDepth` follow-ups cheap and
  // matches the bridge-only path's behaviour.
  let shouldTopupGas = false;
  if (selectedChainId !== ChainId.DAI) {
    const hasEnoughGas = await checkGnosisGasBalance(address);
    shouldTopupGas = !hasEnoughGas;
  }

  const txs = encodeRegistryCreateBatchTxs({
    walletAddress: address as `0x${string}`,
    hotKeyAddress,
    initialBalancePerChunk,
    depth,
    bucketDepth,
    nonce,
    immutable_,
    approvalType,
  });

  const relayQuoteRequest: RelayQuoteRequest & {
    txsGasLimit?: number;
  } = {
    user: address,
    // The recipient is the address Relay treats as the receiver of any swap
    // surplus / refund. Even though the multicaller temporarily holds BZZ
    // to execute `txs`, leftover funds (e.g. slippage surplus, gas top-up)
    // come back to the user wallet.
    recipient: address,
    originChainId: selectedChainId,
    destinationChainId: ChainId.DAI,
    originCurrency: fromToken,
    destinationCurrency: GNOSIS_BZZ_ADDRESS,
    amount: bzzAmount,
    tradeType: 'EXACT_OUTPUT',
    txs,
    txsGasLimit: REGISTRY_TXS_GAS_LIMIT,
    slippageTolerance: Math.round((slippagePercent ?? DEFAULT_SLIPPAGE) * 100).toString(),
    refundOnOrigin: true,
    topupGas: shouldTopupGas,
    ...(shouldTopupGas && { topupGasAmount: GAS_TOPUP_AMOUNT_USD }),
  };

  const relayQuoteResponse = await performWithRetry(
    async () => {
      console.log('🌐 Relay one-shot buy-stamp request:', {
        ...relayQuoteRequest,
        txs: relayQuoteRequest.txs?.map(t => ({
          to: t.to,
          value: t.value,
          dataLen: t.data.length,
        })),
      });
      const response = await fetch('https://api.relay.link/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(relayQuoteRequest),
      });
      if (!response.ok) {
        const errorText = await response.text();
        const { userMessage, errorCode } = parseRelayError(errorText);
        const err = new Error(userMessage);
        (err as any).relayErrorCode = errorCode;
        (err as any).originalError = errorText;
        throw err;
      }
      const data = await response.json();
      return data as RelayQuoteResponse;
    },
    `getRelayBuyStampQuote-${isForEstimation ? 'estimation' : 'execution'}`,
    undefined,
    isForEstimation ? 3 : 5,
    500
  );

  const totalAmountUSD = Number(relayQuoteResponse.details.currencyIn.amountUsd || 0);
  if (setEstimatedTime && relayQuoteResponse.details.timeEstimate) {
    setEstimatedTime(Math.ceil(relayQuoteResponse.details.timeEstimate));
  }

  // Log the destination route — when a fill fails this is by far the most
  // useful signal (which DEX/router is going to swap into BZZ on Gnosis).
  const destination = (relayQuoteResponse.details as any)?.route?.destination;
  if (destination) {
    console.log(
      `↪️  Relay destination route: ${destination?.inputCurrency?.currency?.symbol} → ${destination?.outputCurrency?.currency?.symbol} via ${destination?.router}`
    );
  }
  console.log(
    `✅ One-shot Relay buy-stamp quote: $${totalAmountUSD.toFixed(2)}, steps: ${relayQuoteResponse.steps.length}, txs: ${txs.length}, registry: ${STAMPS_REGISTRY_V2_ADDRESS}, requestId: ${relayQuoteResponse.steps?.[0]?.requestId ?? 'n/a'}`
  );

  return { relayQuoteResponse, totalAmountUSD };
};
