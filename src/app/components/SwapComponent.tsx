"use client";

import React, { useState, useEffect } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { watchChainId } from "@wagmi/core";
import { config } from "@/app/wagmi";
import {
  createConfig,
  EVM,
  getContractCallsQuote,
  ContractCallsQuoteRequest,
  convertQuoteToRoute,
  executeRoute,
  ChainId,
  ChainType,
  getTokens,
  getChains,
  TokensResponse,
  getTokenBalancesByChain,
  Chain,
} from "@lifi/sdk";
import styles from "./css/SwapComponent.module.css";
import { parseAbi, encodeFunctionData, formatUnits } from "viem";
import {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  getAddress,
  createPublicClient,
  http,
} from "viem";

import { gnosis } from "viem/chains";
import {
  ExecutionStatus,
  UploadStep,
  GetGnosisQuoteParams,
  GetCrossChainQuoteParams,
} from "./types";
import {
  GNOSIS_PRICE_ORACLE_ADDRESS,
  GNOSIS_PRICE_ORACLE_ABI,
  DEFAULT_NODE_ADDRESS,
  GNOSIS_BZZ_ADDRESS,
  DEFAULT_SWARM_CONFIG,
  STORAGE_OPTIONS,
  BEE_GATEWAY_URL,
  GNOSIS_DESTINATION_TOKEN,
  DAY_OPTIONS,
  BATCH_REGISTRY_ADDRESS,
  DEFAULT_BEE_API_URL,
  MIN_TOKEN_BALANCE_USD,
} from "./constants";

import HelpSection from "./HelpSection";
import StampListSection from "./StampListSection";
import UploadHistorySection from "./UploadHistorySection";
import SearchableChainDropdown from "./SearchableChainDropdown";
import SearchableTokenDropdown from "./SearchableTokenDropdown";

import {
  formatErrorMessage,
  createBatchId,
  performWithRetry,
  formatTokenBalance,
  toChecksumAddress,
  logTokenRoute,
} from "./utils";

const SwapComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [selectedChainId, setSelectedChainId] = useState(ChainId.DAI);
  const [fromToken, setFromToken] = useState(
    "0x0000000000000000000000000000000000000000"
  );
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [lifiConfigInitialized, setLifiConfigInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddress, setShowAddress] = useState(false);
  const [isClientConnected, setIsClientConnected] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<bigint | null>(null);
  const [selectedDays, setSelectedDays] = useState(1);
  const [selectedDepth, setSelectedDepth] = useState(20);
  const [nodeAddress, setNodeAddress] = useState<string>(DEFAULT_NODE_ADDRESS);
  const [isWebpageUpload, setIsWebpageUpload] = useState(false);
  const [isTarFile, setIsTarFile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [totalUsdAmount, setTotalUsdAmount] = useState<string | null>(null);
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [isChainsLoading, setIsChainsLoading] = useState(true);
  const [liquidityError, setLiquidityError] = useState<boolean>(false);
  const [isPriceEstimating, setIsPriceEstimating] = useState(false);

  const [statusMessage, setStatusMessage] = useState<ExecutionStatus>({
    step: "",
    message: "",
  });
  const [showOverlay, setShowOverlay] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>("idle");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showStampList, setShowStampList] = useState(false);

  const [selectedTokenInfo, setSelectedTokenInfo] = useState<any>(null);
  const [availableTokens, setAvailableTokens] = useState<TokensResponse | null>(
    null
  );
  const [isTokensLoading, setIsTokensLoading] = useState(true);
  const [isWalletLoading, setIsWalletLoading] = useState(true);

  const [tokenBalances, setTokenBalances] = useState<any>(null);
  const [postageBatchId, setPostageBatchId] = useState<string>("");
  const [beeApiUrl, setBeeApiUrl] = useState<string>(DEFAULT_BEE_API_URL);
  const [contractUsed, setContractUsed] = useState<string>(
    BATCH_REGISTRY_ADDRESS
  );

  const [swarmConfig, setSwarmConfig] = useState(DEFAULT_SWARM_CONFIG);

  const [isCustomNode, setIsCustomNode] = useState(false);

  const [showUploadHistory, setShowUploadHistory] = useState(false);

  const gnosisPublicClient = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  useEffect(() => {
    const init = async () => {
      setIsWalletLoading(true);
      if (isConnected && address) {
        await fetchTokensAndBalances();
      }
      setIsWalletLoading(false);
    };

    init();
  }, [isConnected, address, selectedChainId]);

  useEffect(() => {
    setShowAddress(true);
    setIsClientConnected(isConnected);
  }, [isConnected]);

  useEffect(() => {
    if (chainId) {
      setSelectedChainId(chainId);
    }
  }, [chainId]);

  useEffect(() => {
    const fetchAndSetNode = async () => {
      await fetchNodeWalletAddress();
    };
    fetchAndSetNode();
  }, [beeApiUrl]);

  useEffect(() => {
    if (isConnected && publicClient && walletClient) {
      // Reinitialize LiFi whenever the wallet changes
      initializeLiFi();
    } else {
      // Reset the initialization flag when disconnected
      setLifiConfigInitialized(false);
    }
  }, [isConnected, publicClient, walletClient, address]);

  useEffect(() => {
    // Execute first two functions immediately
    fetchCurrentPrice();
    fetchNodeWalletAddress();
  }, []);

  useEffect(() => {
    // Execute first two functions immediately
    fetchCurrentPrice();
    fetchNodeWalletAddress();
  }, [isConnected, address]);

  useEffect(() => {
    const fetchChains = async () => {
      try {
        setIsChainsLoading(true);
        const chains = await getChains({ chainTypes: [ChainType.EVM] });
        setAvailableChains(chains);
      } catch (error) {
        console.error("Error fetching chains:", error);
      } finally {
        setIsChainsLoading(false);
      }
    };

    fetchChains();
  }, []);

  useEffect(() => {
    if (currentPrice !== null) {
      updateSwarmBatchInitialBalance();
    }
  }, [currentPrice, selectedDays, selectedDepth]);

  // Get PRICE estimation for currently choosen options
  useEffect(() => {
    if (!isConnected || !address || !fromToken) return;
    setTotalUsdAmount("0");
    setLiquidityError(false);
    setIsPriceEstimating(true); // Set to true when starting

    const updatePriceEstimate = async () => {
      try {
        const newNonce =
          "0x" +
          Array.from(crypto.getRandomValues(new Uint8Array(32)))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");

        const bzzAmount = calculateTotalAmount().toString();
        const gnosisSourceToken =
          selectedChainId === ChainId.DAI
            ? fromToken
            : GNOSIS_DESTINATION_TOKEN;

        const { gnosisContactCallsQuoteResponse } = await performWithRetry(
          () =>
            getGnosisQuote({
              gnosisSourceToken,
              address,
              bzzAmount,
              nodeAddress,
              swarmConfig: {
                ...swarmConfig,
                swarmBatchNonce: newNonce,
              },
            }),
          "getGnosisQuote"
        );

        let totalAmount = Number(
          gnosisContactCallsQuoteResponse.estimate.fromAmountUSD || 0
        );

        if (selectedChainId !== ChainId.DAI) {
          const { crossChainContractQuoteResponse } = await performWithRetry(
            () =>
              getCrossChainQuote({
                selectedChainId,
                fromToken,
                address,
                toAmount: gnosisContactCallsQuoteResponse.estimate.fromAmount,
                gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
              }),
            "getCrossChainQuote"
          );

          const bridgeFees = crossChainContractQuoteResponse.estimate.feeCosts
            ? crossChainContractQuoteResponse.estimate.feeCosts.reduce(
                (total, fee) => total + Number(fee.amountUSD || 0),
                0
              )
            : 0;
          totalAmount += bridgeFees;
        }

        setTotalUsdAmount(totalAmount.toString());
      } catch (error) {
        console.error("Error getting price estimate after all retries:", error);
        setTotalUsdAmount(null);
        setLiquidityError(true);
      } finally {
        setIsPriceEstimating(false); // Set to false when done
      }
    };

    if (isConnected && selectedChainId && fromToken) {
      updatePriceEstimate();
    }
  }, [
    isConnected,
    address,
    fromToken,
    selectedChainId,
    swarmConfig.swarmBatchInitialBalance,
    selectedDepth,
    nodeAddress,
  ]);

  // Initialize LiFi function
  const initializeLiFi = () => {
    // Create new config instead of modifying existing one
    createConfig({
      integrator: "Swarm",
      providers: [
        EVM({
          getWalletClient: async () => {
            const client = await walletClient;
            if (!client) throw new Error("Wallet client not available");
            return client;
          },
          switchChain: async (chainId) => {
            if (switchChain) {
              await switchChain({ chainId });
            }
            const client = await walletClient;
            if (!client) throw new Error("Wallet client not available");
            return client;
          },
        }),
      ],
    });
    setLifiConfigInitialized(true);
  };

  const fetchNodeWalletAddress = async () => {
    try {
      const response = await fetch(`${beeApiUrl}/wallet`, {
        signal: AbortSignal.timeout(15000),
      });
      setNodeAddress(DEFAULT_NODE_ADDRESS);
      if (response.ok) {
        const data = await response.json();
        if (data.walletAddress) {
          setNodeAddress(data.walletAddress);
          console.log("Node wallet address set:", data.walletAddress);
        }
      }
    } catch (error) {
      console.error("Error fetching node wallet address:", error);
    }
  };

  const fetchTokensAndBalances = async () => {
    if (!address || !isConnected) {
      setTokenBalances(null);
      setAvailableTokens(null);
      setFromToken("");
      setSelectedTokenInfo(null);
      return;
    }

    setIsTokensLoading(true);
    try {
      // First fetch all available tokens with retry
      const tokens = await performWithRetry(
        () =>
          getTokens({
            chains: [selectedChainId],
            chainTypes: [ChainType.EVM],
          }),
        "getTokens",
        (result) => Boolean(result?.tokens?.[selectedChainId]?.length)
      );
      console.log("Available tokens:", tokens);
      setAvailableTokens(tokens);

      // Then get balances for these tokens with retry
      const tokensByChain = {
        [selectedChainId]: tokens.tokens[selectedChainId],
      };

      const balances = await performWithRetry(
        () => getTokenBalancesByChain(address, tokensByChain),
        "getTokenBalances",
        (result) => {
          // Validate that we have a non-empty balance result for the selected chain
          const chainBalances = result?.[selectedChainId];
          return Boolean(chainBalances && chainBalances.length > 0);
        }
      );
      console.log("Token balances:", balances);
      setTokenBalances(balances);

      // Find tokens with balance
      if (balances?.[selectedChainId]) {
        const tokensWithBalance = balances[selectedChainId]
          .filter((t) => (t?.amount ?? 0n) > 0n)
          .sort((a, b) => {
            const aUsdValue =
              Number(formatUnits(a.amount || 0n, a.decimals)) *
              Number(a.priceUSD);
            const bUsdValue =
              Number(formatUnits(b.amount || 0n, b.decimals)) *
              Number(b.priceUSD);
            return bUsdValue - aUsdValue;
          });

        console.log("Tokens with balance:", tokensWithBalance);

        // Set initial token if we have any with balance
        if (tokensWithBalance.length > 0) {
          const checksumAddress = toChecksumAddress(
            tokensWithBalance[0].address
          );
          if (checksumAddress) {
            setFromToken(checksumAddress);
            setSelectedTokenInfo(tokensWithBalance[0]);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching tokens and balances:", error);
    } finally {
      setIsTokensLoading(false);
    }
  };

  const fetchCurrentPrice = async () => {
    if (publicClient) {
      try {
        const price = await gnosisPublicClient.readContract({
          address: GNOSIS_PRICE_ORACLE_ADDRESS as `0x${string}`,
          abi: GNOSIS_PRICE_ORACLE_ABI,
          functionName: "currentPrice",
        });
        console.log("price", price);
        setCurrentPrice(BigInt(price));
      } catch (error) {
        console.error("Error fetching current price:", error);
        setCurrentPrice(BigInt(28000));
      }
    } else {
      setCurrentPrice(BigInt(28000));
    }
  };

  const calculateTotalAmount = () => {
    return (
      BigInt(swarmConfig.swarmBatchInitialBalance) * BigInt(2 ** selectedDepth)
    );
  };

  const updateSwarmBatchInitialBalance = () => {
    if (currentPrice !== null) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration =
        BigInt(initialPaymentPerChunkPerDay) * BigInt(selectedDays);
      setSwarmConfig((prev) => ({
        ...prev,
        swarmBatchInitialBalance: totalPricePerDuration.toString(),
      }));
    }
  };

  const handleDepthChange = (newDepth: number) => {
    setSelectedDepth(newDepth);
    setSwarmConfig((prev) => ({
      ...prev,
      swarmBatchDepth: newDepth.toString(),
    }));
  };

  const handleDirectBzzTransactions = async () => {
    if (!publicClient || !walletClient) {
      console.error("Clients not initialized");
      setStatusMessage({
        step: "Error",
        message: "Wallet not connected",
        isError: true,
      });
      return;
    }

    try {
      const bzzAmount = calculateTotalAmount().toString();
      console.log("BZZ amount for approval:", bzzAmount);

      setStatusMessage({
        step: "Approval",
        message: "Approving BZZ transfer...",
      });

      // First transaction: Approve
      const { request: approveRequest } = await publicClient.simulateContract({
        address: GNOSIS_BZZ_ADDRESS,
        abi: parseAbi([
          "function approve(address spender, uint256 amount) external returns (bool)",
        ]),
        functionName: "approve",
        args: [contractUsed as `0x${string}`, BigInt(bzzAmount)],
        account: address,
      });

      const approveTxHash = await walletClient.writeContract(approveRequest);
      console.log("Approve transaction hash:", approveTxHash);

      setStatusMessage({
        step: "Approval",
        message: "Waiting for approval confirmation...",
      });

      // Wait for approval transaction to be mined
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
      });

      if (approveReceipt.status === "success") {
        setStatusMessage({
          step: "Batch",
          message: "Creating batch...",
        });

        // Second transaction: Create Batch
        const { request: createBatchRequest } =
          await publicClient.simulateContract({
            address: contractUsed as `0x${string}`,
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
            account: address,
          });

        const createBatchTxHash = await walletClient.writeContract(
          createBatchRequest
        );
        console.log("Create batch transaction hash:", createBatchTxHash);

        setStatusMessage({
          step: "Batch",
          message: "Waiting for batch creation confirmation...",
        });

        // Wait for create batch transaction to be mined
        const createBatchReceipt = await publicClient.waitForTransactionReceipt(
          {
            hash: createBatchTxHash,
          }
        );

        if (createBatchReceipt.status === "success") {
          try {
            // Batch will be created from registry contract for all cases
            const batchId = await createBatchId(
              swarmConfig.swarmBatchNonce,
              BATCH_REGISTRY_ADDRESS,
              setPostageBatchId
            );
            console.log("Created batch ID:", batchId);

            setStatusMessage({
              step: "Complete",
              message: "Storage Bought Successfully",
              isSuccess: true,
            });
            setUploadStep("ready");
          } catch (error) {
            console.error("Failed to create batch ID:", error);
            throw new Error("Failed to create batch ID");
          }
        } else {
          throw new Error("Batch creation failed");
        }
      } else {
        throw new Error("Approval failed");
      }
    } catch (error) {
      console.error("Error in direct BZZ transactions:", error);
      setStatusMessage({
        step: "Error",
        message: "Transactionfailed",
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
        isError: true,
      });
    }
  };

  const handleGnosisTokenSwap = async (contractCallsRoute: any) => {
    setStatusMessage({
      step: "Executing",
      message: "Executing contract calls...",
    });

    const executedRoute = await executeRoute(contractCallsRoute, {
      updateRouteHook: async (updatedRoute) => {
        console.log("Updated Route:", updatedRoute);
        const status = updatedRoute.steps[0]?.execution?.status;
        console.log(`Status: ${status}`);

        setStatusMessage({
          step: "Contract",
          message: `Status update: ${status?.replace(/_/g, " ")}`,
        });

        if (status === "DONE") {
          const txHash = updatedRoute.steps[0]?.execution?.process[0]?.txHash;
          console.log("Created new Batch at trx", txHash);

          try {
            // Batch will be created from registry contract for all cases
            const batchId = await createBatchId(
              swarmConfig.swarmBatchNonce,
              BATCH_REGISTRY_ADDRESS,
              setPostageBatchId
            );
            console.log("Created batch ID:", batchId);
          } catch (error) {
            console.error("Failed to create batch ID:", error);
          }

          setStatusMessage({
            step: "Complete",
            message: "Storage Bought Successfully",
            isSuccess: true,
          });
          setUploadStep("ready");
        }
      },
    });
    console.log("Contract calls execution completed:", executedRoute);
  };

  const handleCrossChainSwap = async (
    gnosisContractCallsRoute: any,
    toAmount: any
  ) => {
    setStatusMessage({
      step: "Quote",
      message: "Getting quote...",
    });

    const crossChainContractQuoteRequest: ContractCallsQuoteRequest = {
      fromChain: selectedChainId.toString(),
      fromToken: fromToken,
      fromAddress: address.toString(),
      toChain: ChainId.DAI.toString(),
      toToken: GNOSIS_DESTINATION_TOKEN,
      toAmount: toAmount,
      contractCalls: [],
      slippage: 0.5, //  0.005 represents 0.5%
    };

    const crossChainContractQuoteResponse = await getContractCallsQuote(
      crossChainContractQuoteRequest
    );

    console.info(">> Cross Chain Quote", crossChainContractQuoteResponse);
    logTokenRoute(
      crossChainContractQuoteResponse.includedSteps,
      "Cross Chain Quote"
    );

    return {
      crossChainContractQuoteResponse,
      crossChainContractCallsRoute: convertQuoteToRoute(
        crossChainContractQuoteResponse
      ),
    };
  };

  const handleChainSwitch = async (contractCallsRoute: any) => {
    console.log("First route completed, triggering chain switch to Gnosis...");
    setStatusMessage({
      step: "Switch",
      message: "First route completed. Switching chain to Gnosis...",
    });

    const unwatch = watchChainId(config, {
      onChange: async (chainId) => {
        if (chainId === ChainId.DAI) {
          console.log("Detected switch to Gnosis, executing second route...");
          unwatch();
          await handleGnosisRoute(contractCallsRoute);
        }
      },
    });

    switchChain({ chainId: ChainId.DAI });
  };

  const handleGnosisRoute = async (contractCallsRoute: any) => {
    setStatusMessage({
      step: "Route",
      message: "Chain switched. Executing second route...",
    });

    try {
      const executedRoute2 = await executeRoute(contractCallsRoute, {
        updateRouteHook: async (contractCallsRoute) => {
          console.log("Updated Route 2:", contractCallsRoute);
          const step2Status = contractCallsRoute.steps[0]?.execution?.status;
          console.log(`Step 2 Status: ${step2Status}`);

          setStatusMessage({
            step: "Route",
            message: `Second route status: ${step2Status}`,
          });

          if (step2Status === "DONE") {
            const txHash =
              contractCallsRoute.steps[0]?.execution?.process[1]?.txHash;
            console.log("Created new Batch", txHash);

            try {
              // Batch will be created from registry contract for all cases
              const batchId = await createBatchId(
                swarmConfig.swarmBatchNonce,
                BATCH_REGISTRY_ADDRESS,
                setPostageBatchId
              );
              console.log("Created batch ID:", batchId);
            } catch (error) {
              console.error("Failed to create batch ID:", error);
            }

            setStatusMessage({
              step: "Complete",
              message: "Storage Bought Successfully",
              isSuccess: true,
            });
            setUploadStep("ready");
          }
        },
      });
      console.log("Second route execution completed:", executedRoute2);
    } catch (error) {
      console.error("Error executing second route:", error);
      setStatusMessage({
        step: "Error",
        message: "Error executing second route",
        error: "Second route execution failed. Check console for details.",
        isError: true,
      });
    }
  };

  const getGnosisQuote = async ({
    gnosisSourceToken,
    address,
    bzzAmount,
    nodeAddress,
    swarmConfig,
  }: GetGnosisQuoteParams) => {
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
          toContractAddress: contractUsed,
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

    return {
      gnosisContactCallsQuoteResponse,
      gnosisContractCallsRoute: convertQuoteToRoute(
        gnosisContactCallsQuoteResponse
      ),
    };
  };

  const getCrossChainQuote = async ({
    selectedChainId,
    fromToken,
    address,
    toAmount,
    gnosisDestinationToken,
  }: GetCrossChainQuoteParams) => {
    const crossChainContractQuoteRequest: ContractCallsQuoteRequest = {
      fromChain: selectedChainId.toString(),
      fromToken: fromToken,
      fromAddress: address.toString(),
      toChain: ChainId.DAI.toString(),
      toToken: gnosisDestinationToken,
      toAmount: toAmount,
      contractCalls: [],
      slippage: 0.5, //  0.005 represents 0.5%
    };

    const crossChainContractQuoteResponse = await getContractCallsQuote(
      crossChainContractQuoteRequest
    );

    console.info(">> Cross Chain Quote", crossChainContractQuoteResponse);
    logTokenRoute(
      crossChainContractQuoteResponse.includedSteps,
      "Cross Chain Quote"
    );

    return {
      crossChainContractQuoteResponse,
      crossChainContractCallsRoute: convertQuoteToRoute(
        crossChainContractQuoteResponse
      ),
    };
  };

  const handleSwap = async () => {
    if (!isConnected || !address || !publicClient || !walletClient) {
      console.error("Wallet not connected or clients not available");
      return;
    }

    // Set new nonce first
    setSwarmConfig((prev) => ({
      ...prev,
      swarmBatchNonce:
        "0x" +
        Array.from(crypto.getRandomValues(new Uint8Array(32)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(""),
    }));

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep("idle");
    setStatusMessage({
      step: "Initialization",
      message: "Preparing transaction...",
    });

    try {
      // Find the token in available tokens
      const selectedToken = availableTokens?.tokens[selectedChainId]?.find(
        (token) => {
          try {
            return (
              toChecksumAddress(token.address) === toChecksumAddress(fromToken)
            );
          } catch (error) {
            console.error("Error comparing token addresses:", error);
            return false;
          }
        }
      );

      if (!selectedToken || !selectedToken.address) {
        throw new Error("Selected token not found");
      }

      setStatusMessage({
        step: "Calculation",
        message: "Calculating amounts...",
      });

      const bzzAmount = calculateTotalAmount().toString();
      console.log("bzzAmount", bzzAmount);
      console.log("swarmBatchNonce", swarmConfig.swarmBatchNonce);

      // Deciding if we are buying stamp directly or swaping/bridging
      if (
        selectedChainId === ChainId.DAI &&
        getAddress(fromToken) === getAddress(GNOSIS_BZZ_ADDRESS)
      ) {
        await handleDirectBzzTransactions();
      } else {
        setStatusMessage({
          step: "Quoting",
          message: "Getting quote...",
        });

        const gnosisSourceToken =
          selectedChainId === ChainId.DAI
            ? fromToken
            : GNOSIS_DESTINATION_TOKEN;

        const { gnosisContactCallsQuoteResponse, gnosisContractCallsRoute } =
          await getGnosisQuote({
            gnosisSourceToken,
            address,
            bzzAmount,
            nodeAddress,
            swarmConfig,
          });

        // Check are we solving Gnosis chain or other chain Swap
        if (selectedChainId === ChainId.DAI) {
          await handleGnosisTokenSwap(gnosisContractCallsRoute);
        } else {
          // This is gnosisSourceToken/gnosisDesatinationToken amount value
          const toAmount = gnosisContactCallsQuoteResponse.estimate.fromAmount;
          await handleCrossChainSwap(gnosisContractCallsRoute, toAmount);
        }
      }
    } catch (error) {
      console.error("An error occurred:", error);
      setStatusMessage({
        step: "Error",
        message: "Execution failed",
        error: formatErrorMessage(error),
        isError: true,
      });
    }
  };

  const saveUploadReference = (
    reference: string,
    stampId: string,
    expiryDate: number,
    filename?: string
  ) => {
    if (!address) return;

    const savedHistory = localStorage.getItem("uploadHistory");
    const history = savedHistory ? JSON.parse(savedHistory) : {};

    const addressHistory = history[address] || [];
    addressHistory.unshift({
      reference,
      timestamp: Date.now(),
      filename,
      stampId,
      expiryDate,
    });

    history[address] = addressHistory;
    localStorage.setItem("uploadHistory", JSON.stringify(history));
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !postageBatchId || !walletClient || !publicClient) {
      console.error("Missing file, postage batch ID, or wallet");
      return;
    }

    const isLocalhost =
      beeApiUrl.includes("localhost") || beeApiUrl.includes("127.0.0.1");
    setUploadStep("uploading");
    setUploadProgress(0);

    interface XHRResponse {
      ok: boolean;
      status: number;
      text: () => Promise<string>;
    }

    interface StampResponse {
      batchID: string;
      utilization: number;
      usable: boolean;
      label: string;
      depth: number;
      amount: string;
      bucketDepth: number;
      blockNumber: number;
      immutableFlag: boolean;
      exists: boolean;
      batchTTL: number;
    }

    const checkStampStatus = async (
      batchId: string
    ): Promise<StampResponse> => {
      console.log(`Checking stamp status for batch ${batchId}`);
      const response = await fetch(`${beeApiUrl}/stamps/${batchId}`);
      const data = await response.json();
      console.log("Stamp status response:", data);
      return data;
    };

    const uploadLargeFile = async (
      file: File,
      headers: Record<string, string>,
      url: string
    ): Promise<XHRResponse> => {
      console.log("Starting file upload...");
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open("POST", url);
        xhr.timeout = 3600000; // 1 hour timeout

        Object.entries(headers).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = (event.loaded / event.total) * 100;
            setUploadProgress(Math.min(99, percent));
            console.log(`Upload progress: ${percent.toFixed(1)}%`);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            setUploadProgress(100);
          }
          console.log(`Upload completed with status: ${xhr.status}`);
          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            text: () => Promise.resolve(xhr.responseText),
          });
        };

        xhr.onerror = (e) => {
          console.error("XHR Error:", e);
          reject(new Error("Network request failed"));
        };

        xhr.ontimeout = () => {
          console.error("Upload timed out");
          reject(new Error("Upload timed out"));
        };

        console.log("Sending file:", file.name, file.size);
        xhr.send(file);
      });
    };

    try {
      const baseHeaders: Record<string, string> = {
        "Content-Type": isTarFile ? "application/x-tar" : selectedFile.type,
        "swarm-postage-batch-id": postageBatchId,
        "swarm-pin": "false",
      };

      if (isTarFile) {
        baseHeaders["swarm-collection"] = "true";
      }

      if (!isLocalhost) {
        const messageHash = keccak256(
          encodeAbiParameters(parseAbiParameters(["string", "bytes32"]), [
            selectedFile.name,
            `0x${postageBatchId}`,
          ])
        );

        const signature = await walletClient.signMessage({
          message: { raw: messageHash },
        });

        baseHeaders["x-upload-signature"] = signature;
        baseHeaders["x-uploader-address"] = address as string;
        baseHeaders["x-file-name"] = selectedFile.name;
      }

      if (isWebpageUpload && isTarFile) {
        baseHeaders["Swarm-Index-Document"] = "index.html";
        baseHeaders["Swarm-Error-Document"] = "error.html";
      }

      const waitForBatch = async (
        maxRetries404 = 50,
        maxRetries422 = 50,
        retryDelay404 = 3000,
        retryDelay422 = 3000
      ): Promise<void> => {
        // First wait for batch to exist
        for (let attempt404 = 1; attempt404 <= maxRetries404; attempt404++) {
          try {
            console.log(
              `Checking batch existence, attempt ${attempt404}/${maxRetries404}`
            );
            setStatusMessage({
              step: "404",
              message: "Searching for batch ID...",
            });

            const stampStatus = await checkStampStatus(postageBatchId);

            if (stampStatus.exists) {
              console.log("Batch exists, checking usability");

              // Now wait for batch to become usable
              for (
                let attempt422 = 1;
                attempt422 <= maxRetries422;
                attempt422++
              ) {
                console.log(
                  `Checking batch usability, attempt ${attempt422}/${maxRetries422}`
                );
                setStatusMessage({
                  step: "422",
                  message: "Waiting for batch to be usable...",
                });

                const usabilityStatus = await checkStampStatus(postageBatchId);

                if (usabilityStatus.usable) {
                  console.log("Batch is usable, ready for upload");
                  return;
                }

                console.log(
                  `Batch not usable yet, waiting ${retryDelay422}ms before next attempt`
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, retryDelay422)
                );
              }
              throw new Error(
                "Batch never became usable after maximum retries"
              );
            }

            console.log(
              `Batch not found, waiting ${retryDelay404}ms before next attempt`
            );
            await new Promise((resolve) => setTimeout(resolve, retryDelay404));
          } catch (error) {
            console.error(`Error checking stamp status:`, error);
            if (attempt404 === maxRetries404) {
              throw new Error("Batch never found after maximum retries");
            }
            await new Promise((resolve) => setTimeout(resolve, retryDelay404));
          }
        }
        throw new Error("Maximum retry attempts reached");
      };

      // Wait for batch to be ready
      await waitForBatch();

      // Once batch is ready, proceed with upload
      console.log("Starting actual file upload");
      setStatusMessage({
        step: "Uploading",
        message: "Uploading file...",
      });

      const uploadResponse = await uploadLargeFile(
        selectedFile,
        baseHeaders,
        `${beeApiUrl}/bzz`
      );

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const reference = await uploadResponse.text();
      const parsedReference = JSON.parse(reference);

      console.log("Upload successful, reference:", parsedReference);

      setStatusMessage({
        step: "Complete",
        message: `Upload Successful. Reference: ${parsedReference.reference.slice(
          0,
          6
        )}...${parsedReference.reference.slice(-4)}`,
        isSuccess: true,
        reference: parsedReference.reference,
      });

      setUploadStep("complete");
      setTimeout(() => {
        setUploadStep("idle");
        setShowOverlay(false);
        setIsLoading(false);
        setUploadProgress(0);
      }, 255000);

      if (parsedReference.reference) {
        saveUploadReference(
          parsedReference.reference,
          postageBatchId,
          Date.now() + selectedDays * 24 * 60 * 60 * 1000, // Convert days to milliseconds
          selectedFile?.name
        );
      }
    } catch (error) {
      console.error("Upload error:", error);
      setStatusMessage({
        step: "Error",
        message: "Upload failed",
        error: error instanceof Error ? error.message : "Unknown error",
        isError: true,
      });
      setUploadStep("idle");
      setUploadProgress(0);
    }
  };

  const displayTokenBalance = selectedTokenInfo && (
    <div className={styles.tokenBalance}>
      {(() => {
        const { formatted, usdValue } = formatTokenBalance(
          selectedTokenInfo.amount,
          selectedTokenInfo.decimals,
          selectedTokenInfo.priceUSD
        );
        return (
          <>
            <div className={styles.balanceAmount}>{formatted}</div>
            <div className={styles.balanceUsd}>${usdValue}</div>
          </>
        );
      })()}
    </div>
  );

  return (
    <div className={styles.container}>
      {!showHelp && !showStampList && !showUploadHistory ? (
        <>
          <h1 className={styles.title}>Buy BZZ and Upload data</h1>

          <div className={styles.inputGroup}>
            <label className={styles.label}>From Chain:</label>
            <SearchableChainDropdown
              selectedChainId={selectedChainId}
              availableChains={availableChains}
              onChainSelect={(chainId) => {
                setSelectedChainId(chainId);
                switchChain?.({ chainId });
              }}
              isChainsLoading={isChainsLoading}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>From Token:</label>
            <SearchableTokenDropdown
              fromToken={fromToken}
              selectedChainId={selectedChainId}
              isWalletLoading={isWalletLoading}
              isTokensLoading={isTokensLoading}
              isConnected={isConnected}
              availableTokens={availableTokens}
              tokenBalances={tokenBalances}
              selectedTokenInfo={selectedTokenInfo}
              onTokenSelect={(address, token) => {
                setFromToken(address);
                setSelectedTokenInfo(token);
              }}
              minBalanceUsd={MIN_TOKEN_BALANCE_USD}
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Number of Days:</label>
            <select
              className={styles.select}
              value={selectedDays}
              onChange={(e) => setSelectedDays(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((days) => (
                <option key={days} value={days}>
                  {days} {days === 1 ? "day" : "days"}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Storage Block:</label>
            <select
              className={styles.select}
              value={selectedDepth}
              onChange={(e) => handleDepthChange(Number(e.target.value))}
            >
              {STORAGE_OPTIONS.map(({ depth, size }) => (
                <option key={depth} value={depth}>
                  {size}
                </option>
              ))}
            </select>
          </div>

          {totalUsdAmount !== null && (
            <p className={styles.priceInfo}>
              {Number(totalUsdAmount) === 0
                ? "Estimating total cost..."
                : liquidityError
                ? "Not enough liquidity for this swap"
                : `Total cost ~ $${Number(totalUsdAmount).toFixed(2)}`}
            </p>
          )}

          <button
            className={styles.button}
            onClick={handleSwap}
            disabled={
              !isClientConnected ||
              isLoading ||
              liquidityError ||
              isPriceEstimating
            }
          >
            {isLoading ? (
              <div>Loading...</div>
            ) : isPriceEstimating ? (
              "Execute Swap"
            ) : liquidityError ? (
              "Cannot Swap - Can't Find Route"
            ) : (
              "Execute Swap"
            )}
          </button>

          {executionResult && (
            <pre className={styles.resultBox}>
              {JSON.stringify(executionResult, null, 2)}
            </pre>
          )}

          {(isLoading || (showOverlay && uploadStep !== "idle")) && (
            <div className={styles.overlay}>
              <div
                className={`${styles.statusBox} ${
                  statusMessage.isSuccess ? styles.success : ""
                }`}
              >
                {!["uploading", "ready"].includes(uploadStep) && (
                  <button
                    className={styles.closeButton}
                    onClick={() => {
                      setShowOverlay(false);
                      setStatusMessage({ step: "", message: "" });
                      setUploadStep("idle");
                      setIsLoading(false);
                      setExecutionResult(null);
                      setSelectedFile(null);
                    }}
                  >
                    ×
                  </button>
                )}

                {!["ready", "uploading"].includes(uploadStep) && (
                  <>
                    {isLoading && statusMessage.step !== "Complete" && (
                      <div className={styles.spinner}></div>
                    )}
                    <div className={styles.statusMessage}>
                      <h3
                        className={
                          statusMessage.isSuccess ? styles.success : ""
                        }
                      >
                        {statusMessage.message}
                      </h3>
                      {statusMessage.error && (
                        <div className={styles.errorMessage}>
                          {statusMessage.error}
                        </div>
                      )}
                    </div>
                  </>
                )}

                {["ready", "uploading"].includes(uploadStep) && (
                  <div className={styles.uploadBox}>
                    <h3 className={styles.uploadTitle}>Upload File or TAR</h3>
                    {statusMessage.step === "waiting_creation" ||
                    statusMessage.step === "waiting_usable" ? (
                      <div className={styles.waitingMessage}>
                        <div className={styles.spinner}></div>
                        <p>{statusMessage.message}</p>
                      </div>
                    ) : (
                      <div className={styles.uploadForm}>
                        <div className={styles.fileInputWrapper}>
                          <input
                            type="file"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSelectedFile(file);
                              setIsTarFile(
                                file?.name.toLowerCase().endsWith(".tar") ??
                                  false
                              );
                            }}
                            className={styles.fileInput}
                            disabled={uploadStep === "uploading"}
                            id="file-upload"
                          />
                          <label
                            htmlFor="file-upload"
                            className={styles.fileInputLabel}
                          >
                            {selectedFile ? selectedFile.name : "Choose file"}
                          </label>
                        </div>

                        {isTarFile && (
                          <div className={styles.checkboxWrapper}>
                            <input
                              type="checkbox"
                              id="webpage-upload"
                              checked={isWebpageUpload}
                              onChange={(e) =>
                                setIsWebpageUpload(e.target.checked)
                              }
                              className={styles.checkbox}
                              disabled={uploadStep === "uploading"}
                            />
                            <label
                              htmlFor="webpage-upload"
                              className={styles.checkboxLabel}
                            >
                              Upload as webpage
                            </label>
                          </div>
                        )}

                        <button
                          onClick={handleFileUpload}
                          disabled={!selectedFile || uploadStep === "uploading"}
                          className={styles.uploadButton}
                        >
                          {uploadStep === "uploading" ? (
                            <>
                              <div className={styles.smallSpinner}></div>
                              {statusMessage.step === "404"
                                ? "Searching for batch ID..."
                                : statusMessage.step === "422"
                                ? "Waiting for batch to be usable..."
                                : statusMessage.step === "Uploading"
                                ? `Uploading... ${uploadProgress.toFixed(1)}%`
                                : "Processing..."}
                            </>
                          ) : (
                            "Upload"
                          )}
                        </button>
                        {uploadStep === "uploading" && (
                          <div className={styles.progressBarContainer}>
                            <div
                              className={styles.progressBar}
                              style={{ width: `${uploadProgress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {uploadStep === "complete" && (
                  <div className={styles.successMessage}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>Upload Successful!</h3>
                    <div className={styles.referenceBox}>
                      <p>Reference:</p>
                      <code>{statusMessage.reference}</code>
                      <a
                        href={`${BEE_GATEWAY_URL}${statusMessage.reference}/`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={styles.referenceLink}
                      >
                        Open in Gateway
                      </a>
                    </div>
                    <button
                      className={styles.closeSuccessButton}
                      onClick={() => {
                        setShowOverlay(false);
                        setUploadStep("idle");
                        setStatusMessage({ step: "", message: "" });
                        setIsLoading(false);
                        setExecutionResult(null);
                        setSelectedFile(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className={styles.configContainer}>
            <button
              className={styles.configButton}
              onClick={() => setShowStampList(true)}
              aria-label="Stamp List"
              style={{ marginRight: "10px" }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="8" y1="6" x2="21" y2="6"></line>
                <line x1="8" y1="12" x2="21" y2="12"></line>
                <line x1="8" y1="18" x2="21" y2="18"></line>
                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                <line x1="3" y1="18" x2="3.01" y2="18"></line>
              </svg>
            </button>
            <button
              className={styles.configButton}
              onClick={() => setShowUploadHistory(true)}
              aria-label="Upload History"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <polyline points="10 9 9 9 8 9" />
              </svg>
            </button>
            <button
              className={styles.configButton}
              onClick={() => setShowHelp(true)}
              aria-label="Settings"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3"></circle>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
              </svg>
            </button>
          </div>
        </>
      ) : showHelp ? (
        <HelpSection
          nodeAddress={nodeAddress}
          beeApiUrl={beeApiUrl}
          setNodeAddress={setNodeAddress}
          setBeeApiUrl={setBeeApiUrl}
          setShowHelp={setShowHelp}
          isCustomNode={isCustomNode}
          setIsCustomNode={setIsCustomNode}
        />
      ) : showStampList ? (
        <StampListSection
          setShowStampList={setShowStampList}
          address={address}
          beeApiUrl={beeApiUrl}
          setPostageBatchId={setPostageBatchId}
          setShowOverlay={setShowOverlay}
          setUploadStep={setUploadStep}
        />
      ) : showUploadHistory ? (
        <UploadHistorySection
          address={address}
          setShowUploadHistory={setShowUploadHistory}
        />
      ) : null}
    </div>
  );
};

export default SwapComponent;
