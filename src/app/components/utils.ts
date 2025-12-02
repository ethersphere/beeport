import {
  getAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  createPublicClient,
  http,
} from 'viem';
import { gnosis } from 'viem/chains';

// Global state for custom RPC URL
let globalCustomRpcUrl: string | undefined = undefined;

/**
 * Sets the global custom RPC URL
 * @param url The custom RPC URL to set, or undefined to use default
 */
export const setGnosisRpcUrl = (url: string | undefined) => {
  globalCustomRpcUrl = url;
  console.log('Set global RPC URL:', url || 'default');
};

export const toChecksumAddress = (address: string | undefined | null): string | null => {
  if (!address) return null;
  try {
    return getAddress(address);
  } catch (error) {
    console.log('Invalid address:', address, error);
    return null;
  }
};

export const formatErrorMessage = (error: unknown): string => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const requestArgsIndex = errorMessage.indexOf('Request Arguments:');
  return requestArgsIndex > -1 ? errorMessage.slice(0, requestArgsIndex).trim() : errorMessage;
};

/**
 * Calculates batch ID from nonce and sender address (pure function)
 * @param nonce The batch nonce as hex string
 * @param sender The sender address
 * @returns The calculated batch ID (without 0x prefix)
 */
export const readBatchId = (nonce: string, sender: string): string => {
  try {
    console.log('🔍 readBatchId called with nonce:', nonce, 'sender:', sender);

    const encodedData = encodeAbiParameters(parseAbiParameters(['address', 'bytes32']), [
      sender as `0x${string}`,
      nonce as `0x${string}`,
    ]);
    console.log('🔍 readBatchId encoded data:', encodedData);

    const calculatedBatchId = keccak256(encodedData);
    console.log('🔍 readBatchId calculated hash:', calculatedBatchId);

    const batchIdWithoutPrefix = calculatedBatchId.slice(2);
    console.log('🔍 readBatchId final result:', batchIdWithoutPrefix);

    return batchIdWithoutPrefix;
  } catch (error) {
    console.error('Error in readBatchId:', error);
    throw error;
  }
};

/**
 * Creates batch ID and sets it in state
 * @param nonce The batch nonce as hex string
 * @param sender The sender address
 * @param setPostageBatchId State setter function
 * @returns The calculated batch ID (without 0x prefix)
 */
export const createBatchId = async (
  nonce: string,
  sender: string,
  setPostageBatchId: (batchId: string) => void
): Promise<string> => {
  try {
    console.log('🔍 createBatchId called - using readBatchId internally');

    // Use the pure function to calculate the batch ID
    const batchId = readBatchId(nonce, sender);

    console.log('🔍 createBatchId setting state with:', batchId);
    setPostageBatchId(batchId);
    console.log('🔍 createBatchId state set successfully');

    return batchId;
  } catch (error) {
    console.error('Error creating batch ID:', error);
    throw error;
  }
};

export const performWithRetry = async <T>(
  operation: () => Promise<T>,
  name: string,
  validateResult?: (result: T) => boolean,
  maxRetries = 5,
  delayMs = 300,
  abortSignal?: AbortSignal
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      // Check if the operation was aborted before starting
      if (abortSignal?.aborted) {
        console.log(`${name} aborted before attempt ${attempt}`);
        throw new Error(`Operation ${name} was aborted`);
      }

      const result = await operation();

      if (validateResult && !validateResult(result)) {
        throw new Error(`Invalid result for ${name}`);
      }

      return result;
    } catch (error) {
      // Check if operation was aborted during execution
      if (abortSignal?.aborted) {
        console.log(`${name} aborted during attempt ${attempt}`);
        throw new Error(`Operation ${name} was aborted`);
      }

      console.log(`${name} attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      // Create a promise that resolves after delay or rejects if aborted
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, delayMs);

        // If we have an abort signal, listen for abort events
        if (abortSignal) {
          const abortHandler = () => {
            clearTimeout(timeout);
            reject(new Error(`Operation ${name} was aborted during delay`));
          };

          abortSignal.addEventListener('abort', abortHandler, { once: true });

          // Clean up event listener after timeout completes
          setTimeout(() => {
            abortSignal.removeEventListener('abort', abortHandler);
          }, delayMs + 10);
        }
      });
    }
  }
  throw new Error(`${name} failed after ${maxRetries} attempts`);
};

/**
 * Logs the token swap route from quote steps
 * @param steps Array of steps from LIFI quote
 * @param type String identifier for the quote type
 */
export const logTokenRoute = (steps: any[], type: string) => {
  console.info(`>> ${type} Token Route:`);

  // Log the tool information if available
  if (steps.length > 0 && steps[0].toolDetails) {
    console.info(
      `   Tool used: ${steps[0].toolDetails.name} (${steps[0].toolDetails.logoURI || 'N/A'})`
    );
  } else if (steps.length > 0 && steps[0].tool) {
    console.info(`   Tool used: ${steps[0].tool}`);
  }

  steps.forEach((step, index) => {
    // Check if this is a contract call step
    if (
      step.action.fromToken.symbol === 'BZZ' &&
      step.action.toToken.symbol === 'BZZ' &&
      step.action.toContractCallData?.length > 0
    ) {
      console.info(`   Step ${index + 1}: Contract Call (Chain ${step.action.fromChainId})`);
      if (step.toolDetails) {
        console.info(`     Tool: ${step.toolDetails.name} (${step.tool})`);
      } else if (step.tool) {
        console.info(`     Tool: ${step.tool}`);
      }
      return;
    }

    const fromToken = step.action.fromToken.name || step.action.fromToken.symbol;
    const toToken = step.action.toToken.name || step.action.toToken.symbol;
    const fromChain = step.action.fromChainId;
    const toChain = step.action.toChainId;

    console.info(
      `   Step ${index + 1}: ${fromToken} (Chain ${fromChain}) → ${toToken} (Chain ${toChain})`
    );

    // Log tool information for each step if available
    if (step.toolDetails) {
      console.info(`     Tool: ${step.toolDetails.name} (${step.tool})`);
    } else if (step.tool) {
      console.info(`     Tool: ${step.tool}`);
    }
  });
};

/**
 * Generates a new nonce and returns an updated SwarmConfig
 * @param swarmConfig The current SwarmConfig object
 * @param setSwarmConfig Optional state setter function to update the config
 * @returns The updated SwarmConfig with a new nonce
 */
export const generateAndUpdateNonce = (
  swarmConfig: any,
  setSwarmConfig?: (config: any) => void
): any => {
  console.log('Current nonce', swarmConfig.swarmBatchNonce);

  // Generate a properly sized nonce (exactly 32 bytes)
  const uniqueNonce = generateProperNonce();
  console.log('Generated new nonce:', uniqueNonce);

  // Create updated config with the new nonce
  const updatedConfig = {
    ...swarmConfig,
    swarmBatchNonce: uniqueNonce,
  };

  // Update state if setter function is provided
  if (setSwarmConfig) {
    setSwarmConfig(updatedConfig);
  }

  console.log('Will use swarm batch nonce:', updatedConfig.swarmBatchNonce);

  return updatedConfig;
};

/**
 * Generates a proper 32-byte nonce for Swarm
 * @returns 32-byte nonce as a 0x-prefixed hex string
 */
export const generateProperNonce = (): string => {
  return (
    '0x' +
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  );
};

/**
 * Handles exchange rate updates for Li.Fi SDK executeRoute calls
 * @param params Exchange rate update parameters from Li.Fi SDK
 * @param setStatusMessage Function to update status message
 * @param acceptExchangeRateUpdates Boolean flag to control acceptance
 * @returns Promise<boolean> indicating whether to accept the rate update
 */
export const handleExchangeRateUpdate = async (
  params: {
    toToken: any;
    oldToAmount: string;
    newToAmount: string;
  },
  setStatusMessage: (status: any) => void,
  acceptExchangeRateUpdates: boolean
): Promise<boolean> => {
  const { toToken, oldToAmount, newToAmount } = params;

  console.log('Exchange rate update detected:');
  console.log(`Token: ${toToken.symbol}`);
  console.log(`Old amount: ${oldToAmount}`);
  console.log(`New amount: ${newToAmount}`);

  // Calculate percentage change
  const oldAmount = parseFloat(oldToAmount);
  const newAmount = parseFloat(newToAmount);
  const percentageChange = ((newAmount - oldAmount) / oldAmount) * 100;

  console.log(`Exchange rate change: ${percentageChange.toFixed(2)}%`);

  // Update status message to inform user about the rate change
  setStatusMessage((prev: any) => ({
    ...prev,
    message: `${prev.message} (Rate updated: ${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(2)}%)`,
  }));

  return acceptExchangeRateUpdates;
};

/**
 * Creates and returns a public client for the Gnosis chain
 * @returns A public client configured for the Gnosis chain
 */
export const getGnosisPublicClient = (rpcIndex: number = 0) => {
  // Use global custom RPC URL if set, otherwise fall back to env variable
  const envRpcUrl = process.env.NEXT_PUBLIC_GNOSIS_RPC;

  // Public fallback RPC URLs in order of preference
  const fallbackRpcs = [
    'https://rpc.gnosischain.com',
    'https://gnosis-mainnet.public.blastapi.io',
    'https://gnosis.drpc.org',
  ];

  let rpcUrl;
  if (rpcIndex === 0) {
    // Primary attempt: use custom/env RPC or first fallback
    rpcUrl = globalCustomRpcUrl || envRpcUrl || fallbackRpcs[0];
  } else {
    // Fallback attempts: use specific fallback RPC
    rpcUrl = fallbackRpcs[rpcIndex] || fallbackRpcs[fallbackRpcs.length - 1];
  }

  // We are using public RPC for the Gnosis chain unless a custom RPC is set or env variable is set
  const client = createPublicClient({
    chain: gnosis,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });

  return { client, rpcUrl };
};

/**
 * Fetches the node wallet address from the Bee API
 * @param beeApiUrl The Bee API URL to fetch from
 * @param defaultAddress The default address to return if fetch fails
 * @returns Promise<string> The wallet address
 */
export const fetchNodeWalletAddress = async (
  beeApiUrl: string,
  defaultAddress: string
): Promise<string> => {
  try {
    const response = await fetch(`${beeApiUrl}/wallet`, {
      signal: AbortSignal.timeout(15000),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.walletAddress) {
        console.log('Node wallet address fetched:', data.walletAddress);
        return data.walletAddress;
      }
    }

    console.log('Using default node address:', defaultAddress);
    return defaultAddress;
  } catch (error) {
    console.error('Error fetching node wallet address:', error);
    return defaultAddress;
  }
};

/**
 * Fetches current price from Gnosis price oracle
 * @param publicClient Optional public client to use, if not provided uses getGnosisPublicClient
 * @param priceOracleAddress Optional oracle address, if not provided uses default
 * @param priceOracleAbi Optional oracle ABI, if not provided uses default
 * @returns Promise<bigint> The current price, or 65000n as fallback
 */
export const fetchCurrentPriceFromOracle = async (
  publicClient?: any,
  priceOracleAddress?: string,
  priceOracleAbi?: any
): Promise<bigint> => {
  try {
    // Use our custom RPC configuration first, not wagmi's publicClient
    const client = getGnosisPublicClient().client;

    // If no address/abi provided, we'll need them from the calling component
    // to avoid circular dependencies
    if (!priceOracleAddress || !priceOracleAbi) {
      throw new Error(
        'Price oracle address and ABI must be provided to avoid circular dependencies'
      );
    }

    const price = await client.readContract({
      address: priceOracleAddress as `0x${string}`,
      abi: priceOracleAbi,
      functionName: 'currentPrice',
      args: [],
    });

    console.log('Price fetched from oracle (utility):', price);
    return BigInt(price as string | number | bigint);
  } catch (error) {
    console.error('Error fetching current price from oracle:', error);
    console.log('Using utility fallback price: 65000');
    return BigInt(65000); // Fallback price
  }
};

/**
 * Fetches stamp information for a given batch ID
 * @param batchId The batch ID (with or without 0x prefix)
 * @param beeApiUrl The Bee API URL
 * @returns Promise<StampInfo | null> The stamp information or null if failed
 */
export const fetchStampInfo = async (batchId: string, beeApiUrl: string): Promise<any | null> => {
  try {
    // Make sure the batchId doesn't have 0x prefix for the API call
    const formattedBatchId = batchId.startsWith('0x') ? batchId.slice(2) : batchId;

    const response = await fetch(`${beeApiUrl}/stamps/${formattedBatchId}`, {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      console.error(`Error fetching stamp info: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error(`Error fetching stamp info for ${batchId}:`, error);
    return null;
  }
};

/**
 * Format TTL (Time To Live) in seconds to a human-readable string
 * Shows hours/minutes for < 1 day, otherwise shows days
 * Handles expired stamps (negative values) by showing "Expired X time ago"
 */
export const formatExpiryTime = (ttlSeconds: number): string => {
  // Handle expired stamps (negative TTL)
  if (ttlSeconds < 0) {
    const expiredSeconds = Math.abs(ttlSeconds);
    const days = Math.floor(expiredSeconds / 86400);
    const hours = Math.floor((expiredSeconds % 86400) / 3600);
    const minutes = Math.floor((expiredSeconds % 3600) / 60);

    if (days >= 1) {
      return `Expired ${days} day${days === 1 ? '' : 's'} ago`;
    } else if (hours >= 1) {
      return `Expired ${hours} hour${hours === 1 ? '' : 's'} ago`;
    } else if (minutes >= 1) {
      return `Expired ${minutes} minute${minutes === 1 ? '' : 's'} ago`;
    } else {
      return 'Expired less than 1 minute ago';
    }
  }

  // Handle active stamps
  const days = Math.floor(ttlSeconds / 86400);
  const hours = Math.floor((ttlSeconds % 86400) / 3600);
  const minutes = Math.floor((ttlSeconds % 3600) / 60);

  if (days >= 1) {
    return `${days} day${days === 1 ? '' : 's'}`;
  } else if (hours >= 1) {
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  } else if (minutes >= 1) {
    return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  } else {
    return 'Less than 1 minute';
  }
};

/**
 * Check if a stamp is expiring soon (≤ 1 day)
 */
export const isExpiringSoon = (ttlSeconds: number): boolean => {
  return ttlSeconds <= 86400; // 1 day in seconds
};

/**
 * Check if a stamp is in warning period (≤ 3 days but > 1 day)
 */
export const isExpiryWarning = (ttlSeconds: number): boolean => {
  return ttlSeconds <= 259200 && ttlSeconds > 86400; // 3 days but more than 1 day
};

/**
 * Format TTL in detailed human-readable format showing smart time units
 * Shows only the rightmost available units based on magnitude
 * Examples:
 *   - 1 year 2 months 3 weeks → shows years, months, weeks (not days, hours, minutes, seconds)
 *   - 3 months 1 week 3 days → shows months, weeks, days (not hours, minutes, seconds)
 *   - 3 hours 2 minutes 54 seconds → shows hours, minutes, seconds
 * @param ttlSeconds The TTL in seconds
 * @param maxLength Optional maximum character length - will truncate from the right if exceeded
 */
export const formatDetailedTTL = (ttlSeconds: number, maxLength?: number): string => {
  if (ttlSeconds <= 0) {
    return 'Expired';
  }

  // Calculate all time units
  const years = Math.floor(ttlSeconds / 31536000); // 365 days
  const months = Math.floor((ttlSeconds % 31536000) / 2592000); // 30 days
  const weeks = Math.floor((ttlSeconds % 2592000) / 604800); // 7 days
  const days = Math.floor((ttlSeconds % 604800) / 86400);
  const hours = Math.floor((ttlSeconds % 86400) / 3600);
  const minutes = Math.floor((ttlSeconds % 3600) / 60);
  const seconds = Math.floor(ttlSeconds % 60);

  // Determine which units to show based on the largest unit present
  const parts: string[] = [];

  // Determine the granularity level based on the largest time unit
  let showLevel = 0; // 0=seconds, 1=minutes, 2=hours, 3=days, 4=weeks, 5=months, 6=years

  if (years > 0) showLevel = 6;
  else if (months > 0) showLevel = 5;
  else if (weeks > 0) showLevel = 4;
  else if (days > 0) showLevel = 3;
  else if (hours > 0) showLevel = 2;
  else if (minutes > 0) showLevel = 1;
  else showLevel = 0;

  // Add parts based on show level (show 4 levels of granularity to include hours/minutes)
  if (showLevel >= 6 && years > 0) {
    parts.push(`${years} year${years === 1 ? '' : 's'}`);
  }
  if (showLevel >= 5 && showLevel <= 7 && months > 0) {
    parts.push(`${months} month${months === 1 ? '' : 's'}`);
  }
  if (showLevel >= 4 && showLevel <= 6 && weeks > 0) {
    parts.push(`${weeks} week${weeks === 1 ? '' : 's'}`);
  }
  if (showLevel >= 3 && showLevel <= 5 && days > 0) {
    parts.push(`${days} day${days === 1 ? '' : 's'}`);
  }
  if (showLevel >= 2 && showLevel <= 5 && hours > 0) {
    parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
  }
  if (showLevel >= 1 && showLevel <= 4 && minutes > 0) {
    parts.push(`${minutes} minute${minutes === 1 ? '' : 's'}`);
  }
  if (showLevel <= 3 && seconds > 0) {
    parts.push(`${seconds} second${seconds === 1 ? '' : 's'}`);
  }

  if (parts.length === 0) {
    return 'Less than 1 second';
  }

  // If maxLength is specified and we exceed it, truncate from the right
  if (maxLength) {
    const result = parts.join(' ');
    if (result.length > maxLength) {
      // Remove parts from the end until we fit
      while (parts.length > 1 && parts.join(' ').length > maxLength) {
        parts.pop();
      }
    }
  }

  return parts.join(' ');
};

/**
 * Query batch information from PostageStamp contract on Gnosis Chain
 * @param batchId The batch ID (with or without 0x prefix)
 * @returns Object containing TTL in seconds, remaining balance (total), and depth
 */
export const fetchBatchInfoFromContract = async (
  batchId: string
): Promise<{ ttlSeconds: number; remainingBalance: string; depth: number } | null> => {
  try {
    const { GNOSIS_STAMP_ADDRESS, POSTAGE_STAMP_ABI } = await import('./constants');

    // Ensure batchId has 0x prefix
    const formattedBatchId = batchId.startsWith('0x') ? batchId : `0x${batchId}`;

    const { client } = getGnosisPublicClient(0);

    // Query all necessary data from the contract
    const [lastPrice, remainingBalancePerChunk, depth] = await Promise.all([
      client.readContract({
        address: GNOSIS_STAMP_ADDRESS as `0x${string}`,
        abi: POSTAGE_STAMP_ABI,
        functionName: 'lastPrice',
      }),
      client.readContract({
        address: GNOSIS_STAMP_ADDRESS as `0x${string}`,
        abi: POSTAGE_STAMP_ABI,
        functionName: 'remainingBalance',
        args: [formattedBatchId as `0x${string}`],
      }),
      client.readContract({
        address: GNOSIS_STAMP_ADDRESS as `0x${string}`,
        abi: POSTAGE_STAMP_ABI,
        functionName: 'batchDepth',
        args: [formattedBatchId as `0x${string}`],
      }),
    ]);

    // Use the contract's remainingBalance function result directly
    // This returns the per-chunk balance (normalizedBalance - currentTotalOutPayment)
    const lastPriceBigInt = BigInt(lastPrice as bigint);
    const remainingBalancePerChunkBigInt = BigInt(remainingBalancePerChunk as bigint);
    const depthNumber = Number(depth);

    if (lastPriceBigInt === 0n) {
      console.error('lastPrice is 0, cannot calculate TTL');
      return null;
    }

    // Calculate TTL following Bee's implementation
    // ttl = (remainingBalance) * blockTime / pricePerBlock
    const remainingBlocks = remainingBalancePerChunkBigInt / lastPriceBigInt;

    // Convert to seconds (Gnosis Chain: ~5 second blocks)
    const ttlSeconds = Number(remainingBlocks) * 5;

    // Calculate total remaining balance by multiplying per-chunk balance by number of chunks (2^depth)
    // Formula from PostageStamp.sol: totalAmount = initialBalancePerChunk * (1 << depth)
    const totalRemainingBalance = remainingBalancePerChunkBigInt * (1n << BigInt(depthNumber));
    const remainingBalanceString = totalRemainingBalance.toString();

    const result = {
      ttlSeconds,
      remainingBalance: remainingBalanceString,
      depth: depthNumber,
    };

    console.log('✅ [PostageStamp Contract] Batch info fetched successfully:', {
      batchId: formattedBatchId,
      lastPrice: lastPriceBigInt.toString(),
      depth: depthNumber,
      remainingBalancePerChunk: remainingBalancePerChunkBigInt.toString(),
      totalRemainingBalance: remainingBalanceString,
      remainingBlocks: remainingBlocks.toString(),
      ttlSeconds,
      result,
    });

    return result;
  } catch (error) {
    console.error('❌ [PostageStamp Contract] Error fetching batch info from contract:', error);
    return null;
  }
};

/**
 * Fetch the owner/payer information for a specific batch from the registry by querying events
 * @param batchId The batch ID to look up
 * @returns Owner address and payer address, or null if not found
 */
export const fetchBatchOwnerInfo = async (
  batchId: string
): Promise<{ owner: string; payer: string } | null> => {
  try {
    const { GNOSIS_CUSTOM_REGISTRY_ADDRESS } = await import('./constants');
    const { REGISTRY_ABI } = await import('./constants');

    // Ensure batchId has 0x prefix
    const formattedBatchId = batchId.startsWith('0x') ? batchId : `0x${batchId}`;

    console.log('🔍 [Beeport Registry] Starting owner lookup for batch:', formattedBatchId);
    console.log('🔍 [Beeport Registry] Registry address:', GNOSIS_CUSTOM_REGISTRY_ADDRESS);

    const { client } = getGnosisPublicClient(0);

    const batchCreatedEvent = REGISTRY_ABI.find(item => item.type === 'event' && item.name === 'BatchCreated');
    console.log('🔍 [Beeport Registry] Event definition found:', batchCreatedEvent ? 'Yes' : 'No');

    // Query the BatchCreated event logs for this specific batchId
    console.log('🔍 [Beeport Registry] Querying events from block 0 to latest...');
    const logs = await client.getLogs({
      address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
      event: batchCreatedEvent!,
      args: {
        batchId: formattedBatchId as `0x${string}`,
      },
      fromBlock: BigInt(0), // Search from genesis - could optimize with a known start block
      toBlock: 'latest',
    });

    console.log(`🔍 [Beeport Registry] Found ${logs.length} BatchCreated event(s) for this batch`);

    if (logs.length === 0) {
      console.warn(`⚠️ [Beeport Registry] No BatchCreated event found for batchId: ${formattedBatchId}`);
      console.warn(`⚠️ [Beeport Registry] This stamp was not created through beeport registry`);
      console.log(`🔍 [PostageStamp Contract] Falling back to PostageStamp contract for owner info...`);

      // Fallback: Try to get owner from PostageStamp contract
      try {
        const { GNOSIS_STAMP_ADDRESS, POSTAGE_STAMP_ABI } = await import('./constants');

        const owner = await client.readContract({
          address: GNOSIS_STAMP_ADDRESS as `0x${string}`,
          abi: POSTAGE_STAMP_ABI,
          functionName: 'batchOwner',
          args: [formattedBatchId as `0x${string}`],
        }) as string;

        console.log(`✅ [PostageStamp Contract] Found batch owner from PostageStamp contract:`, {
          batchId: formattedBatchId,
          owner,
          payer: owner, // For direct stamps, owner and payer are the same
        });

        return {
          owner,
          payer: owner, // For stamps created directly, owner = payer
        };
      } catch (error) {
        console.error('❌ [PostageStamp Contract] Error fetching owner from PostageStamp contract:', error);
        return null;
      }
    }

    // Get the most recent event (in case there are multiple, though there shouldn't be)
    const latestLog = logs[logs.length - 1];
    console.log('🔍 [Beeport Registry] Latest event log:', latestLog);

    const owner = latestLog.args.owner as string;
    const payer = latestLog.args.payer as string;

    console.log(`✅ [Beeport Registry] Found batch owner info:`, {
      batchId: formattedBatchId,
      owner,
      payer,
      ownerIsPayer: owner?.toLowerCase() === payer?.toLowerCase(),
    });

    return {
      owner,
      payer,
    };
  } catch (error) {
    console.error('❌ [Beeport Registry] Error fetching batch owner info from events:', error);
    console.error('❌ [Beeport Registry] Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
    });
    return null;
  }
};

/**
 * Fetch the owner/payer information for a specific batch from the registry
 * @param batchId The batch ID to look up
 * @param ownerAddress The address to check if they own this batch
 * @returns Owner address and payer address, or null if not found in this owner's batches
 */
export const fetchBatchOwnerInfoForAddress = async (
  batchId: string,
  ownerAddress: string
): Promise<{ owner: string; payer: string } | null> => {
  try {
    // Use static imports from constants
    const { GNOSIS_CUSTOM_REGISTRY_ADDRESS } = await import('./constants');
    const { REGISTRY_ABI } = await import('./constants');

    // Ensure batchId has 0x prefix
    const formattedBatchId = batchId.startsWith('0x') ? batchId : `0x${batchId}`;

    const { client } = getGnosisPublicClient(0);

    // Query the registry for all batches owned by this address
    const batches = await client.readContract({
      address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
      abi: REGISTRY_ABI,
      functionName: 'getOwnerBatches',
      args: [ownerAddress as `0x${string}`],
    });

    // Find the batch with matching ID
    const batch = (batches as any[]).find(
      b => b.batchId.toLowerCase() === formattedBatchId.toLowerCase()
    );

    if (!batch) {
      return null;
    }

    return {
      owner: ownerAddress,
      payer: batch.payer,
    };
  } catch (error) {
    console.error('Error fetching batch owner info for address:', error);
    return null;
  }
};

/**
 * Calculate the real stamp usage percentage
 * @param utilization Raw utilization value from Bee API (decimal, e.g., 0.01 for 1%)
 * @param depth Stamp depth from Bee API
 * @param bucketDepth Bucket depth (constant 16)
 * @returns Real used capacity percentage (0-100)
 */
export function getStampUsage(
  utilization: number,
  depth: number,
  bucketDepth: number = 16
): number {
  return (utilization / Math.pow(2, depth - bucketDepth)) * 100;
}

/**
 * Format date in EU format (DD/MM/YYYY)
 * @param date Date object or timestamp
 * @returns Formatted date string in EU format
 */
export const formatDateEU = (date: Date | number): string => {
  const dateObj = typeof date === 'number' ? new Date(date) : date;
  return dateObj.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

/**
 * Format date for CSV export (Unix timestamp for reliable parsing)
 * @param date Date object or timestamp
 * @returns Unix timestamp as string
 */
export const formatDateForCSV = (date: Date | number): string => {
  const timestamp = typeof date === 'number' ? date : date.getTime();
  return timestamp.toString();
};

/**
 * Parse date from CSV import (handles Unix timestamps and legacy date formats)
 * @param dateString Date string to parse (Unix timestamp or date string)
 * @returns Timestamp in milliseconds or NaN if invalid
 */
export const parseDateFromCSV = (dateString: string): number => {
  // First try parsing as Unix timestamp
  const timestamp = parseInt(dateString);
  if (!isNaN(timestamp) && timestamp > 0) {
    // Check if it's a reasonable timestamp (after year 1970 and before year 3000)
    if (timestamp > 0 && timestamp < 32503680000000) {
      return timestamp;
    }
  }

  // Legacy support: try parsing as ISO format (YYYY-MM-DD)
  let parsedDate = new Date(dateString);
  if (!isNaN(parsedDate.getTime())) {
    return parsedDate.getTime();
  }

  // Legacy support: try parsing as EU format (DD/MM/YYYY)
  const euFormatMatch = dateString.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (euFormatMatch) {
    const [, day, month, year] = euFormatMatch;
    // Create date in ISO format for reliable parsing
    parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    if (!isNaN(parsedDate.getTime())) {
      return parsedDate.getTime();
    }
  }

  // If all else fails, try the browser's default parsing
  parsedDate = new Date(dateString);
  return parsedDate.getTime(); // Will be NaN if invalid
};

/**
 * Format hash for display (shows first 6 and last 6 characters)
 */
export const formatHash = (hash: string): string => {
  if (hash.length <= 12) return hash;
  return `${hash.slice(0, 6)}...${hash.slice(-6)}`;
};
