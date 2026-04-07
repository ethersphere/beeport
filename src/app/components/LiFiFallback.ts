/**
 * LI.FI fallback for when Relay is unavailable or has no routes.
 *
 * Flow:
 *  1. getLiFiExactOutQuote()  — exact-output quote via GET /v1/quote/toAmount
 *  2. executeLiFiSwap()       — send the transactionRequest from the quote
 *  3. monitorLiFiStatus()     — poll bridge status for cross-chain swaps
 *
 * After the swap completes, the BZZ will be in the user's Gnosis wallet.
 * The caller is then responsible for executing the Swarm contract call
 * (approval + createBatchRegistry / topUpBatch) via handleDirectBzzTransactions.
 */

import { ChainId } from '@lifi/sdk';
import { DEFAULT_SLIPPAGE, GNOSIS_BZZ_ADDRESS, LIFI_API_KEY } from './constants';
import { performWithRetry } from './utils';
import { getPollingInterval } from '@/app/wagmi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LiFiQuoteParams {
  selectedChainId: number;
  fromToken: string;
  address: string;
  /** Exact BZZ amount required (in raw token units, matching bzzAmount / swarmBatchTotal). */
  bzzAmount: string;
  slippagePercent?: number;
}

// ─── Quote ────────────────────────────────────────────────────────────────────

/**
 * Gets an exact-output quote from LI.FI so the user receives exactly `bzzAmount` of
 * BZZ on Gnosis, paying from any supported token on any supported chain.
 *
 * Uses GET /v1/quote/toAmount — see https://docs.li.fi/api-reference/get-a-quote-for-a-token-transfer-1
 */
export const getLiFiExactOutQuote = async ({
  selectedChainId,
  fromToken,
  address,
  bzzAmount,
  slippagePercent,
}: LiFiQuoteParams): Promise<any> => {
  // LI.FI slippage is a decimal fraction (0.05 = 5%)
  const slippage = ((slippagePercent ?? DEFAULT_SLIPPAGE) / 100).toString();

  const url = new URL('https://li.quest/v1/quote/toAmount');
  url.searchParams.set('fromChain', String(selectedChainId));
  url.searchParams.set('toChain', String(ChainId.DAI)); // always Gnosis
  url.searchParams.set('fromToken', fromToken);
  url.searchParams.set('toToken', GNOSIS_BZZ_ADDRESS);
  url.searchParams.set('fromAddress', address);
  url.searchParams.set('toAmount', bzzAmount);
  url.searchParams.set('slippage', slippage);
  url.searchParams.set('integrator', 'Swarm');

  console.log('🔵 Calling LI.FI toAmount quote:', url.toString());

  // Retry up to 3 times on any error — LI.FI can return 404 transiently even when routes exist.
  let data: any;
  let lastQuoteError: Error | null = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(url.toString(), {
      headers: { 'x-lifi-api-key': LIFI_API_KEY },
    });

    if (response.ok) {
      data = await response.json();
      lastQuoteError = null;
      break;
    }

    const errorText = await response.text();
    lastQuoteError = new Error(`LI.FI quote failed (${response.status}): ${errorText}`);
    console.warn(`LI.FI quote attempt ${attempt}/3 failed (${response.status}), retrying…`);
    if (attempt < 3) await new Promise(resolve => setTimeout(resolve, 1000));
  }
  if (lastQuoteError) throw lastQuoteError;

  console.log('✅ LI.FI quote received:', {
    tool: data.tool,
    fromAmountUSD: data.estimate?.fromAmountUSD,
    fromChainId: data.action?.fromChainId,
    toChainId: data.action?.toChainId,
  });
  return data;
};

// ─── Execute ──────────────────────────────────────────────────────────────────

/**
 * Executes the transactionRequest from a LI.FI quote.
 * For cross-chain swaps, waits for the bridge to complete before returning so
 * that the BZZ has actually arrived on Gnosis when this resolves.
 */
export const executeLiFiSwap = async (
  quote: any,
  walletClient: any,
  publicClient: any,
  setStatusMessage: (status: any) => void
): Promise<void> => {
  const tx = quote.transactionRequest;
  // Use chainId from the transactionRequest itself — it's the authoritative source
  const fromChainId: number = tx.chainId ?? quote.action.fromChainId;
  const toChainId: number = quote.action.toChainId;
  const isCrossChain = fromChainId !== toChainId;

  console.log('🔵 LI.FI executing swap tx:', {
    to: tx.to,
    value: tx.value,
    chainId: fromChainId,
    gas: tx.gasLimit,
    gasPrice: tx.gasPrice,
    maxFeePerGas: tx.maxFeePerGas,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
    dataLength: tx.data?.length,
  });

  setStatusMessage({ step: 'LiFi', message: 'Sending swap transaction…' });

  // Build tx params — handle both legacy (gasPrice) and EIP-1559 (maxFeePerGas) gas fields.
  // LI.FI can return either depending on the chain.
  const isEip1559 = Boolean(tx.maxFeePerGas);
  const txParams = {
    to: tx.to as `0x${string}`,
    data: tx.data as `0x${string}`,
    value: BigInt(tx.value || '0'),
    gas: tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
    ...(isEip1559
      ? {
          maxFeePerGas: BigInt(tx.maxFeePerGas),
          maxPriorityFeePerGas: tx.maxPriorityFeePerGas
            ? BigInt(tx.maxPriorityFeePerGas)
            : undefined,
        }
      : {
          gasPrice: tx.gasPrice ? BigInt(tx.gasPrice) : undefined,
        }),
    chain: { id: fromChainId },
  };

  // Retry the submission up to 5 times (same count as Relay execution retries).
  // Each attempt sends a fresh transaction — only retries on network/submission errors,
  // not on user rejections (those throw immediately and aren't caught by performWithRetry).
  const txHash: `0x${string}` = await performWithRetry(
    () => walletClient.sendTransaction(txParams),
    'executeLiFiSwap',
    undefined,
    5, // same as Relay execution retries
    500
  );

  console.log('✅ LI.FI tx sent:', txHash);

  setStatusMessage({ step: 'LiFi', message: 'Waiting for transaction confirmation…' });

  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    pollingInterval: getPollingInterval(fromChainId),
  });

  if (receipt.status !== 'success') {
    throw new Error('LI.FI swap transaction reverted on chain');
  }

  console.log('✅ LI.FI tx confirmed:', txHash);

  if (isCrossChain) {
    setStatusMessage({ step: 'LiFi', message: 'Bridge confirmed — waiting for funds on Gnosis…' });
    await monitorLiFiStatus(txHash, quote, setStatusMessage);
  }
};

// ─── Bridge status monitor ────────────────────────────────────────────────────

const monitorLiFiStatus = async (
  txHash: string,
  quote: any,
  setStatusMessage: (status: any) => void
): Promise<void> => {
  const bridge: string = quote.toolDetails?.key || quote.tool || '';
  const fromChain: number = quote.action.fromChainId;
  const toChain: number = quote.action.toChainId;

  const maxAttempts = 72; // 6 minutes at 5 s interval
  const intervalMs = 5_000;

  console.log(`🔍 Monitoring LI.FI bridge status for tx ${txHash} (bridge: ${bridge || 'auto'})`);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, intervalMs));

    try {
      const params = new URLSearchParams({
        txHash,
        fromChain: String(fromChain),
        toChain: String(toChain),
        ...(bridge ? { bridge } : {}),
      });

      const response = await fetch(`https://li.quest/v1/status?${params}`, {
        headers: { 'x-lifi-api-key': LIFI_API_KEY },
      });

      if (!response.ok) {
        console.warn(`LI.FI status check ${response.status}, retrying…`);
        continue;
      }

      const status = await response.json();
      console.log(`📊 LI.FI status (attempt ${attempt + 1}/${maxAttempts}): ${status.status}`);

      switch (status.status) {
        case 'DONE':
          console.log('✅ LI.FI bridge completed');
          setStatusMessage({ step: 'LiFi', message: 'Bridge complete — BZZ received on Gnosis' });
          return;

        case 'FAILED':
        case 'INVALID':
          throw new Error(`LI.FI bridge failed with status: ${status.status}`);

        case 'PENDING':
          setStatusMessage({
            step: 'LiFi',
            message: 'Processing cross-chain bridge…',
          });
          break;

        case 'NOT_FOUND':
          setStatusMessage({
            step: 'LiFi',
            message: 'Waiting for bridge to index the transaction…',
          });
          break;

        default:
          setStatusMessage({ step: 'LiFi', message: 'Processing cross-chain transfer…' });
      }
    } catch (error) {
      if (
        error instanceof Error &&
        (error.message.includes('bridge failed') || error.message.includes('INVALID'))
      ) {
        throw error;
      }
      console.warn('LI.FI status check error:', error);
    }
  }

  throw new Error('LI.FI bridge monitoring timed out after 6 minutes');
};

// ─── Fallback decision ────────────────────────────────────────────────────────

/**
 * Relay error codes for which we should try LI.FI as a fallback.
 * User rejections and insufficient-funds are intentionally excluded.
 */
const RELAY_FALLBACK_CODES = new Set([
  'NO_SWAP_ROUTES_FOUND',
  'NO_QUOTES',
  'NO_INTERNAL_SWAP_ROUTES_FOUND',
  'INSUFFICIENT_LIQUIDITY',
  'SWAP_IMPACT_TOO_HIGH',
  'CHAIN_DISABLED',
  'UNSUPPORTED_ROUTE',
  'UNSUPPORTED_CHAIN',
  'UNSUPPORTED_CURRENCY',
  'ROUTE_TEMPORARILY_RESTRICTED',
]);

/**
 * Returns true if the error from a Relay call indicates we should attempt the
 * LI.FI fallback. Returns false for user rejections, insufficient funds, or
 * any error the user must resolve themselves.
 */
export const shouldFallbackToLiFi = (error: any): boolean => {
  const message: string = error?.message || String(error);

  // Never fall back on explicit user actions
  if (
    message.includes('User rejected') ||
    message.includes('user rejected') ||
    message.includes('User denied') ||
    message.includes('rejected the request') ||
    message.includes('User cancelled')
  ) {
    return false;
  }

  const errorCode: string | undefined = (error as any)?.relayErrorCode;

  // Insufficient funds — user needs to add money regardless of the bridge used
  if (errorCode === 'INSUFFICIENT_FUNDS') return false;

  if (errorCode && RELAY_FALLBACK_CODES.has(errorCode)) return true;

  // Server / network errors on the Relay side
  if (
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('Network Error') ||
    message.includes('Failed to fetch')
  ) {
    return true;
  }

  return false;
};
