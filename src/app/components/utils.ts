import {
  getAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  createPublicClient,
  http,
} from "viem";
import { gnosis } from "viem/chains";

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
  delayMs = 300
): Promise<T> => {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await operation();

      if (validateResult && !validateResult(result)) {
        throw new Error(`Invalid result for ${name}`);
      }

      return result;
    } catch (error) {
      console.log(`${name} attempt ${attempt}/${maxRetries} failed:`, error);

      if (attempt === maxRetries) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
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
  const rpcUrl = process.env.NEXT_PUBLIC_GNOSIS_RPC;

  return createPublicClient({
    chain: gnosis,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });
};
