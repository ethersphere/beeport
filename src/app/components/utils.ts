import {
  getAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { formatUnits } from "viem";

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

export const formatTokenBalance = (
  amount: bigint | undefined,
  decimals: number,
  priceUSD: string | number
): { formatted: string; usdValue: string } => {
  if (!amount) {
    return { formatted: "0", usdValue: "0" };
  }

  const formatted = Number(formatUnits(amount, decimals)).toFixed(4);
  const usdValue = (Number(formatted) * Number(priceUSD)).toFixed(2);

  return { formatted, usdValue };
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
