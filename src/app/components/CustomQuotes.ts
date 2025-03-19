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

import { logTokenRoute, getToAmountQuote, ToAmountQuoteParams } from "./utils";

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
  const toAmountQuoteResponse = await getToAmountQuote(
    toAmountQuoteParams,
    LIFI_API_KEY
  );
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
