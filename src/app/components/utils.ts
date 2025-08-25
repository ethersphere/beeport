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
export const getGnosisPublicClient = () => {
  // Use global custom RPC URL if set, otherwise fall back to env variable
  // const rpcUrl = globalCustomRpcUrl || process.env.NEXT_PUBLIC_GNOSIS_RPC;

  const rpcUrl = globalCustomRpcUrl || 'https://go.getblock.io/228e95bbea11427d8feb1038bcc04a98';

  // We are using public RPC for the Gnosis chain unless a custom RPC is set or env variable is set
  return createPublicClient({
    chain: gnosis,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });
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
 * @returns Promise<bigint> The current price, or 28000n as fallback
 */
export const fetchCurrentPriceFromOracle = async (
  publicClient?: any,
  priceOracleAddress?: string,
  priceOracleAbi?: any
): Promise<bigint> => {
  try {
    // Use getGnosisPublicClient directly to ensure we have the right client
    const client = publicClient || getGnosisPublicClient();
    
    // If no address/abi provided, we'll need them from the calling component
    // to avoid circular dependencies
    if (!priceOracleAddress || !priceOracleAbi) {
      throw new Error('Price oracle address and ABI must be provided to avoid circular dependencies');
    }
    
    const price = await client.readContract({
      address: priceOracleAddress as `0x${string}`,
      abi: priceOracleAbi,
      functionName: 'currentPrice',
    });
    
    console.log('Price fetched from oracle:', price);
    return BigInt(price);
  } catch (error) {
    console.error('Error fetching current price from oracle:', error);
    return BigInt(28000); // Fallback price
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
