'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { watchChainId, getWalletClient } from '@wagmi/core';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { config } from '@/app/wagmi';
import { createConfig, EVM, executeRoute, ChainId, ChainType, getChains, Chain } from '@lifi/sdk';
import styles from './css/SwapComponent.module.css';
import { parseAbi, formatUnits } from 'viem';
import { getAddress } from 'viem';

import { ExecutionStatus, UploadStep } from './types';
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
  DISABLE_MESSAGE_SIGNING,
  ACCEPT_EXCHANGE_RATE_UPDATES,
  UPLOAD_RETRY_CONFIG,
  FILE_SIZE_CONFIG,
  UPLOAD_TIMEOUT_CONFIG,
} from './constants';

import HelpSection from './HelpSection';
import StampListSection from './StampListSection';
import UploadHistorySection from './UploadHistorySection';
import SearchableChainDropdown from './SearchableChainDropdown';
import SearchableTokenDropdown from './SearchableTokenDropdown';
import StorageStampsDropdown from './StorageStampsDropdown';
import StorageDurationDropdown from './StorageDurationDropdown';

import {
  formatErrorMessage,
  createBatchId,
  readBatchId,
  performWithRetry,
  toChecksumAddress,
  getGnosisPublicClient,
  setGnosisRpcUrl,
  handleExchangeRateUpdate,
  fetchCurrentPriceFromOracle,
  fetchStampInfo,
} from './utils';
import { useTimer } from './TimerUtils';

import { getGnosisQuote, getCrossChainQuote } from './CustomQuotes';
import { getRelaySwapQuotes, executeRelaySteps, RelayQuoteResponse } from './RelayQuotes';
import {
  handleFileUpload as uploadFile,
  handleMultiFileUpload,
  isArchiveFile,
  MultiFileResult,
} from './FileUploadUtils';
import { processNFTCollection, NFTCollectionResult } from './NFTCollectionProcessor';
import { generateAndUpdateNonce, fetchNodeWalletAddress } from './utils';
import { useTokenManagement } from './TokenUtils';

// Update the StampInfo interface to include the additional properties
interface StampInfo {
  batchID: string;
  utilization: number;
  usable: boolean;
  depth: number;
  amount: string;
  bucketDepth: number;
  exists: boolean;
  batchTTL: number;
  // Add the additional properties we're using
  totalSize?: string;
  usedSize?: string;
  remainingSize?: string;
  utilizationPercent?: number;
}

const SwapComponent: React.FC = () => {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  // Add state to track if component has mounted to prevent hydration mismatches
  const [hasMounted, setHasMounted] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
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
  const [aggregatorDown, setAggregatorDown] = useState<boolean>(false);
  const [insufficientFunds, setInsufficientFunds] = useState<boolean>(false);
  const [isPriceEstimating, setIsPriceEstimating] = useState(false);
  const [isDistributing, setIsDistributing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<ExecutionStatus>({
    step: '',
    message: '',
  });
  const [showOverlay, setShowOverlay] = useState(false);
  const [uploadStep, setUploadStep] = useState<UploadStep>('idle');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isMultipleFiles, setIsMultipleFiles] = useState(false);
  const [multiFileResults, setMultiFileResults] = useState<MultiFileResult[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showStampList, setShowStampList] = useState(false);

  const [isWalletLoading, setIsWalletLoading] = useState(true);
  const [postageBatchId, setPostageBatchId] = useState<string>('');
  const [topUpBatchId, setTopUpBatchId] = useState<string | null>(null);
  const [isTopUp, setIsTopUp] = useState(false);

  // Use the token management hook
  const {
    fromToken,
    setFromToken,
    selectedTokenInfo,
    setSelectedTokenInfo,
    availableTokens,
    tokenBalances,
    isTokensLoading,
    fetchTokensAndBalances,
    resetTokens,
  } = useTokenManagement(address, isConnected);

  const [beeApiUrl, setBeeApiUrl] = useState<string>(DEFAULT_BEE_API_URL);

  const [swarmConfig, setSwarmConfig] = useState(DEFAULT_SWARM_CONFIG);

  const [isCustomNode, setIsCustomNode] = useState(false);

  const [showUploadHistory, setShowUploadHistory] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [serveUncompressed, setServeUncompressed] = useState(true);

  // NFT Collection states
  const [isNFTCollection, setIsNFTCollection] = useState(false);
  const [nftCollectionResult, setNftCollectionResult] = useState<{
    imagesReference: string;
    metadataReference: string;
    totalImages: number;
    totalMetadata: number;
  } | null>(null);

  // Add states to track top-up completion
  const [topUpCompleted, setTopUpCompleted] = useState(false);
  const [topUpInfo, setTopUpInfo] = useState<{
    batchId: string;
    days: number;
    cost: string;
  } | null>(null);

  // Add state for original stamp info (used in top-ups)
  const [originalStampInfo, setOriginalStampInfo] = useState<StampInfo | null>(null);

  // Add a ref to track the current wallet client
  const currentWalletClientRef = useRef(walletClient);

  // Update the ref whenever walletClient changes
  useEffect(() => {
    currentWalletClientRef.current = walletClient;
  }, [walletClient]);

  const { estimatedTime, setEstimatedTime, remainingTime, formatTime, resetTimer } =
    useTimer(statusMessage);

  // Add a ref for the abort controller
  const priceEstimateAbortControllerRef = useRef<AbortController | null>(null);

  // Add state for custom RPC
  const [isCustomRpc, setIsCustomRpc] = useState(false);
  const [customRpcUrl, setCustomRpcUrl] = useState<string>('');

  // Watch for changes to custom RPC URL settings and update global setting
  useEffect(() => {
    // Update the global RPC URL when custom RPC settings change
    setGnosisRpcUrl(isCustomRpc ? customRpcUrl : undefined);
  }, [isCustomRpc, customRpcUrl]);

  // Initial setup that runs only once to set the chain ID from wallet
  useEffect(() => {
    if (chainId && !isInitialized) {
      console.log('Initial chain setup with ID:', chainId);
      setSelectedChainId(chainId);
      setIsInitialized(true);
    }
  }, [chainId, isInitialized]);

  useEffect(() => {
    const init = async () => {
      setIsWalletLoading(true);
      if (isConnected && address && isInitialized) {
        setSelectedDays(null);
        resetTokens();
      }
      setIsWalletLoading(false);
    };

    init();
  }, [isConnected, address, isInitialized, resetTokens]);

  // Separate useEffect to fetch tokens after selectedChainId is updated
  useEffect(() => {
    if (selectedChainId && isInitialized) {
      console.log('Fetching tokens with chain ID:', selectedChainId);
      fetchTokensAndBalances(selectedChainId);
    }
  }, [selectedChainId, isInitialized, isConnected, address, fetchTokensAndBalances]);

  useEffect(() => {
    if (chainId && isInitialized) {
      // Only update selectedChainId if we've already initialized
      // This handles chain switching after initial load
      if (chainId !== selectedChainId) {
        console.log('Chain changed from', selectedChainId, 'to', chainId);
        setSelectedChainId(chainId);
        setSelectedDays(null);
        resetTokens();
      }
    }
    // selectedChainId intentionally omitted - we only want to respond to chainId changes
    // Including it would cause the effect to run twice when chains differ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chainId, isInitialized, resetTokens]);

  // This useEffect will be moved after initializeLiFi declaration

  useEffect(() => {
    const fetchChains = async () => {
      try {
        setIsChainsLoading(true);
        const chains = await getChains({ chainTypes: [ChainType.EVM] });
        setAvailableChains(chains);
      } catch (error) {
        console.error('Error fetching chains:', error);
      } finally {
        setIsChainsLoading(false);
      }
    };

    fetchChains();
  }, []);

  // This useEffect will be moved after updateSwarmBatchInitialBalance declaration

  useEffect(() => {
    if (!isConnected || !address || !fromToken) return;
    setTotalUsdAmount(null);
    setLiquidityError(false);
    setAggregatorDown(false);
    setIsPriceEstimating(true);

    // Cancel any previous price estimate operations
    if (priceEstimateAbortControllerRef.current) {
      console.log('Cancelling previous price estimate');
      priceEstimateAbortControllerRef.current.abort();
    }

    // Create a new abort controller for this run
    priceEstimateAbortControllerRef.current = new AbortController();
    const abortSignal = priceEstimateAbortControllerRef.current.signal;

    const updatePriceEstimate = async () => {
      if (!selectedChainId || !address) return;

      // Reset insufficient funds state at the beginning of new price estimation
      setInsufficientFunds(false);
      setLiquidityError(false);
      setAggregatorDown(false);

      try {
        const bzzAmount = calculateTotalAmount().toString();

        console.log('🔍 Relay price estimation:', {
          bzzAmount: formatUnits(BigInt(bzzAmount), 16),
          selectedDays,
          stampSize:
            STORAGE_OPTIONS.find(option => option.depth === selectedDepth)?.size || 'Unknown',
          selectedChainId,
          fromToken,
        });

        // Use the new Relay system for price estimation
        const relayQuoteResult = await getRelaySwapQuotes({
          selectedChainId,
          fromToken,
          address,
          bzzAmount,
          nodeAddress,
          swarmConfig,
          topUpBatchId: isTopUp ? topUpBatchId || undefined : undefined,
          setEstimatedTime: () => {}, // Don't override estimated time during price estimation
          isForEstimation: true,
        });

        // If operation was aborted, don't continue
        if (abortSignal.aborted) {
          console.log('Price estimate aborted');
          return;
        }

        console.log(
          `💰 Relay price estimation complete: $${relayQuoteResult.totalAmountUSD.toFixed(2)}`
        );
        setTotalUsdAmount(relayQuoteResult.totalAmountUSD.toString());

        // Check if user has enough funds
        if (selectedTokenInfo) {
          const tokenBalanceInUsd =
            Number(formatUnits(selectedTokenInfo.amount || 0n, selectedTokenInfo.decimals)) *
            Number(selectedTokenInfo.priceUSD);

          console.log('User token balance in USD:', tokenBalanceInUsd);
          console.log('Required amount in USD:', relayQuoteResult.totalAmountUSD);

          // Set insufficient funds flag if cost exceeds available balance
          setInsufficientFunds(relayQuoteResult.totalAmountUSD > tokenBalanceInUsd);
        }
      } catch (error) {
        // Only update error state if not aborted
        if (!abortSignal.aborted) {
          console.error('Error estimating price:', error);
          setTotalUsdAmount(null);

          // Check if this is a LI.FI aggregator 404 error
          const errorMessage = error instanceof Error ? error.message : String(error);
          const isLiFiNotFoundError =
            errorMessage.includes('404') ||
            errorMessage.includes('Not Found') ||
            errorMessage.includes('No available quotes for the requested transfer') ||
            errorMessage.includes('NotFoundError');

          if (isLiFiNotFoundError) {
            console.log('LI.FI aggregator appears to be down or no quotes available');
            setAggregatorDown(true);
          } else {
            setLiquidityError(true);
          }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swarmConfig.swarmBatchTotal]);

  // Initialize LiFi function
  const initializeLiFi = useCallback(() => {
    // Create new config instead of modifying existing one
    createConfig({
      integrator: 'Swarm',
      apiKey: LIFI_API_KEY,
      providers: [
        EVM({
          getWalletClient: async () => {
            // Use the ref instead of the direct walletClient
            const client = currentWalletClientRef.current;
            if (!client) throw new Error('Wallet client not available');
            return client;
          },
          switchChain: async chainId => {
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
              console.error('Error getting wallet client:', error);
              if (currentWalletClientRef.current) return currentWalletClientRef.current;
              throw new Error('Failed to get wallet client for the new chain');
            }
          },
        }),
      ],
    });
  }, [switchChain]);

  useEffect(() => {
    if (isConnected && publicClient && walletClient) {
      // Reinitialize LiFi whenever the wallet changes
      initializeLiFi();
    } else {
    }
  }, [isConnected, publicClient, walletClient, address, initializeLiFi]);

  const fetchAndSetNodeWalletAddress = useCallback(async () => {
    const address = await fetchNodeWalletAddress(beeApiUrl, DEFAULT_NODE_ADDRESS);
    setNodeAddress(address);
  }, [beeApiUrl]);

  useEffect(() => {
    const fetchAndSetNode = async () => {
      await fetchAndSetNodeWalletAddress();
    };
    fetchAndSetNode();
  }, [beeApiUrl, fetchAndSetNodeWalletAddress]);

  // This useEffect will be moved after fetchCurrentPrice declaration

  const fetchCurrentPrice = useCallback(async () => {
    // Get RPC info outside try block for error logging
    const { client, rpcUrl } = getGnosisPublicClient(0);

    try {
      // Try primary RPC (custom/env or first fallback)
      const price = await client.readContract({
        address: GNOSIS_PRICE_ORACLE_ADDRESS as `0x${string}`,
        abi: GNOSIS_PRICE_ORACLE_ABI,
        functionName: 'currentPrice',
      });

      if (price === null || price === undefined) {
        console.log('Oracle returned empty data, using fallback price: 65000');
        setCurrentPrice(BigInt(65000));
        return;
      }

      console.log('Price fetched from oracle:', price);
      setCurrentPrice(BigInt(price));
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(`Primary RPC (${rpcUrl}) failed:`, errorMsg.split('.')[0]);

      // Try with a different RPC as fallback
      try {
        const { client: fallbackClient, rpcUrl: fallbackRpcUrl } = getGnosisPublicClient(1);
        const fallbackPrice = await fallbackClient.readContract({
          address: GNOSIS_PRICE_ORACLE_ADDRESS as `0x${string}`,
          abi: GNOSIS_PRICE_ORACLE_ABI,
          functionName: 'currentPrice',
        });

        console.log('Price fetched from fallback RPC:', fallbackPrice);
        setCurrentPrice(BigInt(fallbackPrice));
      } catch (fallbackError) {
        const { rpcUrl: fallbackRpcUrl } = getGnosisPublicClient(1);
        const fallbackErrorMsg =
          fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
        console.error(`Fallback RPC (${fallbackRpcUrl}) failed:`, fallbackErrorMsg.split('.')[0]);
        console.log('Using final fallback price: 65000');
        setCurrentPrice(BigInt(65000)); // Final fallback price
      }
    }
  }, []);

  useEffect(() => {
    // Execute price fetching when wallet connects
    fetchCurrentPrice();
  }, [isConnected, address, fetchCurrentPrice]);

  const updateSwarmBatchInitialBalance = useCallback(() => {
    if (currentPrice !== null) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration =
        BigInt(initialPaymentPerChunkPerDay) * BigInt(selectedDays || 1);

      // Calculate total amount based on whether this is a top-up or new batch
      let depthToUse: number;

      if (isTopUp && originalStampInfo) {
        // For top-ups, use the original depth from the stamp
        depthToUse = originalStampInfo.depth;
      } else {
        // For new batches, use the selected depth
        depthToUse = selectedDepth;
      }

      const totalAmount = totalPricePerDuration * BigInt(2 ** depthToUse);

      setSwarmConfig(prev => ({
        ...prev,
        swarmBatchInitialBalance: totalPricePerDuration.toString(),
        swarmBatchTotal: totalAmount.toString(),
      }));
    }
  }, [currentPrice, selectedDays, isTopUp, originalStampInfo, selectedDepth]);

  // Move the useEffect that was causing declaration order issues
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
      console.error('Error calculating total cost:', error);
      setTotalUsdAmount(null);
      setSwarmConfig(DEFAULT_SWARM_CONFIG);
    }
  }, [currentPrice, selectedDays, selectedDepth, updateSwarmBatchInitialBalance]);

  const calculateTotalAmount = () => {
    const price = currentPrice || 0n; // Use 0n as default if currentPrice is null
    const initialPaymentPerChunkPerDay = price * 17280n;
    const totalPricePerDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays || 1);

    // Use the appropriate depth based on whether this is a top-up
    let depthToUse: number;

    if (isTopUp && originalStampInfo) {
      // For top-ups, use the original depth from the stamp
      depthToUse = originalStampInfo.depth;
    } else {
      // For new batches, use the selected depth
      depthToUse = selectedDepth;
    }

    return totalPricePerDuration * BigInt(2 ** depthToUse);
  };

  const handleDepthChange = (newDepth: number) => {
    setSelectedDepth(newDepth);
    setSwarmConfig(prev => ({
      ...prev,
      swarmBatchDepth: newDepth.toString(),
    }));
  };

  const handleDirectBzzTransactions = async (updatedConfig: any) => {
    // Ensure we have all needed objects and data
    if (!address || !publicClient || !walletClient) {
      console.error('Missing required objects for direct BZZ transaction');
      return;
    }

    try {
      setStatusMessage({
        step: 'Approval',
        message: 'Approving Token...',
      });

      // Calculate amount based on whether this is a top-up or new batch
      let totalAmount: bigint;

      if (isTopUp && originalStampInfo) {
        // For top-ups, use the original depth from the stamp
        totalAmount = calculateTopUpAmount(originalStampInfo.depth);

        // Update swarmBatchInitialBalance for top-up (price per chunk)
        if (currentPrice !== null && selectedDays) {
          const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
          const pricePerChunkForDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays);
          setSwarmConfig(prev => ({
            ...prev,
            swarmBatchInitialBalance: pricePerChunkForDuration.toString(),
          }));
        }
      } else {
        // For new batches, use the total from updatedConfig
        totalAmount = BigInt(updatedConfig.swarmBatchTotal);
      }

      // Generate specific transaction message based on operation type
      const operationMsg = isTopUp
        ? `Topping up batch ${
            topUpBatchId?.startsWith('0x') ? topUpBatchId.slice(2, 8) : topUpBatchId?.slice(0, 6)
          }...${topUpBatchId?.slice(-4)}`
        : 'Buying storage...';

      // First approve the token transfer
      const approveCallData = {
        address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
        abi: [
          {
            constant: false,
            inputs: [
              { name: '_spender', type: 'address' },
              { name: '_value', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ name: 'success', type: 'bool' }],
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [GNOSIS_CUSTOM_REGISTRY_ADDRESS, totalAmount],
        account: address,
      };

      console.log('Sending approval tx with args:', approveCallData);

      const approveTxHash = await walletClient.writeContract(approveCallData);
      console.log('Approval transaction hash:', approveTxHash);

      // Wait for approval transaction to be mined
      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
      });

      if (approveReceipt.status === 'success') {
        setStatusMessage({
          step: 'Batch',
          message: operationMsg,
        });

        // Prepare contract write parameters - different based on operation type
        let contractWriteParams;

        if (isTopUp && topUpBatchId) {
          // Top up existing batch
          contractWriteParams = {
            address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
            abi: parseAbi(updatedConfig.swarmContractAbi),
            functionName: 'topUpBatch',
            args: [topUpBatchId as `0x${string}`, updatedConfig.swarmBatchInitialBalance],
            account: address,
          };
        } else {
          // Create new batch
          contractWriteParams = {
            address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
            abi: parseAbi(updatedConfig.swarmContractAbi),
            functionName: 'createBatchRegistry',
            args: [
              address,
              nodeAddress,
              updatedConfig.swarmBatchInitialBalance,
              updatedConfig.swarmBatchDepth,
              updatedConfig.swarmBatchBucketDepth,
              updatedConfig.swarmBatchNonce,
              updatedConfig.swarmBatchImmutable,
            ],
            account: address,
          };
        }

        console.log('Creating second transaction with params:', contractWriteParams);

        // Execute the batch creation or top-up
        const batchTxHash = await walletClient.writeContract(contractWriteParams);
        console.log(`${isTopUp ? 'Top up' : 'Create batch'} transaction hash:`, batchTxHash);

        // Wait for batch transaction to be mined
        const batchReceipt = await publicClient.waitForTransactionReceipt({
          hash: batchTxHash,
        });

        if (batchReceipt.status === 'success') {
          if (isTopUp) {
            // For top-up, we already have the batch ID
            console.log('Successfully topped up batch ID:', topUpBatchId);
            setPostageBatchId(topUpBatchId as string);

            // Set top-up completion info
            setTopUpCompleted(true);
            setTopUpInfo({
              batchId: topUpBatchId as string,
              days: selectedDays || 0,
              cost: totalUsdAmount || '0',
            });

            setStatusMessage({
              step: 'Complete',
              message: 'Batch Topped Up Successfully',
              isSuccess: true,
            });
            // Don't set upload step for top-ups
          } else {
            try {
              // Calculate the batch ID for logging
              const calculatedBatchId = readBatchId(
                updatedConfig.swarmBatchNonce,
                GNOSIS_CUSTOM_REGISTRY_ADDRESS
              );

              console.log('Batch created successfully with ID:', calculatedBatchId);

              setStatusMessage({
                step: 'Complete',
                message: 'Storage Bought Successfully',
                isSuccess: true,
              });
              setUploadStep('ready');
            } catch (error) {
              console.error('Failed to process batch completion:', error);
              throw new Error('Failed to process batch completion');
            }
          }
        } else {
          throw new Error(`${isTopUp ? 'Top-up' : 'Batch creation'} failed`);
        }
      } else {
        throw new Error('Approval failed');
      }
    } catch (error) {
      console.error(`Error in direct BZZ transactions: ${error}`);
      setStatusMessage({
        step: 'Error',
        message: 'Transaction failed',
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        isError: true,
      });
    }
  };

  const handleGnosisTokenSwap = async (contractCallsRoute: any, currentConfig: any) => {
    if (!selectedChainId) return;

    setStatusMessage({
      step: 'Route',
      message: 'Executing contract calls...',
    });

    const executedRoute = await executeRoute(contractCallsRoute, {
      disableMessageSigning: DISABLE_MESSAGE_SIGNING,
      acceptExchangeRateUpdateHook: params =>
        handleExchangeRateUpdate(params, setStatusMessage, ACCEPT_EXCHANGE_RATE_UPDATES),
      updateRouteHook: async updatedRoute => {
        console.log('Updated Route:', updatedRoute);
        const status = updatedRoute.steps[0]?.execution?.status;
        console.log(`Status: ${status}`);

        setStatusMessage({
          step: 'Route',
          message: `Status update: ${status?.replace(/_/g, ' ')}`,
        });

        if (status === 'DONE') {
          // Reset timer when done
          resetTimer();

          const txHash = updatedRoute.steps[0]?.execution?.process[0]?.txHash;
          console.log('Created new Batch at trx', txHash);

          try {
            if (isTopUp && topUpBatchId) {
              console.log('Successfully topped up batch ID:', topUpBatchId);
              // Set top-up completion info
              setTopUpCompleted(true);
              setTopUpInfo({
                batchId: topUpBatchId,
                days: selectedDays || 0,
                cost: totalUsdAmount || '0',
              });

              setStatusMessage({
                step: 'Complete',
                message: 'Batch Topped Up Successfully',
                isSuccess: true,
              });
            } else {
              // Calculate the batch ID for logging
              const calculatedBatchId = readBatchId(
                currentConfig.swarmBatchNonce,
                GNOSIS_CUSTOM_REGISTRY_ADDRESS
              );

              console.log('Batch created successfully with ID:', calculatedBatchId);

              setStatusMessage({
                step: 'Complete',
                message: 'Storage Bought Successfully',
                isSuccess: true,
              });
              setUploadStep('ready');
            }
          } catch (error) {
            console.error('Failed to create batch ID:', error);
          }
        } else if (status === 'FAILED') {
          // Use the utility function to generate and update the nonce
          generateAndUpdateNonce(currentConfig, setSwarmConfig);

          console.log('Transaction failed, regenerated nonce for recovery');

          // Reset timer if failed
          resetTimer();
        }
      },
    });
    console.log('Contract calls execution completed:', executedRoute);
  };

  const handleCrossChainSwap = async (
    gnosisContractCallsRoute: any,
    toAmount: any,
    updatedConfig: any
  ) => {
    if (!selectedChainId) return;

    setStatusMessage({
      step: 'Quote',
      message: 'Getting quote...',
    });

    const { crossChainContractCallsRoute } = await performWithRetry(
      () =>
        getCrossChainQuote({
          selectedChainId,
          fromToken,
          address: address as string,
          toAmount,
          gnosisDestinationToken: GNOSIS_DESTINATION_TOKEN,
          setEstimatedTime,
        }),
      'getCrossChainQuote-execution',
      undefined,
      5, // 5 retries
      500 // 500ms delay between retries
    );

    const executedRoute = await executeRoute(crossChainContractCallsRoute, {
      disableMessageSigning: DISABLE_MESSAGE_SIGNING,
      acceptExchangeRateUpdateHook: params =>
        handleExchangeRateUpdate(params, setStatusMessage, ACCEPT_EXCHANGE_RATE_UPDATES),
      updateRouteHook: async crossChainContractCallsRoute => {
        console.log('Updated Route 1:', crossChainContractCallsRoute);
        const step1Status = crossChainContractCallsRoute.steps[0]?.execution?.status;
        console.log(`Step 1 Status: ${step1Status}`);

        setStatusMessage({
          step: 'Route',
          message: `Bridging in progress: ${step1Status?.replace(/_/g, ' ')}.`,
        });

        if (step1Status === 'DONE') {
          console.log('Route 1 wallet client:', walletClient);
          await handleChainSwitch(gnosisContractCallsRoute, updatedConfig);
        } else if (step1Status === 'FAILED') {
          // Add reset if the execution fails
          resetTimer();
        }
      },
    });

    console.log('First route execution completed:', executedRoute);
  };

  const handleChainSwitch = async (contractCallsRoute: any, updatedConfig: any) => {
    console.log('First route completed, triggering chain switch to Gnosis...');

    // Reset the timer when the action completes
    resetTimer();

    setStatusMessage({
      step: 'Switch',
      message: 'First route completed. Switching chain to Gnosis...',
    });

    const unwatch = watchChainId(config, {
      onChange: async chainId => {
        if (chainId === ChainId.DAI) {
          console.log('Detected switch to Gnosis, executing second route...');
          unwatch();

          // Get a fresh wallet client for the new chain
          try {
            const newClient = await getWalletClient(config, { chainId });
            console.log('Route 2 wallet client:', newClient);

            // Update our ref
            currentWalletClientRef.current = newClient;

            await handleGnosisRoute(contractCallsRoute, updatedConfig);
          } catch (error) {
            console.error('Error getting new wallet client:', error);
            // Fall back to using the current wallet client
            await handleGnosisRoute(contractCallsRoute, updatedConfig);
          }
        }
      },
    });

    switchChain({ chainId: ChainId.DAI });
  };

  const handleGnosisRoute = async (contractCallsRoute: any, updatedConfig: any) => {
    setStatusMessage({
      step: 'Route',
      message: 'Chain switched. Executing second route...',
    });

    try {
      const executedRoute2 = await executeRoute(contractCallsRoute, {
        disableMessageSigning: DISABLE_MESSAGE_SIGNING,
        acceptExchangeRateUpdateHook: params =>
          handleExchangeRateUpdate(params, setStatusMessage, ACCEPT_EXCHANGE_RATE_UPDATES),
        updateRouteHook: async contractCallsRoute => {
          console.log('Updated Route 2:', contractCallsRoute);
          const step2Status = contractCallsRoute.steps[0]?.execution?.status;
          console.log(`Step 2 Status: ${step2Status}`);

          setStatusMessage({
            step: 'Route',
            message: `Second route status: ${step2Status?.replace(/_/g, ' ')}`,
          });

          if (step2Status === 'DONE') {
            const txHash =
              contractCallsRoute.steps[0]?.execution?.process[1]?.txHash ||
              contractCallsRoute.steps[0]?.execution?.process[0]?.txHash;
            console.log('Created new Batch at trx', txHash);

            try {
              if (isTopUp && topUpBatchId) {
                console.log('Successfully topped up batch ID:', topUpBatchId);
                // Set top-up completion info
                setTopUpCompleted(true);
                setTopUpInfo({
                  batchId: topUpBatchId,
                  days: selectedDays || 0,
                  cost: totalUsdAmount || '0',
                });

                setStatusMessage({
                  step: 'Complete',
                  message: 'Batch Topped Up Successfully',
                  isSuccess: true,
                });
              } else {
                // Calculate the batch ID for logging
                const calculatedBatchId = readBatchId(
                  updatedConfig.swarmBatchNonce,
                  GNOSIS_CUSTOM_REGISTRY_ADDRESS
                );
                console.log('Batch created successfully with ID:', calculatedBatchId);

                setStatusMessage({
                  step: 'Complete',
                  message: 'Storage Bought Successfully',
                  isSuccess: true,
                });
                setUploadStep('ready');
              }
            } catch (error) {
              console.error('Failed to create batch ID:', error);
            }
          }
        },
      });
      console.log('Second route execution completed:', executedRoute2);
    } catch (error) {
      console.error('Error executing second route:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Error executing second route',
        error: 'Second route execution failed. Check console for details.',
        isError: true,
      });
    }
  };

  const handleSwap = async () => {
    if (!isConnected || !address || !publicClient || !walletClient || selectedChainId === null) {
      console.error('Wallet not connected, clients not available, or chain not selected');
      return;
    }

    // Reset the timer when starting a new transaction
    resetTimer();

    // Use the utility function to generate and update the nonce
    const updatedConfig = generateAndUpdateNonce(swarmConfig, setSwarmConfig);

    // IMPORTANT: Ensure the updatedConfig has the latest calculated values
    // This fixes the BZZ amount mismatch between price estimation and execution
    if (currentPrice !== null && selectedDays) {
      const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
      const totalPricePerDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays);

      // Calculate total amount based on whether this is a top-up or new batch
      let depthToUse: number;
      if (isTopUp && originalStampInfo) {
        // For top-ups, use the original depth from the stamp
        depthToUse = originalStampInfo.depth;
      } else {
        // For new batches, use the selected depth
        depthToUse = selectedDepth;
      }

      const totalAmount = totalPricePerDuration * BigInt(2 ** depthToUse);

      // Update the config with the latest calculated values
      updatedConfig.swarmBatchInitialBalance = totalPricePerDuration.toString();
      updatedConfig.swarmBatchTotal = totalAmount.toString();
      updatedConfig.swarmBatchDepth = depthToUse.toString();
    }

    // For new batches (not top-ups), create the batch ID once here
    if (!isTopUp && address) {
      try {
        // Calculate and log the batch ID for this transaction
        const calculatedBatchId = readBatchId(
          updatedConfig.swarmBatchNonce,
          GNOSIS_CUSTOM_REGISTRY_ADDRESS
        );

        // Also call createBatchId to set the state (fire and forget)
        createBatchId(
          updatedConfig.swarmBatchNonce,
          GNOSIS_CUSTOM_REGISTRY_ADDRESS,
          setPostageBatchId
        )
          .then(stateBasedBatchId => {
            console.log('State-based batch ID from createBatchId:', stateBasedBatchId);
          })
          .catch(error => {
            console.error('Error in createBatchId for state:', error);
          });
      } catch (error) {
        console.error('Failed to pre-calculate batch ID:', error);
      }
    }

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('idle');
    setStatusMessage({
      step: 'Initialization',
      message: 'Preparing transaction...',
    });

    try {
      // Find the token in available tokens
      const selectedToken = availableTokens?.tokens[selectedChainId]?.find(token => {
        try {
          return toChecksumAddress(token.address) === toChecksumAddress(fromToken);
        } catch (error) {
          console.error('Error comparing token addresses:', error);
          return false;
        }
      });

      if (!selectedToken || !selectedToken.address) {
        throw new Error('Selected token not found');
      }

      setStatusMessage({
        step: 'Calculation',
        message: 'Calculating amounts...',
      });

      // Deciding if we are buying stamps directly or swaping/bridging
      if (
        selectedChainId !== null &&
        selectedChainId === ChainId.DAI &&
        getAddress(fromToken) === getAddress(GNOSIS_BZZ_ADDRESS)
      ) {
        await handleDirectBzzTransactions(updatedConfig);
      } else {
        setStatusMessage({
          step: 'Quoting',
          message: 'Getting Relay quote...',
        });

        // Use the new Relay system for execution
        const relayQuoteResult = await getRelaySwapQuotes({
          selectedChainId,
          fromToken,
          address,
          bzzAmount: updatedConfig.swarmBatchTotal,
          nodeAddress,
          swarmConfig: updatedConfig,
          topUpBatchId: isTopUp ? topUpBatchId || undefined : undefined,
          setEstimatedTime,
          isForEstimation: false,
        });

        console.log('✅ Relay execution quotes ready:', {
          totalUSD: `$${relayQuoteResult.totalAmountUSD.toFixed(2)}`,
          steps: relayQuoteResult.steps.length,
          estimatedTime: relayQuoteResult.estimatedTime,
        });

        // Execute Relay steps
        await executeRelaySteps(
          relayQuoteResult.relayQuoteResponse,
          walletClient,
          publicClient,
          setStatusMessage
        );

        console.log('🎉 Relay swap completed successfully!');

        // Reset timer when done
        resetTimer();

        // Handle post-swap completion flow (same as original LiFi implementation)
        try {
          if (isTopUp && topUpBatchId) {
            console.log('Successfully topped up batch ID:', topUpBatchId);
            setPostageBatchId(topUpBatchId);

            // Set top-up completion info
            setTopUpCompleted(true);
            setTopUpInfo({
              batchId: topUpBatchId,
              days: selectedDays || 0,
              cost: totalUsdAmount || '0',
            });

            setStatusMessage({
              step: 'Complete',
              message: 'Batch Topped Up Successfully',
              isSuccess: true,
            });
          } else {
            // Calculate the batch ID for new batch creation
            const calculatedBatchId = readBatchId(
              updatedConfig.swarmBatchNonce,
              GNOSIS_CUSTOM_REGISTRY_ADDRESS
            );

            console.log('Batch created successfully with ID:', calculatedBatchId);
            setPostageBatchId(calculatedBatchId);

            setStatusMessage({
              step: 'Complete',
              message: 'Storage Bought Successfully',
              isSuccess: true,
            });

            // Transition to upload step - this was missing!
            setUploadStep('ready');
          }
        } catch (error) {
          console.error('Failed to process batch completion:', error);
          setStatusMessage({
            step: 'Error',
            message: 'Failed to process batch completion',
            error: error instanceof Error ? error.message : 'Unknown error',
            isError: true,
          });
        }
      }
    } catch (error) {
      console.error('An error occurred:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Execution failed',
        error: formatErrorMessage(error),
        isError: true,
      });
    }
  };

  const handleGetStarted = () => {
    if (openConnectModal) {
      openConnectModal();
    }
  };

  const saveUploadReference = (
    reference: string,
    postageBatchId: string,
    expiryDate: number,
    filename?: string,
    isWebpageUpload?: boolean
  ) => {
    if (!address) return;

    const savedHistory = localStorage.getItem('uploadHistory');
    const history = savedHistory ? JSON.parse(savedHistory) : {};

    const addressHistory = history[address] || [];
    addressHistory.unshift({
      reference,
      timestamp: Date.now(),
      filename,
      stampId: postageBatchId,
      expiryDate,
      isWebpageUpload,
    });

    history[address] = addressHistory;
    localStorage.setItem('uploadHistory', JSON.stringify(history));
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Helper function to get total size of selected files
  const getTotalFileSize = (): number => {
    if (isMultipleFiles) {
      return selectedFiles.reduce((total, file) => total + file.size, 0);
    } else {
      return selectedFile?.size || 0;
    }
  };

  // Helper function to check if files are very large
  const hasVeryLargeFiles = (): boolean => {
    const threshold = FILE_SIZE_CONFIG.largeFileThresholdGB * 1024 * 1024 * 1024;
    if (isMultipleFiles) {
      return selectedFiles.some(file => file.size > threshold);
    } else {
      return (selectedFile?.size || 0) > threshold;
    }
  };

  const handleFileUpload = async () => {
    if (isMultipleFiles && selectedFiles.length > 0) {
      return handleMultipleFileUpload();
    }

    if (!selectedFile || !postageBatchId || !walletClient || !publicClient) {
      console.error('Missing file, postage batch ID, or wallet');
      console.log('selectedFile', selectedFile);
      console.log('postageBatchId', postageBatchId);
      console.log('walletClient', walletClient);
      console.log('publicClient', publicClient);
      return;
    }

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');

    // Handle NFT Collection uploads
    if (isNFTCollection && selectedFile.name.toLowerCase().endsWith('.zip')) {
      try {
        const result = await processNFTCollection({
          zipFile: selectedFile,
          postageBatchId,
          walletClient,
          publicClient,
          address,
          beeApiUrl,
          setProgress: setUploadProgress,
          setStatusMessage: (message: string) =>
            setStatusMessage({
              step: 'Uploading',
              message: message,
            }),
        });

        setNftCollectionResult(result);

        // Save both references to history
        const expiryDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days default
        saveUploadReference(
          result.imagesReference,
          postageBatchId,
          expiryDate,
          'images.tar',
          false
        );
        saveUploadReference(
          result.metadataReference,
          postageBatchId,
          expiryDate,
          'metadata.tar',
          false
        );

        setStatusMessage({
          step: 'Complete',
          message: `NFT Collection uploaded successfully! ${result.totalImages} images and ${result.totalMetadata} metadata files processed.`,
          isSuccess: true,
          reference: result.metadataReference,
          filename: selectedFile.name,
        });

        setUploadStep('complete');
        setSelectedDays(null);
        setTimeout(() => {
          setUploadStep('idle');
          setShowOverlay(false);
          setIsLoading(false);
          setUploadProgress(0);
          setIsDistributing(false);
        }, 900000);

        return;
      } catch (error) {
        console.error('NFT Collection upload error:', error);
        setStatusMessage({
          step: 'Error',
          message: 'NFT Collection upload failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          isError: true,
        });
        setUploadStep('idle');
        setUploadProgress(0);
        setIsDistributing(false);
        return;
      }
    }

    const maxRetries = UPLOAD_RETRY_CONFIG.maxRetries;

    // Retry wrapper for single file upload
    for (let retryCount = 0; retryCount <= maxRetries; retryCount++) {
      try {
        await uploadFile({
          selectedFile,
          postageBatchId,
          walletClient,
          publicClient,
          address,
          beeApiUrl,
          serveUncompressed,
          isTarFile,
          isWebpageUpload,
          setUploadProgress,
          setStatusMessage,
          setIsDistributing,
          setUploadStep,
          setSelectedDays,
          setShowOverlay,
          setIsLoading,
          setUploadStampInfo,
          saveUploadReference,
        });
        return; // Success, exit the function
      } catch (error) {
        console.error(`Upload attempt ${retryCount + 1} failed:`, error);

        if (retryCount < maxRetries && error instanceof Error) {
          const isRetryableError = UPLOAD_RETRY_CONFIG.retryableErrors.some(errorType =>
            error.message.includes(errorType)
          );

          if (isRetryableError) {
            console.log(`Retrying single file upload (${retryCount + 1}/${maxRetries})`);
            setStatusMessage({
              step: 'Uploading',
              message: `Retrying upload (attempt ${retryCount + 2}/${maxRetries + 1})...`,
            });

            // Wait before retrying (configurable delay)
            await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_CONFIG.retryDelayMs));
            continue; // Try again
          }
        }

        // If not retryable or max retries reached, show error
        console.error('Upload error:', error);
        setStatusMessage({
          step: 'Error',
          message: 'Upload failed',
          error: error instanceof Error ? error.message : 'Unknown error',
          isError: true,
        });
        setUploadStep('idle');
        setUploadProgress(0);
        setIsDistributing(false);
        return;
      }
    }
  };

  const handleMultipleFileUpload = async () => {
    if (!selectedFiles.length || !postageBatchId || !walletClient || !publicClient) {
      console.error('Missing files, postage batch ID, or wallet');
      return;
    }

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');
    setMultiFileResults([]);

    try {
      await handleMultiFileUpload({
        selectedFiles,
        postageBatchId,
        walletClient,
        publicClient,
        address,
        beeApiUrl,
        serveUncompressed,
        setUploadProgress,
        setStatusMessage,
        setIsDistributing,
        setUploadStep,
        setSelectedDays,
        setShowOverlay,
        setIsLoading,
        setUploadStampInfo,
        saveUploadReference,
        setMultiFileResults,
      });
    } catch (error) {
      console.error('Multi-file upload error:', error);
      setStatusMessage({
        step: 'Error',
        message: 'Multi-file upload failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        isError: true,
      });
      setUploadStep('idle');
      setUploadProgress(0);
      setIsDistributing(false);
    }
  };

  const handleOpenDropdown = (dropdownName: string) => {
    setActiveDropdown(dropdownName);
  };

  const handleTokenSelect = (address: string, token: any) => {
    console.log('Token manually selected:', address, token?.symbol);

    // Only reset duration if this is a user-initiated token change (not during initial loading)
    if (fromToken && address !== fromToken) {
      console.log('Resetting duration due to token change');
      setSelectedDays(null);
      setTotalUsdAmount(null);
      setInsufficientFunds(false);
      setLiquidityError(false);
      setAggregatorDown(false);
      setIsPriceEstimating(false);
    }

    setFromToken(address);
    setSelectedTokenInfo(token);
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

  // Add a new state variable to the component
  const [uploadStampInfo, setUploadStampInfo] = useState<StampInfo | null>(null);

  // originalStampInfo state declaration moved to the top with other state declarations

  // This useEffect will be moved after fetchStampInfo declaration

  // Modified URL parameter parsing to also check for hash fragments
  useEffect(() => {
    // Only run on client-side
    if (typeof window !== 'undefined') {
      // First check query parameters
      const url = new URL(window.location.href);
      const stampParam = url.searchParams.get('topup');

      // Then check hash fragments (e.g., #topup=batchId)
      const hash = window.location.hash;
      const hashMatch = hash.match(/^#topup=([a-fA-F0-9]+)$/);

      if (stampParam) {
        // Format with 0x prefix for contract call
        const formattedBatchId = stampParam.startsWith('0x') ? stampParam : `0x${stampParam}`;
        console.log(`Found stamp ID in URL query: ${formattedBatchId}`);
        setTopUpBatchId(formattedBatchId);
        setIsTopUp(true);
      } else if (hashMatch && hashMatch[1]) {
        // Format with 0x prefix for contract call
        const hashBatchId = hashMatch[1];
        const formattedBatchId = hashBatchId.startsWith('0x') ? hashBatchId : `0x${hashBatchId}`;
        console.log(`Found stamp ID in URL hash: ${formattedBatchId}`);
        setTopUpBatchId(formattedBatchId);
        setIsTopUp(true);
      }
    }
  }, []); // Only run once on mount

  // Function to fetch stamp information for a given batchId
  const fetchStampInfoForComponent = useCallback(
    async (batchId: string): Promise<StampInfo | null> => {
      return await fetchStampInfo(batchId, beeApiUrl);
    },
    [beeApiUrl]
  );

  // Add this effect to fetch stamp info when topUpBatchId is set
  useEffect(() => {
    // Only fetch if we have a topUpBatchId and we're in top-up mode
    if (topUpBatchId && isTopUp) {
      const getStampInfo = async () => {
        const stampInfo = await fetchStampInfoForComponent(topUpBatchId);
        if (stampInfo) {
          console.log('Fetched original stamp info:', stampInfo);
          setOriginalStampInfo(stampInfo);

          // Update the depth to match the original stamp
          setSelectedDepth(stampInfo.depth);

          // Lock the depth to the original value since we can't change it for top-ups
          setSwarmConfig(prev => ({
            ...prev,
            swarmBatchDepth: stampInfo.depth.toString(),
          }));
        }
      };

      getStampInfo();
    }
  }, [topUpBatchId, isTopUp, fetchStampInfoForComponent]);

  // Calculate amount for topping up an existing batch
  const calculateTopUpAmount = (originalDepth: number) => {
    if (currentPrice === null || !selectedDays) return 0n;

    // We use the original depth from the stamp, not the currently selected depth
    const initialPaymentPerChunkPerDay = BigInt(currentPrice) * BigInt(17280);
    const totalPricePerDuration = initialPaymentPerChunkPerDay * BigInt(selectedDays);

    // Calculate for the original batch depth
    return totalPricePerDuration * BigInt(2 ** originalDepth);
  };

  // Add useEffect to set hasMounted after component mounts
  useEffect(() => {
    setHasMounted(true);
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.betaBadge}>BETA</div>
      <div className={styles.tabContainer}>
        <button
          className={`${styles.tabButton} ${
            !showHelp && !showStampList && !showUploadHistory ? styles.activeTab : ''
          }`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(false);
          }}
        >
          {isTopUp ? 'Top Up' : 'Buy'}
        </button>
        <button
          className={`${styles.tabButton} ${showStampList ? styles.activeTab : ''}`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(true);
            setShowUploadHistory(false);
          }}
        >
          Stamps
        </button>
        <button
          className={`${styles.tabButton} ${showUploadHistory ? styles.activeTab : ''}`}
          onClick={() => {
            setShowHelp(false);
            setShowStampList(false);
            setShowUploadHistory(true);
          }}
        >
          History
        </button>
        <button
          className={`${styles.tabButton} ${showHelp ? styles.activeTab : ''}`}
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
            <label className={styles.label} data-tooltip="Select chain with funds">
              From chain
            </label>
            <SearchableChainDropdown
              selectedChainId={selectedChainId || ChainId.DAI}
              availableChains={availableChains}
              onChainSelect={chainId => {
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
            <label className={styles.label} data-tooltip="Select token you want to spend">
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
              availableTokens={availableTokens}
              onTokenSelect={handleTokenSelect}
              minBalanceUsd={MIN_TOKEN_BALANCE_USD}
              activeDropdown={activeDropdown}
              onOpenDropdown={handleOpenDropdown}
            />
          </div>

          {!isTopUp && (
            <div className={styles.inputGroup}>
              <label
                className={styles.label}
                data-tooltip="Storage stamps are used to pay to store and host data in Swarm"
              >
                Storage stamps
              </label>
              <StorageStampsDropdown
                storageOptions={STORAGE_OPTIONS}
                selectedDepth={selectedDepth}
                onDepthChange={handleDepthChange}
                disabled={isLoading}
              />
            </div>
          )}

          <div className={styles.inputGroup}>
            <label
              className={styles.label}
              data-tooltip="Duration of storage stamps for which you are paying for"
            >
              {isTopUp ? 'Additional duration' : 'Storage duration'}
            </label>
            <StorageDurationDropdown
              timeOptions={TIME_OPTIONS}
              selectedDays={selectedDays}
              onDaysChange={setSelectedDays}
              disabled={isLoading}
              placeholder={isTopUp ? 'Please select additional duration' : 'Please select duration'}
            />
          </div>

          {selectedDays && totalUsdAmount !== null && Number(totalUsdAmount) !== 0 && (
            <p className={styles.priceInfo}>
              {aggregatorDown
                ? 'LIFI Router Error: Please try later'
                : liquidityError
                  ? 'Not enough liquidity for this swap'
                  : insufficientFunds
                    ? `Cost ($${Number(totalUsdAmount).toFixed(2)}) exceeds your balance`
                    : `Cost without gas ~ $${Number(totalUsdAmount).toFixed(2)}`}
            </p>
          )}

          <button
            className={`${styles.button} ${
              !isConnected
                ? ''
                : !selectedDays ||
                    !fromToken ||
                    liquidityError ||
                    aggregatorDown ||
                    insufficientFunds
                  ? styles.buttonDisabled
                  : ''
            } ${isPriceEstimating ? styles.calculatingButton : ''}`}
            disabled={
              isConnected &&
              (!selectedDays ||
                !fromToken ||
                liquidityError ||
                aggregatorDown ||
                insufficientFunds ||
                isPriceEstimating)
            }
            onClick={!hasMounted || !isConnected ? handleGetStarted : handleSwap}
          >
            {isLoading ? (
              <div>Loading...</div>
            ) : !hasMounted || !isConnected ? (
              'Get Started'
            ) : !selectedDays ? (
              'Choose Timespan'
            ) : !fromToken ? (
              'No Token Available'
            ) : isPriceEstimating ? (
              'Calculating Cost...'
            ) : aggregatorDown ? (
              'LIFI Router Error: Please try later'
            ) : liquidityError ? (
              "Cannot Swap - Can't Find Route"
            ) : insufficientFunds ? (
              'Insufficient Balance'
            ) : isTopUp ? (
              'Top Up Batch'
            ) : (
              'Execute Swap'
            )}
          </button>

          {executionResult && (
            <pre className={styles.resultBox}>{JSON.stringify(executionResult, null, 2)}</pre>
          )}

          {(isLoading || (showOverlay && uploadStep !== 'idle')) && (
            <div className={styles.overlay}>
              <div
                className={`${styles.statusBox} ${statusMessage.isSuccess ? styles.success : ''}`}
              >
                {/* Always show close button */}
                <button
                  className={styles.closeButton}
                  onClick={() => {
                    setShowOverlay(false);
                    setStatusMessage({ step: '', message: '' });
                    setUploadStep('idle');
                    setIsLoading(false);
                    setExecutionResult(null);
                    setSelectedFile(null);
                    setSelectedFiles([]);
                    setIsMultipleFiles(false);
                    setMultiFileResults([]);
                    setIsWebpageUpload(false);
                    setIsTarFile(false);
                    setIsDistributing(false);
                  }}
                >
                  ×
                </button>

                {!['ready', 'uploading'].includes(uploadStep) && (
                  <>
                    {isLoading && statusMessage.step !== 'Complete' && (
                      <div className={styles.spinner}></div>
                    )}
                    <div className={styles.statusMessage}>
                      <h3 className={statusMessage.isSuccess ? styles.success : ''}>
                        {statusMessage.message}
                      </h3>
                      {statusMessage.error && (
                        <div className={styles.errorMessage}>{statusMessage.error}</div>
                      )}

                      {remainingTime !== null &&
                        estimatedTime !== null &&
                        statusMessage.step === 'Route' && (
                          <div className={styles.bridgeTimer}>
                            <p>Estimated time remaining: {formatTime(remainingTime)}</p>
                            <div className={styles.progressBarContainer}>
                              <div
                                className={styles.progressBar}
                                style={{
                                  width: `${Math.max(
                                    0,
                                    Math.min(100, (1 - remainingTime / estimatedTime) * 100)
                                  )}%`,
                                }}
                              />
                            </div>
                          </div>
                        )}
                    </div>
                  </>
                )}

                {['ready', 'uploading'].includes(uploadStep) && (
                  <div className={styles.uploadBox}>
                    <h3 className={styles.uploadTitle}>
                      {postageBatchId
                        ? `Upload to ${
                            postageBatchId.startsWith('0x')
                              ? postageBatchId.slice(2, 8)
                              : postageBatchId.slice(0, 6)
                          }...${postageBatchId.slice(-4)}`
                        : 'Upload File'}
                    </h3>
                    <div className={styles.uploadWarning}>
                      Warning! Upload data is public and can not be removed from the Swarm network
                    </div>
                    {statusMessage.step === 'waiting_creation' ||
                    statusMessage.step === 'waiting_usable' ? (
                      <div className={styles.waitingMessage}>
                        <div className={styles.spinner}></div>
                        <p>{statusMessage.message}</p>
                      </div>
                    ) : (
                      <div className={styles.uploadForm}>
                        <div className={styles.checkboxWrapper}>
                          <input
                            type="checkbox"
                            id="multiple-files"
                            checked={isMultipleFiles}
                            onChange={e => {
                              setIsMultipleFiles(e.target.checked);
                              // Reset selections when switching modes
                              setSelectedFile(null);
                              setSelectedFiles([]);
                            }}
                            className={styles.checkbox}
                            disabled={uploadStep === 'uploading'}
                          />
                          <label htmlFor="multiple-files" className={styles.checkboxLabel}>
                            Upload multiple files
                          </label>
                        </div>

                        <div className={styles.fileInputWrapper}>
                          <input
                            type="file"
                            multiple={isMultipleFiles}
                            onChange={e => {
                              if (isMultipleFiles) {
                                const files = Array.from(e.target.files || []);
                                setSelectedFiles(files);
                                setSelectedFile(null);
                              } else {
                                const file = e.target.files?.[0] || null;
                                setSelectedFile(file);
                                setSelectedFiles([]);
                                setIsTarFile(
                                  (file?.name.toLowerCase().endsWith('.tar') ||
                                    file?.name.toLowerCase().endsWith('.zip') ||
                                    file?.name.toLowerCase().endsWith('.gz')) ??
                                    false
                                );
                              }
                            }}
                            className={styles.fileInput}
                            disabled={uploadStep === 'uploading'}
                            id="file-upload"
                          />
                          <label htmlFor="file-upload" className={styles.fileInputLabel}>
                            {isMultipleFiles
                              ? selectedFiles.length > 0
                                ? `${selectedFiles.length} files selected`
                                : 'Choose files'
                              : selectedFile
                                ? selectedFile.name
                                : 'Choose file'}
                          </label>
                        </div>

                        {isMultipleFiles && selectedFiles.length > 0 && (
                          <div className={styles.fileList}>
                            <h4>Selected files:</h4>
                            <ul>
                              {selectedFiles.map((file, index) => (
                                <li key={index} className={styles.fileName}>
                                  {file.name} ({formatFileSize(file.size)})
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* File size warnings */}
                        {(selectedFile || selectedFiles.length > 0) && (
                          <div className={styles.fileSizeInfo}>
                            <div className={styles.fileSizeTotal}>
                              Total size: {formatFileSize(getTotalFileSize())}
                            </div>
                            {hasVeryLargeFiles() && (
                              <div className={styles.largeFileWarning}>
                                ⚠️ Large files detected ({'>'}2GB). Upload may take several hours.
                                Please ensure stable internet connection and keep this tab open.
                              </div>
                            )}
                            {getTotalFileSize() > 10 * 1024 * 1024 * 1024 && (
                              <div className={styles.veryLargeFileWarning}>
                                🚨 Very large total size ({'>'}10GB). Consider uploading in smaller
                                batches to reduce timeout risk.
                              </div>
                            )}
                          </div>
                        )}

                        {!isMultipleFiles &&
                          (selectedFile?.name.toLowerCase().endsWith('.zip') ||
                            selectedFile?.name.toLowerCase().endsWith('.gz')) && (
                            <div className={styles.checkboxWrapper}>
                              <input
                                type="checkbox"
                                id="serve-uncompressed"
                                checked={serveUncompressed}
                                onChange={e => setServeUncompressed(e.target.checked)}
                                className={styles.checkbox}
                                disabled={uploadStep === 'uploading'}
                              />
                              <label htmlFor="serve-uncompressed" className={styles.checkboxLabel}>
                                Serve uncompressed
                              </label>
                            </div>
                          )}

                        {!isMultipleFiles && isTarFile && (
                          <div className={styles.checkboxWrapper}>
                            <input
                              type="checkbox"
                              id="webpage-upload"
                              checked={isWebpageUpload}
                              onChange={e => setIsWebpageUpload(e.target.checked)}
                              className={styles.checkbox}
                              disabled={uploadStep === 'uploading'}
                            />
                            <label htmlFor="webpage-upload" className={styles.checkboxLabel}>
                              Upload as webpage
                            </label>
                          </div>
                        )}

                        {!isMultipleFiles && selectedFile?.name.toLowerCase().endsWith('.zip') && (
                          <div className={styles.checkboxWrapper}>
                            <input
                              type="checkbox"
                              id="nft-collection"
                              checked={isNFTCollection}
                              onChange={e => setIsNFTCollection(e.target.checked)}
                              className={styles.checkbox}
                              disabled={uploadStep === 'uploading'}
                            />
                            <label htmlFor="nft-collection" className={styles.checkboxLabel}>
                              Upload NFT collection
                              <span
                                className={styles.tooltip}
                                title="Upload a ZIP file containing 'images' and 'json' folders. Images will be uploaded separately, and JSON metadata will be updated with bzz.link URLs pointing to the uploaded images."
                              >
                                ?
                              </span>
                            </label>
                          </div>
                        )}

                        <button
                          onClick={handleFileUpload}
                          disabled={
                            (isMultipleFiles ? selectedFiles.length === 0 : !selectedFile) ||
                            uploadStep === 'uploading'
                          }
                          className={styles.uploadButton}
                        >
                          {uploadStep === 'uploading' ? (
                            <>
                              <div className={styles.smallSpinner}></div>
                              {statusMessage.step === '404'
                                ? 'Searching for batch ID...'
                                : statusMessage.step === '422'
                                  ? 'Waiting for batch to be usable...'
                                  : statusMessage.step === 'Uploading'
                                    ? isDistributing
                                      ? 'Distributing file chunks...'
                                      : `Uploading... ${uploadProgress.toFixed(1)}%`
                                    : 'Processing...'}
                            </>
                          ) : isMultipleFiles ? (
                            `Upload ${selectedFiles.length} files`
                          ) : (
                            'Upload'
                          )}
                        </button>
                        {uploadStep === 'uploading' && (
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
                                <div className={`${styles.node} ${styles.node1}`}></div>
                                <div className={`${styles.node} ${styles.node2}`}></div>
                                <div className={`${styles.node} ${styles.node3}`}></div>
                                <div className={`${styles.node} ${styles.node4}`}></div>
                                <div className={`${styles.node} ${styles.node5}`}></div>
                                <div className={`${styles.node} ${styles.node6}`}></div>
                                <div className={`${styles.node} ${styles.node7}`}></div>
                                <div className={`${styles.node} ${styles.node8}`}></div>

                                {/* Chunks being distributed */}
                                <div className={`${styles.chunk} ${styles.chunk1}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk2}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk3}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk4}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk5}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk6}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk7}`}></div>
                                <div className={`${styles.chunk} ${styles.chunk8}`}></div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {uploadStep === 'complete' && (
                  <div className={styles.successMessage}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>{isMultipleFiles ? `Upload Complete!` : 'Upload Successful!'}</h3>

                    {isMultipleFiles && multiFileResults.length > 0 ? (
                      <div className={styles.multiFileResults}>
                        {multiFileResults.map((result, index) => (
                          <div
                            key={index}
                            className={`${styles.fileResult} ${result.success ? styles.success : styles.error}`}
                          >
                            <div className={styles.fileResultHeader}>
                              <span className={styles.fileResultName}>{result.filename}</span>
                              <span
                                className={`${styles.fileResultStatus} ${result.success ? styles.success : styles.error}`}
                              >
                                {result.success ? 'Success' : 'Failed'}
                              </span>
                            </div>
                            {result.success && result.reference && (
                              <div
                                className={styles.fileResultReference}
                                onClick={() => {
                                  navigator.clipboard.writeText(result.reference);
                                }}
                                title="Click to copy reference"
                              >
                                {result.reference}
                              </div>
                            )}
                            {!result.success && result.error && (
                              <div className={styles.fileResultError}>{result.error}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : nftCollectionResult ? (
                      // NFT Collection upload success
                      <div className={styles.nftCollectionResults}>
                        <div className={styles.nftCollectionSummary}>
                          <h4>NFT Collection Uploaded Successfully!</h4>
                          <p>
                            {nftCollectionResult.totalImages} images and{' '}
                            {nftCollectionResult.totalMetadata} metadata files processed
                          </p>
                        </div>

                        <div className={styles.nftReferenceGroup}>
                          <div className={styles.referenceBox}>
                            <p>
                              <strong>Images Reference:</strong>
                            </p>
                            <div className={styles.referenceCopyWrapper}>
                              <code
                                className={styles.referenceCode}
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    nftCollectionResult.imagesReference
                                  );
                                  const codeEl = document.querySelectorAll(
                                    `.${styles.referenceCode}`
                                  )[0];
                                  if (codeEl) {
                                    codeEl.setAttribute('data-copied', 'true');
                                    setTimeout(() => {
                                      codeEl.setAttribute('data-copied', 'false');
                                    }, 2000);
                                  }
                                }}
                                data-copied="false"
                              >
                                {nftCollectionResult.imagesReference}
                              </code>
                            </div>
                            <div className={styles.linkButtonsContainer}>
                              <button
                                className={`${styles.referenceLink} ${styles.copyLinkButton}`}
                                onClick={() => {
                                  const url = `${BEE_GATEWAY_URL}${nftCollectionResult.imagesReference}/`;
                                  navigator.clipboard.writeText(url);
                                  const button = document.querySelectorAll(
                                    `.${styles.copyLinkButton}`
                                  )[0];
                                  if (button) {
                                    const originalText = button.textContent;
                                    button.textContent = 'Link copied!';
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                    }, 2000);
                                  }
                                }}
                              >
                                Copy images link
                              </button>
                              <a
                                href={`${BEE_GATEWAY_URL}${nftCollectionResult.imagesReference}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.referenceLink}
                              >
                                View images
                              </a>
                            </div>
                          </div>

                          <div className={styles.referenceBox}>
                            <p>
                              <strong>Metadata Reference:</strong>
                            </p>
                            <div className={styles.referenceCopyWrapper}>
                              <code
                                className={styles.referenceCode}
                                onClick={() => {
                                  navigator.clipboard.writeText(
                                    nftCollectionResult.metadataReference
                                  );
                                  const codeEl = document.querySelectorAll(
                                    `.${styles.referenceCode}`
                                  )[1];
                                  if (codeEl) {
                                    codeEl.setAttribute('data-copied', 'true');
                                    setTimeout(() => {
                                      codeEl.setAttribute('data-copied', 'false');
                                    }, 2000);
                                  }
                                }}
                                data-copied="false"
                              >
                                {nftCollectionResult.metadataReference}
                              </code>
                            </div>
                            <div className={styles.linkButtonsContainer}>
                              <button
                                className={`${styles.referenceLink} ${styles.copyLinkButton}`}
                                onClick={() => {
                                  const url = `${BEE_GATEWAY_URL}${nftCollectionResult.metadataReference}/`;
                                  navigator.clipboard.writeText(url);
                                  const button = document.querySelectorAll(
                                    `.${styles.copyLinkButton}`
                                  )[1];
                                  if (button) {
                                    const originalText = button.textContent;
                                    button.textContent = 'Link copied!';
                                    setTimeout(() => {
                                      button.textContent = originalText;
                                    }, 2000);
                                  }
                                }}
                              >
                                Copy metadata link
                              </button>
                              <a
                                href={`${BEE_GATEWAY_URL}${nftCollectionResult.metadataReference}/`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={styles.referenceLink}
                              >
                                View metadata
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      // Single file upload success
                      <div className={styles.referenceBox}>
                        <p>Reference:</p>
                        <div className={styles.referenceCopyWrapper}>
                          <code
                            className={styles.referenceCode}
                            onClick={() => {
                              navigator.clipboard.writeText(statusMessage.reference || '');
                              // Show a temporary "Copied!" message by using a data attribute
                              const codeEl = document.querySelector(`.${styles.referenceCode}`);
                              if (codeEl) {
                                codeEl.setAttribute('data-copied', 'true');
                                setTimeout(() => {
                                  codeEl.setAttribute('data-copied', 'false');
                                }, 2000);
                              }
                            }}
                            data-copied="false"
                          >
                            {statusMessage.reference}
                          </code>
                        </div>
                        <div className={styles.linkButtonsContainer}>
                          <button
                            className={`${styles.referenceLink} ${styles.copyLinkButton}`}
                            onClick={() => {
                              const url =
                                statusMessage.filename && !isArchiveFile(statusMessage.filename)
                                  ? `${BEE_GATEWAY_URL}${statusMessage.reference}/${statusMessage.filename}`
                                  : `${BEE_GATEWAY_URL}${statusMessage.reference}/`;
                              navigator.clipboard.writeText(url);

                              // Show a temporary message using a more specific selector
                              const button = document.querySelector(`.${styles.copyLinkButton}`);
                              if (button) {
                                const originalText = button.textContent;
                                button.textContent = 'Link copied!';
                                setTimeout(() => {
                                  button.textContent = originalText;
                                }, 2000);
                              }
                            }}
                          >
                            Copy link
                          </button>
                          <a
                            href={
                              statusMessage.filename && !isArchiveFile(statusMessage.filename)
                                ? `${BEE_GATEWAY_URL}${statusMessage.reference}/${statusMessage.filename}`
                                : `${BEE_GATEWAY_URL}${statusMessage.reference}/`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.referenceLink}
                          >
                            Open link
                          </a>
                        </div>
                      </div>
                    )}

                    {uploadStampInfo && (
                      <div className={styles.stampInfoBox}>
                        <h4>Storage Stamps Details</h4>
                        <div className={styles.stampDetails}>
                          <div className={styles.stampDetail}>
                            <span>Utilization:</span>
                            <span>{uploadStampInfo.utilizationPercent?.toFixed(2) || 0}%</span>
                          </div>
                          <div className={styles.stampDetail}>
                            <span>Total Size:</span>
                            <span>{uploadStampInfo.totalSize}</span>
                          </div>
                          <div className={styles.stampDetail}>
                            <span>Remaining:</span>
                            <span>{uploadStampInfo.remainingSize}</span>
                          </div>
                          <div className={styles.stampDetail}>
                            <span>Expires in:</span>
                            <span>{Math.floor(uploadStampInfo.batchTTL / 86400)} days</span>
                          </div>
                        </div>
                        <div className={styles.utilizationBarContainer}>
                          <div
                            className={styles.utilizationBar}
                            style={{
                              width: `${uploadStampInfo.utilizationPercent?.toFixed(2) || 0}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    )}

                    <button
                      className={styles.closeSuccessButton}
                      onClick={() => {
                        setShowOverlay(false);
                        setUploadStep('idle');
                        setStatusMessage({ step: '', message: '' });
                        setIsLoading(false);
                        setExecutionResult(null);
                        setSelectedFile(null);
                        setSelectedFiles([]);
                        setIsMultipleFiles(false);
                        setMultiFileResults([]);
                        setIsWebpageUpload(false);
                        setIsTarFile(false);
                        setIsDistributing(false);
                        setUploadStampInfo(null);
                        setIsNFTCollection(false);
                        setNftCollectionResult(null);
                      }}
                    >
                      Close
                    </button>
                  </div>
                )}

                {topUpCompleted && (
                  <div className={styles.successMessage}>
                    <div className={styles.successIcon}>✓</div>
                    <h3>Batch Topped Up Successfully!</h3>
                    <div className={styles.referenceBox}>
                      <p>Batch ID:</p>
                      <div className={styles.referenceCopyWrapper}>
                        <code
                          className={styles.referenceCode}
                          onClick={() => {
                            navigator.clipboard.writeText(topUpInfo?.batchId || '');
                            // Show a temporary "Copied!" message
                            const codeEl = document.querySelector(`.${styles.referenceCode}`);
                            if (codeEl) {
                              codeEl.setAttribute('data-copied', 'true');
                              setTimeout(() => {
                                codeEl.setAttribute('data-copied', 'false');
                              }, 2000);
                            }
                          }}
                          data-copied="false"
                        >
                          {topUpInfo?.batchId}
                        </code>
                      </div>
                    </div>

                    <div className={styles.stampInfoBox}>
                      <h4>Top-Up Details</h4>
                      <div className={styles.stampDetails}>
                        <div className={styles.stampDetail}>
                          <span>Added Duration:</span>
                          <span>{topUpInfo?.days} days</span>
                        </div>
                        <div className={styles.stampDetail}>
                          <span>Cost:</span>
                          <span>${Number(topUpInfo?.cost || 0).toFixed(2)}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      className={styles.closeSuccessButton}
                      onClick={() => {
                        setShowOverlay(false);
                        setTopUpCompleted(false);
                        setTopUpInfo(null);
                        setStatusMessage({ step: '', message: '' });
                        setIsLoading(false);
                        setExecutionResult(null);
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
        <UploadHistorySection address={address} setShowUploadHistory={setShowUploadHistory} />
      ) : null}
    </div>
  );
};

export default SwapComponent;
