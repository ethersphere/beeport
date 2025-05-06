import {
  getAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  createPublicClient,
  http,
} from "viem";
import { gnosis } from "viem/chains";

// Global state for custom RPC URL
let globalCustomRpcUrl: string | undefined = undefined;

/**
 * Sets the global custom RPC URL
 * @param url The custom RPC URL to set, or undefined to use default
 */
export const setGnosisRpcUrl = (url: string | undefined) => {
  globalCustomRpcUrl = url;
  console.log("Set global RPC URL:", url || "default");
};

export const toChecksumAddress = (
  address: string | undefined | null
): string | null => {
  if (!address) return null;
  try {
    return getAddress(address);
  } catch (error) {
    console.log("Invalid address:", address, error);
    return null;
  }
};

export const formatErrorMessage = (error: unknown): string => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  const requestArgsIndex = errorMessage.indexOf("Request Arguments:");
  return requestArgsIndex > -1
    ? errorMessage.slice(0, requestArgsIndex).trim()
    : errorMessage;
};

export const createBatchId = async (
  nonce: string,
  sender: string,
  setPostageBatchId: (batchId: string) => void
): Promise<string> => {
  try {
    const encodedData = encodeAbiParameters(
      parseAbiParameters(["address", "bytes32"]),
      [sender as `0x${string}`, nonce as `0x${string}`]
    );

    const calculatedBatchId = keccak256(encodedData);
    setPostageBatchId(calculatedBatchId.slice(2));
    return calculatedBatchId.slice(2);
  } catch (error) {
    console.error("Error creating batch ID:", error);
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
  steps.forEach((step, index) => {
    // Check if this is a contract call step
    if (
      step.action.fromToken.symbol === "BZZ" &&
      step.action.toToken.symbol === "BZZ" &&
      step.action.toContractCallData?.length > 0
    ) {
      console.info(
        `   Step ${index + 1}: Contract Call (Chain ${step.action.fromChainId})`
      );
      return;
    }

    const fromToken =
      step.action.fromToken.name || step.action.fromToken.symbol;
    const toToken = step.action.toToken.name || step.action.toToken.symbol;
    const fromChain = step.action.fromChainId;
    const toChain = step.action.toChainId;

    console.info(
      `   Step ${
        index + 1
      }: ${fromToken} (Chain ${fromChain}) → ${toToken} (Chain ${toChain})`
    );
  });
};

/**
 * Generates a properly formatted 32-byte nonce with embedded timestamp for uniqueness
 * @returns A hex string prefixed with 0x representing a 32-byte nonce
 */
export const generateProperNonce = (): `0x${string}` => {
  // Create a new Uint8Array of 32 bytes
  const randomBytes = new Uint8Array(32);

  // Fill with random values
  crypto.getRandomValues(randomBytes);

  // To ensure uniqueness with timestamp, replace last 8 bytes with timestamp
  // Current timestamp in milliseconds as 8 bytes (64 bits)
  const timestamp = Date.now();
  const timestampBuffer = new ArrayBuffer(8);
  const timestampView = new DataView(timestampBuffer);
  timestampView.setBigUint64(0, BigInt(timestamp), false); // false = big-endian

  // Replace last 8 bytes of randomBytes with timestamp bytes
  const timestampArray = new Uint8Array(timestampBuffer);
  randomBytes.set(timestampArray, 24); // 24 = 32 - 8, to replace last 8 bytes

  // Convert to hex string with 0x prefix
  return ("0x" +
    Array.from(randomBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")) as `0x${string}`;
};

/**
 * Creates and returns a public client for the Gnosis chain
 * @returns A public client configured for the Gnosis chain
 */
export const getGnosisPublicClient = () => {
  // Use global custom RPC URL if set, otherwise fall back to env variable
  // const rpcUrl = globalCustomRpcUrl || process.env.NEXT_PUBLIC_GNOSIS_RPC;
  const rpcUrl = globalCustomRpcUrl;

  // We are using public RPC for the Gnosis chain unless a custom RPC is set or env variable is set
  return createPublicClient({
    chain: gnosis,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });
};
