import {
  getContractCallsQuote,
  ContractCallsQuoteRequest,
  convertQuoteToRoute,
  ChainId,
  getQuote,
} from "@lifi/sdk";
import { parseAbi, encodeFunctionData } from "viem";
import { createPublicClient, http } from "viem";
import { gnosis } from "viem/chains";

import { GetGnosisQuoteParams, GetCrossChainQuoteParams } from "./types";
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS, LIFI_API_KEY } from "./constants";

import { logTokenRoute, performWithRetry } from "./utils";

// --- Moved Types from utils.ts ---

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

/**
 * Gets a quote for Gnosis chain transaction
 */
export const getGnosisQuote = async ({
  gnosisSourceToken,
  address,
  bzzAmount,
  nodeAddress,
  swarmConfig,
  setEstimatedTime,
}: GetGnosisQuoteParams & { setEstimatedTime: (time: number) => void }) => {
  // Create postage stamp transaction data
  const postagStampTxData = encodeFunctionData({
    abi: parseAbi(swarmConfig.swarmContractAbi),
    functionName: "createBatchRegistry",
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

  // Create quote request
  const gnosisContractCallsQuoteRequest: ContractCallsQuoteRequest = {
    fromChain: ChainId.DAI,
    fromToken: gnosisSourceToken,
    fromAddress: address,
    toChain: ChainId.DAI,
    toToken: swarmConfig.swarmToken,
    toAmount: bzzAmount,
    contractCalls: [
      {
        fromAmount: bzzAmount,
        fromTokenAddress: swarmConfig.swarmToken,
        toContractAddress: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
        toContractCallData: postagStampTxData,
        toContractGasLimit: swarmConfig.swarmContractGasLimit,
      },
    ],
  };

  // Get quote
  const gnosisContactCallsQuoteResponse = await getContractCallsQuote(
    gnosisContractCallsQuoteRequest
  );

  console.info(">> Gnosis Calls Quote", gnosisContactCallsQuoteResponse);
  logTokenRoute(
    gnosisContactCallsQuoteResponse.includedSteps,
    "Gnosis Calls Quote"
  );

  // Extract the estimated execution duration
  if (gnosisContactCallsQuoteResponse.estimate?.executionDuration) {
    setEstimatedTime(
      gnosisContactCallsQuoteResponse.estimate.executionDuration
    );
    console.log(
      "Gnosis Estimated Time:",
      gnosisContactCallsQuoteResponse.estimate.executionDuration
    );
  }

  return {
    gnosisContactCallsQuoteResponse,
    gnosisContractCallsRoute: convertQuoteToRoute(
      gnosisContactCallsQuoteResponse
    ),
  };
};

/**
 * Gets a quote for cross chain transactions
 */
export const getCrossChainQuote = async ({
  selectedChainId,
  fromToken,
  address,
  toAmount,
  gnosisDestinationToken,
  setEstimatedTime,
}: GetCrossChainQuoteParams & { setEstimatedTime: (time: number) => void }) => {
  // Use getToAmountQuote to get required fromAmount
  const toAmountQuoteParams: ToAmountQuoteParams = {
    fromChain: selectedChainId.toString(),
    toChain: ChainId.DAI.toString(),
    fromToken: fromToken,
    toToken: gnosisDestinationToken,
    fromAddress: address as string,
    toAmount: toAmount,
  };

  console.log("Fetching toAmount quote for cross-chain transaction...");

  // We can use both getToAmountQuote and getToAmountContractQuote
  // getToAmountContractQuote seems to be faster
  const toAmountQuoteResponse = await getToAmountContractQuote(
    toAmountQuoteParams
  );

  // const toAmountQuoteResponse = await getToAmountQuote(
  //   toAmountQuoteParams,
  //   LIFI_API_KEY
  // );

  console.info(
    ">> Initial Cross Chain Quote (toAmount)",
    toAmountQuoteResponse
  );

  // Extract the fromAmount from the response
  const requiredFromAmount = toAmountQuoteResponse.estimate.fromAmount;
  console.log("Required fromAmount:", requiredFromAmount);

  // Check if user has any balance on Gnosis for gas forwarding
  let fromAmountForGas: bigint = 0n;
  try {
    const gnosisProvider = createPublicClient({
      chain: gnosis,
      transport: http(),
    });

    const balance = await gnosisProvider.getBalance({
      address: address as `0x${string}`,
    });

    if (balance === 0n) {
      console.log("No balance on Gnosis, adding gas forwarding");

      const gasApiUrl = `https://li.quest/v1/gas/suggestion/100?fromChain=${selectedChainId}&fromToken=${fromToken}`;
      const gasResponse = await fetch(gasApiUrl);
      const gasData = await gasResponse.json();

      if (gasData.available && gasData.recommended) {
        // Double the recommended gas amount to ensure sufficient funds
        fromAmountForGas = BigInt(gasData.fromAmount) * 2n;
        console.log(
          `Adding gas forwarding: ${fromAmountForGas} (~ $${
            Number(gasData.recommended.amountUsd) * 2
          })`
        );
      }
    } else {
      console.log(
        "User already has balance on Gnosis, no gas forwarding needed"
      );
    }
  } catch (error) {
    console.error(
      "Error checking Gnosis balance or fetching gas suggestion:",
      error
    );
  }

  // Create the actual quote request with gas forwarding
  const quoteRequest = {
    fromChain: selectedChainId.toString(),
    fromToken: fromToken,
    fromAddress: address.toString(),
    fromAmount: (BigInt(requiredFromAmount) + fromAmountForGas).toString(),
    toChain: ChainId.DAI.toString(),
    toToken: gnosisDestinationToken,
    fromAmountForGas: fromAmountForGas,
    slippage: 0.5,
    order: "FASTEST",
  };

  // Can't comply because of https://github.com/lifinance/sdk/issues/239
  const crossChainContractQuoteResponse = await getQuote(quoteRequest);

  console.info(
    ">> Cross Chain Quote with Gas Forwarding",
    crossChainContractQuoteResponse
  );
  logTokenRoute(
    crossChainContractQuoteResponse.includedSteps,
    "Cross Chain Quote with Gas Forwarding"
  );

  // Extract the estimated execution duration
  if (crossChainContractQuoteResponse.estimate?.executionDuration) {
    setEstimatedTime(
      crossChainContractQuoteResponse.estimate.executionDuration
    );
  }
  console.log(
    "Estimated Bridge Time:",
    crossChainContractQuoteResponse.estimate?.executionDuration
  );

  return {
    crossChainContractQuoteResponse,
    crossChainContractCallsRoute: convertQuoteToRoute(
      crossChainContractQuoteResponse
    ),
  };
};

/**
 * Gets a quote for a fixed output amount using the REST API
 */
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

/**
 * Gets a quote for ToAmount with contract calls as a backup method
 */
export const getToAmountContractQuote = async (
  params: ToAmountQuoteParams
): Promise<any> => {
  return performWithRetry(
    async () => {
      const { fromChain, toChain, fromToken, toToken, fromAddress, toAmount } =
        params;

      // Create quote request
      const contractCallsQuoteRequest: ContractCallsQuoteRequest = {
        fromChain: fromChain.toString(),
        fromToken: fromToken,
        fromAddress: fromAddress.toString(),
        toChain: toChain.toString(),
        toToken: toToken,
        toAmount: toAmount.toString(),
        contractCalls: [],
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
