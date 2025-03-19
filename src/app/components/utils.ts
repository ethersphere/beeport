import {
  getAddress,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  encodeFunctionData,
  parseAbi,
} from "viem";

import {
  getContractCallsQuote,
  ContractCallsQuoteRequest,
  ChainId,
} from "@lifi/sdk";

import { GNOSIS_CUSTOM_REGISTRY_ADDRESS } from "./constants";

export interface ToAmountQuoteParams {
  fromChain: string | number;
  toChain: string | number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress?: string;
  toAmount: string | number;
}

export interface TokenInfo {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  name: string;
  coinKey?: string;
  logoURI?: string;
  priceUSD?: string;
}

export interface ToolDetails {
  key: string;
  name: string;
  logoURI: string;
}

export interface FeeCost {
  name: string;
  description: string;
  token: TokenInfo;
  amount: string;
  amountUSD: string;
  percentage?: string;
  included?: boolean;
}

export interface GasCost {
  type: string;
  price: string;
  estimate: string;
  limit: string;
  amount: string;
  amountUSD: string;
  token: TokenInfo;
}

export interface TransactionRequest {
  value: string;
  to: string;
  data: string;
  from: string;
  chainId: number;
  gasPrice: string;
  gasLimit: string;
}

export interface IncludedStep {
  id: string;
  type: string;
  action: {
    fromChainId: number;
    fromAmount: string;
    fromToken: TokenInfo;
    toChainId: number;
    toToken: TokenInfo;
    fromAddress: string;
    toAddress: string;
    destinationGasConsumption?: string;
  };
  estimate: {
    tool: string;
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    gasCosts: GasCost[];
    executionDuration: number;
    approvalAddress: string;
    feeCosts: FeeCost[];
  };
  tool: string;
  toolDetails: ToolDetails;
}

export interface ToAmountQuoteResponse {
  type: string;
  id: string;
  tool: string;
  toolDetails: ToolDetails;
  action: {
    fromToken: TokenInfo;
    fromAmount: string;
    toToken: TokenInfo;
    fromChainId: number;
    toChainId: number;
    slippage: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    tool: string;
    approvalAddress: string;
    toAmountMin: string;
    toAmount: string;
    fromAmount: string;
    feeCosts: FeeCost[];
    gasCosts: GasCost[];
    executionDuration: number;
    fromAmountUSD?: string;
    toAmountUSD?: string;
  };
  includedSteps: IncludedStep[];
  integrator: string;
  transactionRequest: TransactionRequest;
}

export const getToAmountQuote = async (
  params: ToAmountQuoteParams,
  apiKey?: string
): Promise<ToAmountQuoteResponse> => {
  return performWithRetry(
    async () => {
      const { fromChain, toChain, fromToken, toToken, fromAddress, toAmount } =
        params;
      const toAddress = params.toAddress || fromAddress;

      const url = `https://li.quest/v1/quote/toAmount?fromChain=${fromChain}&toChain=${toChain}&fromToken=${fromToken}&toToken=${toToken}&fromAddress=${fromAddress}&toAddress=${toAddress}&toAmount=${toAmount}`;

      const headers: HeadersInit = {
        accept: "application/json",
      };

      if (apiKey) {
        headers["x-lifi-api-key"] = apiKey;
      }

      const options = {
        method: "GET",
        headers,
      };

      console.log(`Fetching toAmount quote from: ${url}`);
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `HTTP error! Status: ${response.status}, Details: ${errorText}`
        );
      }

      const data = await response.json();
      return data;
    },
    "getToAmountQuote",
    (result) => {
      // Validate that we have a proper response with the required fields
      return (
        result &&
        result.estimate &&
        typeof result.estimate.fromAmount === "string"
      );
    },
    5, // 5 retries
    500 // 500ms delay between retries
  );
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

// Add this new interface for the contract calls parameters
export interface ContractCallQuoteParams extends ToAmountQuoteParams {
  nodeAddress: string;
  swarmConfig: any;
}

/**
 * Gets a quote for ToAmount with contract calls as a backup method
 * @param params Parameters for the quote
 * @param apiKey Optional API key
 * @returns Quote response
 */
export const getToAmountContractQuote = async (
  params: ContractCallQuoteParams,
  apiKey?: string
): Promise<any> => {
  return performWithRetry(
    async () => {
      const {
        fromChain,
        toChain,
        fromToken,
        toToken,
        fromAddress,
        toAmount,
        nodeAddress,
        swarmConfig,
      } = params;

      // Create postage stamp transaction data for simulation
      const postagStampTxData = encodeFunctionData({
        abi: parseAbi(swarmConfig.swarmContractAbi),
        functionName: "createBatchRegistry",
        args: [
          fromAddress,
          nodeAddress,
          swarmConfig.swarmBatchInitialBalance,
          swarmConfig.swarmBatchDepth,
          swarmConfig.swarmBatchBucketDepth,
          swarmConfig.swarmBatchNonce,
          swarmConfig.swarmBatchImmutable,
        ],
      });

      // Create quote request
      const contractCallsQuoteRequest: ContractCallsQuoteRequest = {
        fromChain: fromChain.toString(),
        fromToken: fromToken,
        fromAddress: fromAddress.toString(),
        toChain: toChain.toString(),
        toToken: toToken,
        toAmount: toAmount.toString(),
        contractCalls: [
          {
            fromAmount: toAmount.toString(),
            fromTokenAddress: toToken,
            toContractAddress: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
            toContractCallData: postagStampTxData,
            toContractGasLimit: swarmConfig.swarmContractGasLimit,
          },
        ],
        slippage: 0.5,
      };

      console.log(`Getting contract calls quote for toAmount`);
      console.log("ContractCallsQuoteRequest:", contractCallsQuoteRequest);

      // Get quote
      const initialQuoteResponse = await getContractCallsQuote(
        contractCallsQuoteRequest
      );

      console.info(">> Initial Contract Calls Quote", initialQuoteResponse);

      return initialQuoteResponse;
    },
    "getToAmountContractQuote",
    (result) => {
      // Validate that we have a proper response with the required fields
      return (
        result &&
        result.estimate &&
        typeof result.estimate.fromAmount === "string"
      );
    },
    5, // 5 retries
    500 // 500ms delay between retries
  );
};
