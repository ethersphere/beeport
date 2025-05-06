"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useWalletClient,
  useSwitchChain,
} from "wagmi";
import { watchChainId, getWalletClient } from "@wagmi/core";
import { config } from "@/app/wagmi";
import {
  createConfig,
  EVM,
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
import { parseAbi, formatUnits } from "viem";
import { getAddress } from "viem";

import { ExecutionStatus, UploadStep } from "./types";
import {
  GNOSIS_PRICE_ORACLE_ADDRESS,
  GNOSIS_PRICE_ORACLE_ABI,
  DEFAULT_NODE_ADDRESS,
  GNOSIS_BZZ_ADDRESS,
  DEFAULT_SWARM_CONFIG,
  STORAGE_OPTIONS,
  BEE_GATEWAY_URL,
  GNOSIS_DESTINATION_TOKEN,
  TIME_OPTIONS,
  GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  DEFAULT_BEE_API_URL,
  MIN_TOKEN_BALANCE_USD,
  LIFI_API_KEY,
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
  toChecksumAddress,
  generateProperNonce,
  getGnosisPublicClient,
  setGnosisRpcUrl,
} from "./utils";

import { getGnosisQuote, getCrossChainQuote } from "./CustomQuotes";
import { 
  handleFileUpload as uploadFile,
  isArchiveFile,
  FileUploadContext
} from "./FileUploadUtils";

const SwapComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [fromToken, setFromToken] = useState(
    "0x0000000000000000000000000000000000000000"
  );
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<bigint | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(22);
  const [nodeAddress, setNodeAddress] = useState<string>(DEFAULT_NODE_ADDRESS);
  const [isWebpageUpload, setIsWebpageUpload] = useState(false);
  const [isTarFile, setIsTarFile] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [totalUsdAmount, setTotalUsdAmount] = useState<string | null>(null);
  const [availableChains, setAvailableChains] = useState<Chain[]>([]);
  const [isChainsLoading, setIsChainsLoading] = useState(true);
  const [liquidityError, setLiquidityError] = useState<boolean>(false);
  const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);
  const [isPriceEstimating, setIsPriceEstimating] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
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

  const [swarmConfig, setSwarmConfig] = useState(DEFAULT_SWARM_CONFIG);

  const [isCustomNode, setIsCustomNode] = useState(false);

  const [showUploadHistory, setShowUploadHistory] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);

  const [serveUncompressed, setServeUncompressed] = useState(true);

  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Add a ref to track the current wallet client
  const currentWalletClientRef = useRef(walletClient);
  
  // Update the ref whenever walletClient changes
  useEffect(() => {
    currentWalletClientRef.current = walletClient;
  }, [walletClient]);

  // Add a ref for the abort controller
  const priceEstimateAbortControllerRef = useRef<AbortController | null>(null);

  // Add state for custom RPC
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [customRpcUrl, setCustomRpcUrl] = useState<string>("");

  // Watch for changes to custom RPC URL settings and update global setting
  useEffect(() => {
    // Update the global RPC URL when custom RPC settings change
    setGnosisRpcUrl(isCustomRpc ? customRpcUrl : undefined);
  }, [isCustomRpc, customRpcUrl]);

  // Initial setup that runs only once to set the chain ID from wallet
  useEffect(() => {
    if (chainId && !isInitialized) {
      console.log("Initial chain setup with ID:", chainId);
      setSelectedChainId(chainId);
      setIsInitialized(true);
    }
  }, [chainId, isInitialized]);

  useEffect(() => {
    const init = async () => {
      setIsWalletLoading(true);
      if (isConnected && address && isInitialized) {
        setSelectedDays(null);
        setFromToken("");
        setSelectedTokenInfo(null);
      }
      setIsWalletLoading(false);
    };

    init();
  }, [isConnected, address, isInitialized]);

  // Separate useEffect to fetch tokens after selectedChainId is updated
  useEffect(() => {
    if (isConnected && address && selectedChainId && isInitialized) {
      console.log("Fetching tokens with chain ID:", selectedChainId);
      fetchTokensAndBalances(selectedChainId);
    }
  }, [isConnected, address, selectedChainId, isInitialized]);

  useEffect(() => {
    if (chainId && isInitialized) {
      // Only update selectedChainId if we've already initialized
      // This handles chain switching after initial load
      if (chainId !== selectedChainId) {
        console.log("Chain changed from", selectedChainId, "to", chainId);
        setSelectedChainId(chainId);
        setSelectedDays(null);
        setFromToken("");
        setSelectedTokenInfo(null);
        setTokenBalances(null);
      }
    }
  }, [chainId, isInitialized]);

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
    }
  }, [isConnected, publicClient, walletClient, address]);

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
    if (!selectedDays || selectedDays === 0) {
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
      return;
    }

    if (!currentPrice) return;

    try {
      updateSwarmBatchInitialBalance();
    } catch (error) {
      console.error("Error calculating total cost:", error);
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
    }
  }, [currentPrice, selectedDays, selectedDepth]);

  useEffect(() => {
    if (!isConnected || !address || !fromToken) return;
    setTotalUsdAmount(null);
    setLiquidityError(false);
    setIsPriceEstimating(true);
    
    // Cancel any previous price estimate operations
    if (priceEstimateAbortControllerRef.current) {
      console.log("Cancelling previous price estimate");
      priceEstimateAbortControllerRef.current.abort();
    }
    
    // Create a new abort controller for this run
    priceEstimateAbortControllerRef.current = new AbortController();
    const abortSignal = priceEstimateAbortControllerRef.current.signal;

    const updatePriceEstimate = async () => {
      if (!selectedChainId) return;
      
      // Reset insufficient funds state at the beginning of new price estimation
      setInsufficientFunds(false);
      
      try {
        const bzzAmount = calculateTotalAmount().toString();
        const gnosisSourceToken =
          selectedChainId === ChainId.DAI
            ? fromToken
            : GNOSIS_DESTINATION_TOKEN;

        // Add detailed logging
        console.log("BZZ amount needed:", formatUnits(BigInt(bzzAmount), 16));
        console.log("Selected days:", selectedDays);
        console.log(
          "Selected stamps size:",
          STORAGE_OPTIONS.find((option) => option.depth === selectedDepth)
            ?.size || "Unknown"
        );

        const { gnosisContactCallsQuoteResponse } = await performWithRetry(
          () =>
            getGnosisQuote({
              gnosisSourceToken,
              address,
              bzzAmount,
              nodeAddress,
              swarmConfig,
              setEstimatedTime,
            }),
          "getGnosisQuote",
          undefined,
          5,
          300,
          abortSignal
        );

        // If operation was aborted, don't continue
        if (abortSignal.aborted) {
          console.log("Price estimate aborted after Gnosis quote");
          return;
        }

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
                setEstimatedTime,
              }),
            "getCrossChainQuote",
            undefined,
            5,
            300,
            abortSignal
          );

          // If operation was aborted, don't continue
          if (abortSignal.aborted) {
            console.log("Price estimate aborted after cross-chain quote");
            return;
          }

          // Add to total amount bridge fees
          const bridgeFees = crossChainContractQuoteResponse.estimate.feeCosts
            ? crossChainContractQuoteResponse.estimate.feeCosts.reduce(
                (total, fee) => total + Number(fee.amountUSD || 0),
                0
              )
            : 0;

          console.log("Bridge fees:", bridgeFees);
          console.log(
            "Gas fees:",
            crossChainContractQuoteResponse.estimate.gasCosts?.[0]?.amountUSD ||
              "0"
          );
          console.log(
            "Cross chain amount:",
            crossChainContractQuoteResponse.estimate.fromAmountUSD
          );

          totalAmount = Number(
            crossChainContractQuoteResponse.estimate.fromAmountUSD || 0
          );
        }

        // One final check if aborted before updating state
        if (!abortSignal.aborted) {
          console.log("Total amount:", totalAmount);
          setTotalUsdAmount(totalAmount.toString());
          
          // Check if user has enough funds
          if (selectedTokenInfo) {
            const tokenBalanceInUsd = Number(
              formatUnits(selectedTokenInfo.amount || 0n, selectedTokenInfo.decimals)
            ) * Number(selectedTokenInfo.priceUSD);
            
            console.log("User token balance in USD:", tokenBalanceInUsd);
            console.log("Required amount in USD:", totalAmount);
            
            // Set insufficient funds flag if cost exceeds available balance
            setInsufficientFunds(totalAmount > tokenBalanceInUsd);
          }
        }
      } catch (error) {
        // Only update error state if not aborted
        if (!abortSignal.aborted) {
          console.error("Error estimating price:", error);
          setTotalUsdAmount(null);
          setLiquidityError(true);
        }
      } finally {
        // Only update loading state if not aborted
        if (!abortSignal.aborted) {
          setIsPriceEstimating(false);
        }
      }
    };

    if (selectedDays) {
      updatePriceEstimate();
    } else {
      // If no days selected, still reset the loading state
      setIsPriceEstimating(false);
    }
    
    // Cleanup: abort any pending operations when the effect is cleaned up
    return () => {
      if (priceEstimateAbortControllerRef.current) {
        priceEstimateAbortControllerRef.current.abort();
        priceEstimateAbortControllerRef.current = null;
      }
    };
  }, [swarmConfig.swarmBatchTotal]);

  // Initialize LiFi function
  const initializeLiFi = () => {
    // Create new config instead of modifying existing one
    createConfig({
      integrator: "Swarm",
      apiKey: LIFI_API_KEY,
      providers: [
        EVM({
          getWalletClient: async () => {
            // Use the ref instead of the direct walletClient
            const client = currentWalletClientRef.current;
            if (!client) throw new Error("Wallet client not available");
            return client;
          },
          switchChain: async (chainId) => {
            if (switchChain) {
              switchChain({ chainId });
            }
            // Get a fresh wallet client for the new chain
            try {
              // Wait briefly for the chain to switch
              await new Promise(resolve => setTimeout(resolve, 500));
              // Create a new wallet client with the specified chainId
              const client = await getWalletClient(config, { chainId });
              // Update our ref
              currentWalletClientRef.current = client;
              return client;
            } catch (error) {
              console.error("Error getting wallet client:", error);
              if (currentWalletClientRef.current) return currentWalletClientRef.current;
              throw new Error("Failed to get wallet client for the new chain");
            }
          },
        }),
      ],
    });
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

  const fetchTokensAndBalances = async (currentChainId?: number) => {
    if (!address || !isConnected || !currentChainId) {
      setTokenBalances(null);
      setAvailableTokens(null);
      setFromToken("");
      setSelectedTokenInfo(null);
      return;
    }

    console.log("Using chain ID for token fetch:", currentChainId);
    setIsTokensLoading(true);
    try {
      // First fetch all available tokens with retry
      const tokens = await performWithRetry(
        () =>
          getTokens({
            chains: [currentChainId],
            chainTypes: [ChainType.EVM],
          }),
        "getTokens",
        (result) => Boolean(result?.tokens?.[currentChainId]?.length)
      );
      console.log("Available tokens:", tokens);
      setAvailableTokens(tokens);

      // Then get balances for these tokens with retry
      const tokensByChain = {
        [currentChainId]: tokens.tokens[currentChainId],
      };

      const balances = await performWithRetry(
        () => getTokenBalancesByChain(address, tokensByChain),
        "getTokenBalances",
        (result) => {
          // Validate that we have a non-empty balance result for the selected chain
          const chainBalances = result?.[currentChainId];
          return Boolean(chainBalances && chainBalances.length > 0);
        }
      );
      console.log("Token balances:", balances);
      setTokenBalances(balances);

      // Find tokens with balance
      if (balances?.[currentChainId]) {
        const tokensWithBalance = balances[currentChainId]
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
        // Just use getGnosisPublicClient directly, it will use the global RPC URL
        const price = await getGnosisPublicClient().readContract({
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

  const updateSwarmBatchInitialBalance = () => {
    if (currentPrice !== null) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration =
        BigInt(initialPaymentPerChunkPerDay) * BigInt(selectedDays || 1);
      const totalAmount = totalPricePerDuration * BigInt(2 ** selectedDepth);
      setSwarmConfig((prev) => ({
        ...prev,
        swarmBatchInitialBalance: totalPricePerDuration.toString(),
        swarmBatchTotal: totalAmount.toString(),
      }));
    }
  };

  const calculateTotalAmount = () => {
    const price = currentPrice || 0n; // Use 0n as default if currentPrice is null
    const initialPaymentPerChunkPerDay = price * 17280n;
    const totalPricePerDuration =
      initialPaymentPerChunkPerDay * BigInt(selectedDays || 1);
    return totalPricePerDuration * BigInt(2 ** selectedDepth);
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

      // First transaction: Approve - directly write contract without simulation
      const approveTxHash = await walletClient.writeContract({
        address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
        abi: parseAbi([
          "function approve(address spender, uint256 amount) external returns (bool)",
        ]),
        functionName: "approve",
        args: [
          GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
          BigInt(bzzAmount),
        ],
        account: address,
      });

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
          message: "Buying storage...",
        });

        // Second transaction: Create Batch - directly write contract without simulation
        const createBatchTxHash = await walletClient.writeContract({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
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

        console.log("Create batch transaction hash:", createBatchTxHash);

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
              GNOSIS_CUSTOM_REGISTRY_ADDRESS,
              setPostageBatchId
            );
            console.log(
              "Created batch ID:",
              batchId,
              swarmConfig.swarmBatchNonce
            );

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

  const handleGnosisTokenSwap = async (
    contractCallsRoute: any,
    currentConfig: any
  ) => {
    if (!selectedChainId) return;
    
    setStatusMessage({
      step: "Route",
      message: "Executing contract calls...",
    });

    const executedRoute = await executeRoute(contractCallsRoute, {
      updateRouteHook: async (updatedRoute) => {
        console.log("Updated Route:", updatedRoute);
        const status = updatedRoute.steps[0]?.execution?.status;
        console.log(`Status: ${status}`);

        setStatusMessage({
          step: "Route",
          message: `Status update: ${status?.replace(/_/g, " ")}`,
        });

        if (status === "DONE") {
          // Reset timer when done
          resetTimer();

          const txHash = updatedRoute.steps[0]?.execution?.process[0]?.txHash;
          console.log("Created new Batch at trx", txHash);

          try {
            // Batch will be created from registry contract for all cases
            const batchId = await createBatchId(
              currentConfig.swarmBatchNonce,
              GNOSIS_CUSTOM_REGISTRY_ADDRESS,
              setPostageBatchId
            );
            console.log(
              "Created batch ID:",
              batchId,
              currentConfig.swarmBatchNonce
            );
          } catch (error) {
            console.error("Failed to create batch ID:", error);
          }

          setStatusMessage({
            step: "Complete",
            message: "Storage Bought Successfully",
            isSuccess: true,
          });
          setUploadStep("ready");
        } else if (status === "FAILED") {
          // Generate a new proper nonce if the transaction fails
          const recoveryNonce = generateProperNonce();
          console.log(
            "Transaction failed, setting new recovery nonce:",
            recoveryNonce
          );

          // Create a new config with the recovery nonce
          currentConfig = {
            ...currentConfig,
            swarmBatchNonce: recoveryNonce,
          };

          // Update the state
          setSwarmConfig(currentConfig);

          // Reset timer if failed
          resetTimer();
        }
      },
    });
    console.log("Contract calls execution completed:", executedRoute);
  };

  const handleCrossChainSwap = async (
    gnosisContractCallsRoute: any,
    toAmount: any,
    updatedConfig: any
  ) => {
    if (!selectedChainId) return;
    
    setStatusMessage({
      step: "Quote",
      message: "Getting quote...",
    });

    const { crossChainContractCallsRoute } = await getCrossChainQuote({
      selectedChainId,
      fromToken,
      address: address as string,
      toAmount,
      gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
      setEstimatedTime,
    });

    const executedRoute = await executeRoute(crossChainContractCallsRoute, {
      updateRouteHook: async (crossChainContractCallsRoute) => {
        console.log("Updated Route 1:", crossChainContractCallsRoute);
        const step1Status =
          crossChainContractCallsRoute.steps[0]?.execution?.status;
        console.log(`Step 1 Status: ${step1Status}`);

        setStatusMessage({
          step: "Route",
          message: `Bridging in progress: ${step1Status?.replace(/_/g, " ")}.`,
        });

        if (step1Status === "DONE") {
          console.log("Route 1 wallet client:", walletClient);
          await handleChainSwitch(gnosisContractCallsRoute, updatedConfig);
        } else if (step1Status === "FAILED") {
          // Add reset if the execution fails
          resetTimer();
        }
      },
    });

    console.log("First route execution completed:", executedRoute);
  };

  const handleChainSwitch = async (
    contractCallsRoute: any,
    updatedConfig: any
  ) => {
    console.log("First route completed, triggering chain switch to Gnosis...");

    // Reset the timer when the action completes
    resetTimer();

    setStatusMessage({
      step: "Switch",
      message: "First route completed. Switching chain to Gnosis...",
    });

    const unwatch = watchChainId(config, {
      onChange: async (chainId) => {
        if (chainId === ChainId.DAI) {
          console.log("Detected switch to Gnosis, executing second route...");
          unwatch();
          
          // Get a fresh wallet client for the new chain
          try {
            const newClient = await getWalletClient(config, { chainId });
            console.log("Route 2 wallet client:", newClient);
            
            // Update our ref
            currentWalletClientRef.current = newClient;
            
            await handleGnosisRoute(contractCallsRoute, updatedConfig);
          } catch (error) {
            console.error("Error getting new wallet client:", error);
            // Fall back to using the current wallet client
            await handleGnosisRoute(contractCallsRoute, updatedConfig);
          }
        }
      },
    });

    switchChain({ chainId: ChainId.DAI });
    
  };

  const handleGnosisRoute = async (
    contractCallsRoute: any,
    updatedConfig: any
  ) => {
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
            message: `Second route status: ${step2Status?.replace(/_/g, " ")}`,
          });

          if (step2Status === "DONE") {
            const txHash =
              contractCallsRoute.steps[0]?.execution?.process[1]?.txHash;
            console.log("Created new Batch at trx", txHash);

            try {
              // Batch will be created from registry contract for all cases
              const batchId = await createBatchId(
                updatedConfig.swarmBatchNonce,
                GNOSIS_CUSTOM_REGISTRY_ADDRESS,
                setPostageBatchId
              );
              console.log(
                "Created batch ID:",
                batchId,
                updatedConfig.swarmBatchNonce
              );
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

  const handleSwap = async () => {
    if (!isConnected || !address || !publicClient || !walletClient || selectedChainId === null) {
      console.error("Wallet not connected, clients not available, or chain not selected");
      return;
    }

    // Reset the timer when starting a new transaction
    resetTimer();

    console.log("Current nonce", swarmConfig.swarmBatchNonce);

    // Generate a properly sized nonce (exactly 32 bytes)
    const uniqueNonce = generateProperNonce();
    console.log("Generated new nonce:", uniqueNonce);

    // Set the nonce directly in the config we'll use for this transaction
    const updatedConfig = {
      ...swarmConfig,
      swarmBatchNonce: uniqueNonce,
    };

    // Update the state for future reference
    setSwarmConfig(updatedConfig);

    console.log("Will use swarm batch nonce:", updatedConfig.swarmBatchNonce);

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

      // Deciding if we are buying stamps directly or swaping/bridging
      if (
        selectedChainId !== null && 
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
            swarmConfig: updatedConfig,
            setEstimatedTime,
          });

        // Check are we solving Gnosis chain or other chain Swap
        if (selectedChainId === ChainId.DAI) {
          await handleGnosisTokenSwap(gnosisContractCallsRoute, updatedConfig);
        } else {
          // This is gnosisSourceToken/gnosisDesatinationToken amount value
          const toAmount = gnosisContactCallsQuoteResponse.estimate.fromAmount;
          await handleCrossChainSwap(
            gnosisContractCallsRoute,
            toAmount,
            updatedConfig
          );
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


  const handleFileUpload = async () => {
    // Use the extracted file upload utility
    const context: FileUploadContext = {
      selectedFile,
      postageBatchId,
      beeApiUrl,
      address,
      isWebpageUpload,
      isTarFile,
      serveUncompressed,
      walletClient,
      publicClient,
      setUploadStep,
      setUploadProgress,
      setIsDistributing,
      setStatusMessage,
      setIsLoading,
      setShowOverlay,
      setSelectedDays
    };
    
    // Call the extracted file upload handler
    await uploadFile(context);
  };

  const handleOpenDropdown = (dropdownName: string) => {
    setActiveDropdown(dropdownName);
  };

  useEffect(() => {
    // Clear any existing timer first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Start a new timer if we have an estimated time and we're in the Route step
    if (estimatedTime !== null && statusMessage.step === "Route") {
      console.log("Starting timer with duration:", estimatedTime);

      // Initialize the remaining time if it's not set
      if (remainingTime === null) {
        const buffer: number = 10;
        setRemainingTime(estimatedTime + buffer);
      }

      // Create the interval
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          const newTime = prevTime !== null ? prevTime - 1 : 0;
          // Reduce log frequency to avoid console spam
          if (newTime % 5 === 0) {
            console.log("Timer tick, remaining time:", newTime);
          }

          if (newTime <= 0) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    // Clean up function
    return () => {
      if (timerIntervalRef.current) {
        console.log("Cleaning up timer");
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [estimatedTime, statusMessage.step]);

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // 3. Update the reset function to also clear the interval
  const resetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setEstimatedTime(null);
    setRemainingTime(null);
  };

  // Reset insufficientFunds whenever the selected token changes
  useEffect(() => {
    // When token info changes, reset insufficient funds flag
    if (selectedTokenInfo) {
      setInsufficientFunds(false);
    }
  }, [selectedTokenInfo]);

  // Also reset insufficientFunds when the selectedChainId or selectedDays changes
  useEffect(() => {
    setInsufficientFunds(false);
  }, [selectedChainId, selectedDays]);

  return (
    <div className={styles.container}>
      <div className={styles.betaBadge}>BETA</div>
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tabButton} ${
            !showHelp && !showStampList && !showUploadHistory
              ? styles.activeTab
              : ""
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
        >
          Buy
        </button>
        <button
          className={`${styles.tabButton} ${
            showStampList ? styles.activeTab : ""
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(true);
            setShowUploadHistory(false);
          }}
        >
          Stamps
        </button>
        <button
          className={`${styles.tabButton} ${
            showUploadHistory ? styles.activeTab : ""
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(true);
          }}
        >
          History
        </button>
        <button
          className={`${styles.tabButton} ${showHelp ? styles.activeTab : ""}`}
          onClick={() => {
            setShowHelp(true);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
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

      {!showHelp && !showStampList && !showUploadHistory ? (
        <>
          <div className={styles.inputGroup}>
            <label 
              className={styles.label}
              data-tooltip="Select chain with funds"
            >
              From chain
            </label>
            <SearchableChainDropdown
              selectedChainId={selectedChainId || ChainId.DAI}
              availableChains={availableChains}
              onChainSelect={(chainId) => {
                setSelectedChainId(chainId);
                switchChain?.({ chainId });
              }}
              isChainsLoading={isChainsLoading}
              isLoading={isChainsLoading}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
              sortMethod="priority"
            />
          </div>

          <div className={styles.inputGroup}>
            <label 
              className={styles.label}
              data-tooltip="Select token you want to spend"
            >
              From token
            </label>
            <SearchableTokenDropdown
              fromToken={fromToken}
              selectedChainId={selectedChainId || ChainId.DAI}
              isWalletLoading={isWalletLoading}
              isTokensLoading={isTokensLoading}
              isConnected={isConnected}
              tokenBalances={tokenBalances}
              selectedTokenInfo={selectedTokenInfo}
              onTokenSelect={(address, token) => {
                console.log("Token manually selected:", address, token?.symbol);
                
                // Only reset duration if this is a user-initiated token change (not during initial loading)
                if (fromToken && address !== fromToken) {
                  console.log("Resetting duration due to token change");
                  setSelectedDays(null);
                  setTotalUsdAmount(null);
                  setInsufficientFunds(false);
                  setLiquidityError(false);
                  setIsPriceEstimating(false);
                }
                
                setFromToken(address);
                setSelectedTokenInfo(token);
              }}
              minBalanceUsd={MIN_TOKEN_BALANCE_USD}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
            />
          </div>

          <div className={styles.inputGroup}>
            <label 
              className={styles.label}
              data-tooltip="Storage stamps are used to pay to store and host data in Swarm"
            >
              Storage stamps
            </label>
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

          <div className={styles.inputGroup}>
            <label 
              className={styles.label}
              data-tooltip="Duration of storage stamps for which you are paying for"
            >
              Storage duration
            </label>
            <select
              className={styles.select}
              value={selectedDays || ""}
              onChange={(e) => {
                const value = e.target.value;
                setSelectedDays(value === "" ? null : Number(value));
              }}
            >
              <option value="">Please select duration</option>
              {TIME_OPTIONS.map((option) => (
                <option key={option.days} value={option.days}>
                  {option.display}
                </option>
              ))}
            </select>
          </div>

          {selectedDays &&
            totalUsdAmount !== null &&
            Number(totalUsdAmount) !== 0 && (
              <p className={styles.priceInfo}>
                {liquidityError
                  ? "Not enough liquidity for this swap"
                  : insufficientFunds
                  ? `Cost ($${Number(totalUsdAmount).toFixed(2)}) exceeds your balance`
                  : `Cost without gas ~ $${Number(totalUsdAmount).toFixed(2)}`}
              </p>
            )}

          <button
            className={`${styles.button} ${
              !selectedDays || liquidityError || insufficientFunds ? styles.buttonDisabled : ""
            } ${isPriceEstimating ? styles.calculatingButton : ""}`}
            disabled={!selectedDays || liquidityError || insufficientFunds || isPriceEstimating}
            onClick={handleSwap}
          >
            {isLoading ? (
              <div>Loading...</div>
            ) : !selectedDays ? (
              "Choose Timespan"
            ) : isPriceEstimating ? (
              "Calculating Cost..."
            ) : liquidityError ? (
              "Cannot Swap - Can't Find Route"
            ) : insufficientFunds ? (
              "Insufficient Balance"
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
                {/* Always show close button */}
                <button
                  className={styles.closeButton}
                  onClick={() => {
                    setShowOverlay(false);
                    setStatusMessage({ step: "", message: "" });
                    setUploadStep("idle");
                    setIsLoading(false);
                    setExecutionResult(null);
                    setSelectedFile(null);
                    setIsWebpageUpload(false);
                    setIsTarFile(false);
                    setIsDistributing(false);
                  }}
                >
                  ×
                </button>

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

                      {remainingTime !== null &&
                        estimatedTime !== null &&
                        statusMessage.step === "Route" && (
                          <div className={styles.bridgeTimer}>
                            <p>
                              Estimated time remaining:{" "}
                              {formatTime(remainingTime)}
                            </p>
                            <div className={styles.progressBarContainer}>
                              <div
                                className={styles.progressBar}
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(
                                      100,
                                      (1 - remainingTime / estimatedTime) * 100
                                    )
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </>
                )}

                {["ready", "uploading"].includes(uploadStep) && (
                  <div className={styles.uploadBox}>
                    <h3 className={styles.uploadTitle}>Upload File</h3>
                    <div className={styles.uploadWarning}>
                      Warning! Upload data is public and can not be removed from the Swarm network
                    </div>
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
                                file?.name.toLowerCase().endsWith(".tar") ||
                                  file?.name.toLowerCase().endsWith(".zip") ||
                                  file?.name.toLowerCase().endsWith(".gz") ||
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

                        {(selectedFile?.name.toLowerCase().endsWith(".zip") ||
                          selectedFile?.name.toLowerCase().endsWith(".gz")) && (
                          <div className={styles.checkboxWrapper}>
                            <input
                              type="checkbox"
                              id="serve-uncompressed"
                              checked={serveUncompressed}
                              onChange={(e) =>
                                setServeUncompressed(e.target.checked)
                              }
                              className={styles.checkbox}
                              disabled={uploadStep === "uploading"}
                            />
                            <label
                              htmlFor="serve-uncompressed"
                              className={styles.checkboxLabel}
                            >
                              Serve uncompressed
                            </label>
                          </div>
                        )}

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
                                ? isDistributing
                                  ? "Distributing file chunks..."
                                  : `Uploading... ${uploadProgress.toFixed(1)}%`
                                : "Processing..."}
                            </>
                          ) : (
                            "Upload"
                          )}
                        </button>
                        {uploadStep === "uploading" && (
                          <>
                            {!isDistributing ? (
                              // Show the regular progress bar during upload
                              <div className={styles.progressBarContainer}>
                                <div
                                  className={styles.progressBar}
                                  style={{ width: `${uploadProgress}%` }}
                                />
                              </div>
                            ) : (
                              // Show the distribution animation when distributing to Swarm
                              <div className={styles.distributionContainer}>
                                {/* Center cube (source node) */}
                                <div className={styles.centerNode}></div>

                                {/* Target nodes (cubes) */}
                                <div
                                  className={`${styles.node} ${styles.node1}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node2}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node3}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node4}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node5}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node6}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node7}`}
                                ></div>
                                <div
                                  className={`${styles.node} ${styles.node8}`}
                                ></div>

                                {/* Chunks being distributed */}
                                <div
                                  className={`${styles.chunk} ${styles.chunk1}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk2}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk3}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk4}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk5}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk6}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk7}`}
                                ></div>
                                <div
                                  className={`${styles.chunk} ${styles.chunk8}`}
                                ></div>
                              </div>
                            )}
                          </>
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
                        href={
                          statusMessage.filename &&
                          !isArchiveFile(statusMessage.filename)
                            ? `${BEE_GATEWAY_URL}${statusMessage.reference}/${statusMessage.filename}`
                            : `${BEE_GATEWAY_URL}${statusMessage.reference}/`
                        }
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
                        setIsWebpageUpload(false);
                        setIsTarFile(false);
                        setIsDistributing(false);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      ) : showHelp ? (
        <HelpSection
          nodeAddress={nodeAddress}
          beeApiUrl={beeApiUrl}
          setBeeApiUrl={setBeeApiUrl}
          isCustomNode={isCustomNode}
          setIsCustomNode={setIsCustomNode}
          isCustomRpc={isCustomRpc}
          setIsCustomRpc={setIsCustomRpc}
          customRpcUrl={customRpcUrl}
          setCustomRpcUrl={setCustomRpcUrl}
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
