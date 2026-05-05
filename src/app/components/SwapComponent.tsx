'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAccount, useChainId, usePublicClient, useWalletClient, useSwitchChain } from 'wagmi';
import { watchChainId, getWalletClient } from '@wagmi/core';
import { useConnectModal } from '@rainbow-me/rainbowkit';
import { config, getPollingInterval } from '@/app/wagmi';
import { createConfig, EVM, ChainId, ChainType, getChains, Chain } from '@lifi/sdk';
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
  GNOSIS_DESTINATION_TOKEN,
  TIME_OPTIONS,
  DEFAULT_BEE_API_URL,
  DEFAULT_SLIPPAGE,
  MIN_TOKEN_BALANCE_USD,
  LIFI_API_KEY,
  FILE_SIZE_CONFIG,
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
  performWithRetry,
  toChecksumAddress,
  getGnosisPublicClient,
  setGnosisRpcUrl,
  fetchCurrentPriceFromOracle,
  fetchStampInfo,
  formatExpiryTime,
  isExpiringSoon,
  getStampUsage,
  updateHistoryAfterTopUp,
} from './utils';
import { useTimer } from './TimerUtils';

import {
  getRelayBridgeOnlyToBzzQuote,
  getRelayBuyStampQuote,
  executeRelaySteps,
  parseRelayError,
} from './RelayQuotes';
import {
  deriveHotKey,
  getCachedHotKeyAddress,
  type DerivedHotKey,
} from './ClientStamping';
import {
  computeBatchId,
  createSelfCustodyBatchViaRegistry,
  topUpSelfCustodyBatchViaRegistry,
  saveSelfCustodyBatch,
  getSelfCustodyBatches,
  markSelfCustodyBatchToppedUp,
} from './SelfCustodyBatch';
import { waitForGatewayBatchSync } from './GatewayChainSync';
import { STAMPS_REGISTRY_V2_ADDRESS, STAMPS_REGISTRY_V2_ABI } from './constants';
import {
  uploadFileClientSide,
  uploadMultipleFilesClientSide,
  uploadFilesAsCollectionClientSide,
  StampNotReadyError,
  type MultiFileResult,
} from './ClientSideUpload';
import {
  extractArchiveToEntries,
  buildSwarmIndexHtml,
  hasRootIndexHtml,
} from './FolderArchiveExtract';
import {
  processNFTCollectionClientSide,
  type NFTCollectionUploadResult,
} from './NFTCollectionClientSide';
import { generateAndUpdateNonce, fetchNodeWalletAddress, formatDateEU } from './utils';
import { useTokenManagement } from './TokenUtils';
import { useBeeNodeHealth } from './BeeNodeHealth';

// Self-custody success page may show a download/open link for any single
// uploaded file regardless of extension; "archive-aware" URL construction is
// no longer needed because we no longer special-case .zip / .tar.
const isArchiveFile = (filename?: string): boolean => {
  if (!filename) return false;
  return ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2', '.xz', '.lz4', '.zst'].some(ext =>
    filename.toLowerCase().endsWith(ext)
  );
};

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
  createdDate?: string;
}

const SwapComponent: React.FC = () => {
  // Log version info on component initialization
  React.useEffect(() => {
    console.log(`
                               🐝 BEEPORT 🐝    
    ╔════════════════════════════════════════════════════════════════╗
    ║                         Version: 1.1.9                         ║
    ║                                                                ║
    ║            Multichain Swarm Upload & Stamp Manager             ║
    ║              https://github.com/ethersphere/beeport            ║
    ╚════════════════════════════════════════════════════════════════╝
    `);
  }, []);

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { openConnectModal } = useConnectModal();

  // Add state to track if component has mounted to prevent hydration mismatches
  const [hasMounted, setHasMounted] = useState(false);
  const [badgeLabel, setBadgeLabel] = useState<'LOCAL' | 'TEST' | 'BETA'>('BETA');
  const [isInitialized, setIsInitialized] = useState(false);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(null);
  const [executionResult, setExecutionResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentPrice, setCurrentPrice] = useState<bigint | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [selectedDepth, setSelectedDepth] = useState(22);
  const [nodeAddress, setNodeAddress] = useState<string>(DEFAULT_NODE_ADDRESS);
  const [isNewStampCreated, setIsNewStampCreated] = useState(false);
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
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [showStampList, setShowStampList] = useState(false);

  // Upload-mode toggles brought back from 1.1.x but reimplemented over the
  // self-custody pipeline (`ClientSideUpload.ts`) — every chunk + manifest
  // is still BMT-hashed and stamped locally, regardless of which mode is
  // active. See SWIP §Client-side stamping mode α.
  const [isMultipleFiles, setIsMultipleFiles] = useState(false);
  const [isFolderUpload, setIsFolderUpload] = useState(false);
  const [isWebpageUpload, setIsWebpageUpload] = useState(false);
  const [serveUncompressed, setServeUncompressed] = useState(true);
  const [isNFTCollection, setIsNFTCollection] = useState(false);
  const [multiFileResults, setMultiFileResults] = useState<MultiFileResult[]>([]);
  const [nftCollectionResult, setNftCollectionResult] =
    useState<NFTCollectionUploadResult | null>(null);

  // Approval options state — controls whether the BZZ approve issued by
  // `createSelfCustodyBatch` is exact-amount or infinite. The legacy
  // approve-against-Registry useEffect/handler is gone.
  const [approvalType, setApprovalType] = useState<'exact' | 'infinite'>('exact');
  const [showApprovalDropdown, setShowApprovalDropdown] = useState(false);
  const approvalDropdownRef = useRef<HTMLDivElement>(null);

  // ── Self-custody (SWIP §Client-side stamping, mode α) — always on ──────────
  // Batches are created via StampsRegistryV2 with `_owner = hotKeyAddress`;
  // the registry is `msg.sender` to Postage Stamp. Every chunk is BMT-hashed
  // and stamped locally before being POSTed to the Bee gateway.
  const [hotKey, setHotKey] = useState<DerivedHotKey | null>(null);
  const [cachedHotKeyAddress, setCachedHotKeyAddress] = useState<string | null>(null);

  // Close approval dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        approvalDropdownRef.current &&
        !approvalDropdownRef.current.contains(event.target as Node)
      ) {
        setShowApprovalDropdown(false);
      }
    };

    if (showApprovalDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showApprovalDropdown]);

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

  // Pre-upload Bee gateway health probe. We only poll while the upload UI is
  // visible (`uploadStep === 'ready'`). During an active upload the chunk POSTs
  // are themselves the most authoritative liveness signal, and during 'idle'
  // the user can't see the banner anyway, so polling is wasted bandwidth.
  const beeNodeHealth = useBeeNodeHealth(beeApiUrl, uploadStep === 'ready');

  const [swarmConfig, setSwarmConfig] = useState(DEFAULT_SWARM_CONFIG);

  const [isCustomNode, setIsCustomNode] = useState(false);

  const [useCustomSlippage, setUseCustomSlippage] = useState(false);
  const [customSlippagePercent, setCustomSlippagePercent] = useState(DEFAULT_SLIPPAGE);

  const [showUploadHistory, setShowUploadHistory] = useState(false);

  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

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

  // Reload cached hot-key address whenever the connected wallet changes.
  // We only persist the public address — the private key never leaves memory.
  useEffect(() => {
    if (!address) {
      setCachedHotKeyAddress(null);
      setHotKey(null);
      return;
    }
    const cached = getCachedHotKeyAddress(address);
    setCachedHotKeyAddress(cached);
    if (hotKey && hotKey.address.toLowerCase() !== address.toLowerCase()) {
      // Wallet changed — invalidate the in-memory hot key so we re-derive.
      setHotKey(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  /**
   * Ensure we have a usable hot key for the current wallet, prompting the
   * wallet to sign the canonical derivation message if necessary. Resulting
   * `hotKey` is cached in component state for the rest of the session.
   */
  const ensureHotKey = useCallback(async (): Promise<DerivedHotKey> => {
    if (hotKey && address && hotKey.address.toLowerCase() === address.toLowerCase()) {
      return hotKey;
    }
    if (!walletClient || !address) {
      throw new Error('Wallet not connected — cannot derive hot key');
    }
    setStatusMessage({
      step: 'HotKey',
      message:
        'Please sign the message in your wallet to derive your self-custody stamping key…',
    });
    const derived = await deriveHotKey(walletClient, address as `0x${string}`);
    setHotKey(derived);
    setCachedHotKeyAddress(derived.address);
    return derived;
  }, [hotKey, walletClient, address]);

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
        console.log('✅ Loaded chains:', chains.length);
      } catch (error) {
        console.error('❌ Error fetching chains:', error);
        // Fallback: set some basic chains if LiFi fails
        setAvailableChains([]);
      } finally {
        setIsChainsLoading(false);
      }
    };

    // Only fetch chains on client side
    if (typeof window !== 'undefined') {
      fetchChains();
    }
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
        const isOnGnosis = selectedChainId === ChainId.DAI;
        const isFromBzz =
          !!fromToken && getAddress(fromToken) === getAddress(GNOSIS_BZZ_ADDRESS);
        const isPureGnosisBzzPath = isOnGnosis && isFromBzz;

        console.log('🔍 Price estimation:', {
          bzzAmount: formatUnits(BigInt(bzzAmount), 16),
          selectedDays,
          stampSize:
            STORAGE_OPTIONS.find(option => option.depth === selectedDepth)?.size || 'Unknown',
          selectedChainId,
          fromToken,
          path: isPureGnosisBzzPath ? 'direct-registry' : 'relay-one-shot',
        });

        // For Gnosis + BZZ there's no Relay leg — the user calls
        // StampsRegistryV2 directly with the BZZ they already hold. Cost in
        // USD is just the BZZ cost (everything else is gas, which we don't
        // estimate here, matching the previous flow's "Cost without gas"
        // semantics).
        let totalAmountUSD: number;
        if (isPureGnosisBzzPath) {
          if (selectedTokenInfo?.priceUSD) {
            const bzzInTokenUnits = Number(formatUnits(BigInt(bzzAmount), 16));
            totalAmountUSD = bzzInTokenUnits * Number(selectedTokenInfo.priceUSD);
          } else {
            totalAmountUSD = 0;
          }
        } else {
          // One-shot Relay buy-stamp quote. Mirrors the *real* tx the user
          // will sign (bridge + executor runs `txs` against StampsRegistryV2),
          // so the displayed price equals what they'll actually pay.
          const calcInitialBalance = currentPrice
            ? BigInt(currentPrice) * BigInt(17280) * BigInt(selectedDays || 1)
            : 0n;
          const calcDepth =
            isTopUp && originalStampInfo ? originalStampInfo.depth : selectedDepth;
          const quote = await getRelayBuyStampQuote({
            selectedChainId,
            fromToken,
            address,
            bzzAmount,
            hotKeyAddress:
              (cachedHotKeyAddress as `0x${string}` | null) ??
              ('0x0000000000000000000000000000000000000001' as `0x${string}`),
            initialBalancePerChunk: calcInitialBalance,
            depth: calcDepth,
            bucketDepth: parseInt(swarmConfig.swarmBatchBucketDepth, 10),
            nonce: swarmConfig.swarmBatchNonce,
            immutable_: !!swarmConfig.swarmBatchImmutable,
            approvalType,
            setEstimatedTime: () => {},
            isForEstimation: true,
            slippagePercent: useCustomSlippage ? customSlippagePercent : undefined,
          });
          totalAmountUSD = quote.totalAmountUSD;
        }

        if (abortSignal.aborted) return;
        console.log(`💰 Self-custody bridge estimate: $${totalAmountUSD.toFixed(2)}`);

        // If operation was aborted, don't continue
        if (abortSignal.aborted) {
          console.log('Price estimate aborted');
          return;
        }

        setTotalUsdAmount(totalAmountUSD.toString());

        // Check if user has enough funds
        if (selectedTokenInfo) {
          const tokenBalanceInUsd =
            Number(formatUnits(selectedTokenInfo.amount || 0n, selectedTokenInfo.decimals)) *
            Number(selectedTokenInfo.priceUSD);

          console.log('User token balance in USD:', tokenBalanceInUsd);
          console.log('Required amount in USD:', totalAmountUSD);

          // Set insufficient funds flag if cost exceeds available balance
          setInsufficientFunds(totalAmountUSD > tokenBalanceInUsd);
        }
      } catch (error) {
        // Only update error state if not aborted
        if (!abortSignal.aborted) {
          console.error('Error estimating price:', error);
          setTotalUsdAmount(null);

          // Parse Relay-specific errors for better error categorization
          const { userMessage, errorCode } = parseRelayError(error);

          if (errorCode) {
            console.error('🚨 Relay Price Estimation Error:', {
              errorCode,
              userMessage,
              originalError: error,
            });
          }

          // Check for specific error types
          const isNoRoutesError =
            errorCode === 'NO_SWAP_ROUTES_FOUND' ||
            errorCode === 'NO_QUOTES' ||
            errorCode === 'NO_INTERNAL_SWAP_ROUTES_FOUND';

          const isLiquidityError =
            errorCode === 'INSUFFICIENT_LIQUIDITY' || errorCode === 'SWAP_IMPACT_TOO_HIGH';

          if (isNoRoutesError) {
            console.log('No routes available for this swap');
            setAggregatorDown(true);
          } else if (isLiquidityError) {
            console.log('Liquidity issue detected');
            setLiquidityError(true);
          } else {
            // Fallback to checking error message for legacy compatibility
            const errorMessage = error instanceof Error ? error.message : String(error);
            const isLegacyNotFoundError =
              errorMessage.includes('404') ||
              errorMessage.includes('Not Found') ||
              errorMessage.includes('No available quotes for the requested transfer') ||
              errorMessage.includes('NotFoundError');

            if (isLegacyNotFoundError) {
              console.log('Legacy: No quotes available');
              setAggregatorDown(true);
            } else {
              setLiquidityError(true);
            }
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

  // Self-custody mode does its own BZZ approve + createBatch directly against
  // the upstream Postage Stamp contract (`createSelfCustodyBatch`). The legacy
  // Registry-side allowance flow is gone.

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

  /**
   * Switch the connected wallet to Gnosis and return a fresh walletClient
   * bound to that chain. Throws if the user rejects or wagmi can't deliver
   * a Gnosis client within a reasonable window.
   */
  const ensureWalletOnGnosis = useCallback(async (): Promise<{
    walletClient: any;
    publicClient: any;
  }> => {
    if (selectedChainId === ChainId.DAI && walletClient && publicClient) {
      return { walletClient, publicClient };
    }
    if (!switchChain) {
      throw new Error('Wallet does not support chain switching');
    }
    setStatusMessage({
      step: 'SwitchChain',
      message: 'Switching wallet to Gnosis chain…',
    });
    await new Promise<void>((resolve, reject) => {
      switchChain(
        { chainId: ChainId.DAI },
        {
          onSuccess: () => resolve(),
          onError: err => reject(err),
        }
      );
    });
    // Give wagmi/RainbowKit a moment to refresh the wallet/public client refs.
    await new Promise(r => setTimeout(r, 1200));
    const gnosisWalletClient = await getWalletClient(config, { chainId: ChainId.DAI });
    const gnosisPublicClient = getGnosisPublicClient().client;
    if (!gnosisWalletClient) throw new Error('Failed to obtain Gnosis wallet client');
    return { walletClient: gnosisWalletClient, publicClient: gnosisPublicClient };
  }, [selectedChainId, walletClient, publicClient, switchChain]);

  /**
   * Self-custody buy path (SWIP §Client-side stamping, mode α).
   *
   * Two sub-paths, both ending in a non-custodial batch (`_owner = hotKey`):
   *
   *   • **Gnosis + BZZ** — no Relay leg needed. The user's wallet calls
   *     {@link createSelfCustodyBatchViaRegistry} directly: BZZ approve to
   *     {@link STAMPS_REGISTRY_V2_ADDRESS} → `createSelfCustodyBatch`. Two
   *     wallet prompts.
   *
   *   • **Anything else** — one-shot Relay buy via {@link getRelayBuyStampQuote}.
   *     Relay bridges/swaps the user's token to BZZ on Gnosis and lands it in
   *     the executor multicaller, which then runs two `txs` against
   *     {@link STAMPS_REGISTRY_V2_ADDRESS}: `BZZ.approve` then
   *     `createSelfCustodyBatch`. **One** wallet prompt total — restoring the
   *     legacy single-signature buy UX.
   *
   * Because every call to PostageStamp routes through StampsRegistryV2,
   * `batchId = keccak256(STAMPS_REGISTRY_V2_ADDRESS, nonce)` is deterministic
   * client-side regardless of who calls the registry (user EOA vs. Relay's
   * multicaller).
   */
  const handleSelfCustodyBuy = async (updatedConfig: any) => {
    if (!address || !publicClient || !walletClient || selectedChainId === null) return;
    try {
      const derived = await ensureHotKey();

      const isOnGnosis = selectedChainId === ChainId.DAI;
      const isFromBzz =
        !!fromToken && getAddress(fromToken) === getAddress(GNOSIS_BZZ_ADDRESS);
      const isPureGnosisBzzPath = isOnGnosis && isFromBzz;

      // Top-up path — keep the existing two-step approve + topUp flow on
      // whichever path makes sense. We still route through the registry so
      // any indexers/UIs can tie the top-up back to the original wallet.
      if (isTopUp && topUpBatchId && originalStampInfo) {
        const totalBzzNeeded = updatedConfig.swarmBatchTotal as string;

        // For non-Gnosis or non-BZZ origin we still need to first get BZZ
        // into the wallet (top-ups currently don't have a one-shot quote
        // because the registry's `topUpBatch` is permissionless and small;
        // if the user's already on Gnosis with BZZ this is a no-op).
        if (!isPureGnosisBzzPath) {
          setStatusMessage({
            step: 'Quoting',
            message: 'Quoting bridge to BZZ on Gnosis…',
          });

          const { relayQuoteResponse, totalAmountUSD } = await getRelayBridgeOnlyToBzzQuote({
            selectedChainId,
            fromToken,
            address,
            bzzAmount: totalBzzNeeded,
            slippagePercent: useCustomSlippage ? customSlippagePercent : undefined,
          });

          setStatusMessage({
            step: 'Bridge',
            message: `Bridging to BZZ on Gnosis (~$${totalAmountUSD.toFixed(2)})…`,
          });

          await executeRelaySteps(
            relayQuoteResponse,
            walletClient,
            publicClient,
            setStatusMessage,
            () => {
              console.log('🚀 Self-custody top-up bridge tx confirmed');
            }
          );
        }

        const { walletClient: gnosisWallet, publicClient: gnosisPublic } =
          await ensureWalletOnGnosis();

        const topUpPerChunk = BigInt(updatedConfig.swarmBatchInitialBalance);
        const totalForUi = calculateTopUpAmount(originalStampInfo.depth);
        await topUpSelfCustodyBatchViaRegistry({
          walletClient: gnosisWallet,
          publicClient: gnosisPublic,
          walletAddress: address as `0x${string}`,
          batchId: (topUpBatchId.startsWith('0x')
            ? topUpBatchId
            : `0x${topUpBatchId}`) as `0x${string}`,
          topUpAmountPerChunk: topUpPerChunk,
          depth: originalStampInfo.depth,
          approvalType,
          onStatus: msg => setStatusMessage({ step: 'SelfCustody', message: msg }),
        });

        setPostageBatchId(topUpBatchId as string);
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
        if (address && topUpBatchId && selectedDays) {
          updateHistoryAfterTopUp(topUpBatchId, selectedDays, address);
        }
        if (address) {
          markSelfCustodyBatchToppedUp(address, topUpBatchId);
        }
        void totalForUi;
        return;
      }

      // ── New batch path ──────────────────────────────────────────────────────
      const initialBalancePerChunk = BigInt(updatedConfig.swarmBatchInitialBalance);
      const depth = parseInt(updatedConfig.swarmBatchDepth, 10);
      const bucketDepth = parseInt(updatedConfig.swarmBatchBucketDepth, 10);
      const nonce = updatedConfig.swarmBatchNonce as `0x${string}` | string;
      const immutable_ = !!updatedConfig.swarmBatchImmutable;

      // batchId is deterministic for both sub-paths (registry as msg.sender),
      // so we can pre-compute it and persist immediately on success without
      // needing to parse Relay's response or the multicaller's tx logs.
      const predictedBatchId = computeBatchId(STAMPS_REGISTRY_V2_ADDRESS, nonce);

      let createBatchTxHash: `0x${string}` | undefined;
      // Block number at which the batch became visible on-chain. For the
      // direct path that's the receipt block; for the Relay path we don't
      // know which block the multicaller's tx mined in, so we snapshot the
      // Gnosis chain tip the moment our `batchAttribution` verifier first
      // returns true — the gateway must be at least this block to see the
      // batch, which is what {@link waitForGatewayBatchSync} compares against.
      let createBatchBlockNumber: bigint | undefined;

      if (isPureGnosisBzzPath) {
        // Direct registry call — two wallet prompts (approve + create).
        const result = await createSelfCustodyBatchViaRegistry({
          walletClient,
          publicClient,
          walletAddress: address as `0x${string}`,
          hotKeyAddress: derived.address,
          initialBalancePerChunk,
          depth,
          bucketDepth,
          nonce,
          immutable_,
          approvalType,
          onStatus: msg => setStatusMessage({ step: 'SelfCustody', message: msg }),
        });
        createBatchTxHash = result.createBatchTxHash;
        createBatchBlockNumber = result.createBatchBlockNumber;
        if (result.batchId.toLowerCase() !== predictedBatchId.toLowerCase()) {
          console.warn(
            'predicted batchId did not match on-chain batchId',
            { predicted: predictedBatchId, actual: result.batchId }
          );
        }
      } else {
        // One-shot Relay buy — single wallet prompt to fund the bridge tx.
        // Relay's executor handles BZZ.approve + createSelfCustodyBatch on
        // Gnosis as the multicaller via `txs[]`.
        setStatusMessage({
          step: 'Quoting',
          message: 'Quoting one-shot buy via Relay…',
        });

        const totalBzzNeeded = updatedConfig.swarmBatchTotal as string;
        const { relayQuoteResponse, totalAmountUSD } = await getRelayBuyStampQuote({
          selectedChainId,
          fromToken,
          address,
          bzzAmount: totalBzzNeeded,
          hotKeyAddress: derived.address,
          initialBalancePerChunk,
          depth,
          bucketDepth,
          nonce,
          immutable_,
          approvalType,
          slippagePercent: useCustomSlippage ? customSlippagePercent : undefined,
        });

        setStatusMessage({
          step: 'Bridge',
          message: `Buying stamp via Relay (~$${totalAmountUSD.toFixed(2)})…`,
        });

        // On-chain success oracle. Relay's `/intents/status` sometimes
        // returns `fallback`/`refunded` even when the destination call
        // landed (observed on the Sushi-on-Gnosis route — `BatchCreated`
        // is emitted but Relay still tags the order as fallback because
        // it sweeps a tiny refund of unused inventory back on the origin
        // chain). The monitor uses this verifier as a false-positive
        // guard before throwing a refund error.
        // CRITICAL: must use a Gnosis-bound client. The wagmi `publicClient`
        // tracks whichever chain the user is currently connected to (e.g.
        // Base for cross-chain), where the registry address has no code —
        // calling `batchAttribution` there returns `0x` and viem throws
        // `ContractFunctionZeroDataError`. The on-chain end state we want
        // to observe is *always* on Gnosis regardless of origin.
        const { client: gnosisClient } = getGnosisPublicClient();
        const verifyOnChainSuccess = async () => {
          // `batchAttribution(bytes32) view returns (address wallet, address
          // hotKeyOwner, uint96 createdAt)` — viem returns this as a
          // positional tuple `[wallet, hotKeyOwner, createdAt]` (the auto-
          // generated getter for our `mapping(bytes32 => Attribution)`).
          // wallet is the zero address until `createSelfCustodyBatch` runs.
          const result = (await gnosisClient.readContract({
            address: STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`,
            abi: STAMPS_REGISTRY_V2_ABI,
            functionName: 'batchAttribution',
            args: [predictedBatchId as `0x${string}`],
          })) as readonly [string, string, bigint];
          const wallet = result?.[0];
          const visible =
            typeof wallet === 'string' &&
            wallet.toLowerCase() !== '0x0000000000000000000000000000000000000000';
          if (visible && createBatchBlockNumber === undefined) {
            // First positive verification — the registry now sees the batch
            // on-chain. Snapshot the current tip as the lower bound the
            // upload-time gateway-sync wait will need to reach. We can't
            // read the tx's actual mined block (we never see the multicaller's
            // tx hash), so this conservative ceiling is the best we have.
            try {
              createBatchBlockNumber = await gnosisClient.getBlockNumber();
            } catch (err) {
              console.warn(
                'Failed to snapshot Gnosis tip after Relay verification:',
                err
              );
            }
          }
          return visible;
        };

        await executeRelaySteps(
          relayQuoteResponse,
          walletClient,
          publicClient,
          setStatusMessage,
          () => {
            console.log('🚀 Relay one-shot buy tx confirmed');
          },
          verifyOnChainSuccess
        );
      }

      console.log('🔑 Self-custody batch created via registry', predictedBatchId);
      setPostageBatchId(
        predictedBatchId.startsWith('0x') ? predictedBatchId.slice(2) : predictedBatchId
      );

      // Persist for the "Your Stamps" UI. The Bee gateway eventually picks
      // up the registry batch from the chain, but localStorage is what makes
      // the entry visible immediately — the registry's `getWalletBatchIds`
      // can also be used to repopulate after a wipe.
      saveSelfCustodyBatch(address, {
        batchId: predictedBatchId,
        walletAddress: address,
        hotKeyAddress: derived.address,
        depth,
        bucketDepth,
        totalAmount: updatedConfig.swarmBatchTotal,
        timestamp: Math.floor(Date.now() / 1000),
        immutableFlag: immutable_,
        createBatchTxHash,
        createBatchBlockNumber:
          createBatchBlockNumber !== undefined
            ? Number(createBatchBlockNumber)
            : undefined,
        createdVia: 'registry',
      });

      setStatusMessage({
        step: 'Complete',
        message: 'Self-custody storage created. Ready when the Bee gateway indexes it.',
        isSuccess: true,
        warning:
          'When you start your first upload we will wait for the gateway to index this batch before sending chunks. This usually takes a few seconds on Gnosis.',
      });
      setIsNewStampCreated(true);
      setUploadStep('ready');
    } catch (err) {
      console.error('Self-custody buy failed:', err);
      setStatusMessage({
        step: 'Error',
        message: 'Self-custody batch creation failed',
        error: err instanceof Error ? err.message : 'Unknown error',
        isError: true,
      });
      setIsLoading(false);
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

    // The batch ID for self-custody is `keccak256(hotKeyAddress, nonce)` and is
    // computed inside `createSelfCustodyBatch`; no pre-calculation here.

    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('idle');
    setStatusMessage({
      step: 'Initialization',
      message: 'Preparing transaction...',
    });

    try {
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

      setStatusMessage({ step: 'Calculation', message: 'Calculating amounts...' });

      // Self-custody only. The helper bridges/swaps to BZZ on Gnosis when
      // needed, switches the wallet to Gnosis, and calls the upstream Postage
      // Stamp contract directly with `_owner = hotKeyAddress`.
      await handleSelfCustodyBuy(updatedConfig);
    } catch (error) {
      console.error('An error occurred:', error);
      const { userMessage, errorCode } = parseRelayError(error);
      if (errorCode) {
        console.error('🚨 Relay Error Details:', { errorCode, userMessage, originalError: error });
      }
      setStatusMessage({
        step: 'Error',
        message: 'Execution failed',
        error: userMessage || formatErrorMessage(error),
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
    isWebpageUpload?: boolean,
    fileSize?: number,
    isFolderUpload?: boolean
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
      fileSize,
      isFolderUpload,
    });

    history[address] = addressHistory;
    localStorage.setItem('uploadHistory', JSON.stringify(history));
  };

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    // Round to 1 decimal place for MB and above, no decimals for B and KB
    const rounded = unitIndex >= 2 ? Math.round(size * 10) / 10 : Math.round(size);
    return `${rounded} ${units[unitIndex]}`;
  };

  /**
   * Total bytes across the current selection — single file, multi-file
   * batch or a folder archive. Used by the size-warning UI and the upload
   * gate, so it MUST track every selection mode rather than just
   * `selectedFile.size` (which would be 0 for multi-file mode).
   */
  const getTotalFileSize = (): number => {
    if (isMultipleFiles && selectedFiles.length > 0) {
      return selectedFiles.reduce((total, file) => total + file.size, 0);
    }
    return selectedFile?.size || 0;
  };

  const hasVeryLargeFiles = (): boolean => {
    const threshold = FILE_SIZE_CONFIG.largeFileThresholdGB * 1024 * 1024 * 1024;
    if (isMultipleFiles && selectedFiles.length > 0) {
      return selectedFiles.some(file => file.size > threshold);
    }
    return (selectedFile?.size || 0) > threshold;
  };

  const exceedsMaximumUploadSize = (): boolean => {
    const maxSizeBytes = FILE_SIZE_CONFIG.maximumFileGB * 1024 * 1024 * 1024;
    return getTotalFileSize() > maxSizeBytes;
  };

  /**
   * Self-custody upload path (SWIP §Client-side stamping, mode α).
   *
   * BMT-chunks the file in this browser tab, signs every per-chunk stamp
   * locally with the hot key, and POSTs each pre-stamped chunk to a key-less
   * Bee gateway via /chunks. The gateway never sees the hot key.
   */
  const handleSelfCustodyUpload = async (file: File) => {
    if (!postageBatchId || !walletClient || !publicClient || !address) return;
    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');
    setIsNewStampCreated(false);
    setUploadProgress(0);

    try {
      const derived = await ensureHotKey();

      const batchIdHex = postageBatchId.startsWith('0x')
        ? (postageBatchId as `0x${string}`)
        : (`0x${postageBatchId}` as `0x${string}`);
      const depthForUpload = isTopUp && originalStampInfo
        ? originalStampInfo.depth
        : selectedDepth;

      // Self-custody batches are owned by the hot key on-chain — Bee's
      // `/stamps/:id` endpoint always 404s here, so the legacy "poll until
      // usable" flow doesn't apply. What *does* still matter is the gateway's
      // own chain-sync: it can only validate our presigned stamps once its
      // batchstore has indexed past the `createBatch` block. Wait for that
      // explicitly when we know the block number; otherwise fall through to
      // the optimistic path and let the first chunk POST be the test.
      const storedBatchEntry = getSelfCustodyBatches(address).find(
        b => b.batchId.toLowerCase() === batchIdHex.toLowerCase()
      );
      const targetBlockNumber =
        storedBatchEntry?.createBatchBlockNumber !== undefined
          ? BigInt(storedBatchEntry.createBatchBlockNumber)
          : null;

      if (targetBlockNumber !== null) {
        setStatusMessage({
          step: 'Uploading',
          message: 'Waiting for Bee gateway to index your new batch…',
        });
        try {
          const syncResult = await waitForGatewayBatchSync(
            beeApiUrl,
            targetBlockNumber,
            {
              onStatus: ({ gatewayBlock, targetBlock, attempts }) => {
                if (gatewayBlock === null) return;
                if (gatewayBlock >= targetBlock) return;
                setStatusMessage({
                  step: 'Uploading',
                  message: `Gateway syncing… block ${gatewayBlock} / ${targetBlock} (probe ${attempts})`,
                });
              },
            }
          );
          if (syncResult === 'timeout') {
            console.warn(
              `[ClientSideUpload] Gateway did not reach block ${targetBlockNumber} within deadline; proceeding optimistically.`
            );
          } else if (syncResult === 'unknown') {
            console.info(
              '[ClientSideUpload] Gateway does not expose /chainstate; proceeding optimistically.'
            );
          }
        } catch (err) {
          // `waitForGatewayBatchSync` only rejects on AbortSignal, which we
          // don't pass here — but be defensive so a future refactor doesn't
          // surface this as a hard upload failure.
          console.warn('Gateway sync wait failed unexpectedly:', err);
        }
      }

      setStatusMessage({
        step: 'Uploading',
        message: 'Chunking and stamping locally — this never leaves your browser.',
      });
      setIsDistributing(false);

      const result = await uploadFileClientSide({
        file,
        batchId: batchIdHex,
        hotKey: derived,
        depth: depthForUpload,
        beeApiUrl,
        // Self-custody v1: every upload is a single file. The Mantaray manifest
        // built by `uploadFileClientSide` exposes the file name as default; if
        // the file is HTML the gateway will serve it as a webpage.
        isWebsite: false,
        onProgress: (processed, total) => {
          const pct = Math.min(99, Math.round((processed / Math.max(total, 1)) * 100));
          setUploadProgress(pct);
          if (pct >= 99) setIsDistributing(true);
        },
        onStatus: msg => setStatusMessage({ step: 'Uploading', message: msg }),
      });

      setUploadProgress(100);
      const refHex = result.reference.startsWith('0x')
        ? result.reference.slice(2)
        : result.reference;
      console.log('🎉 Self-custody upload complete', {
        reference: refHex,
        fileChunks: result.fileChunkCount,
        manifestChunks: result.manifestChunkCount,
        elapsedMs: result.elapsedMs.toFixed(0),
        chunksPerSecond: result.averageChunksPerSecond.toFixed(1),
        retries: result.retryCount,
        protocol: result.detectedHttpProtocol ?? 'unknown',
        concurrency: result.effectiveConcurrency,
      });

      // SOC issuer-state backup runs in the background now (deferred off the
      // critical path — see ClientSideUpload.ts). Observe it for logging
      // only; the user has already been told the upload is complete.
      result.issuerStateSocPromise
        .then(soc => {
          if (soc) {
            console.info('[Self-custody] SOC issuer-state backup completed', soc);
          }
        })
        .catch(() => {
          // Already console.warn'd inside the promise body. Swallow here so
          // it doesn't surface as an unhandled rejection.
        });

      // Verify the manifest is actually retrievable from the gateway. Bee
      // accepted every chunk POST, but a quick GET /bzz/<ref>/ confirms the
      // root chunk is indexed and the manifest deserialises cleanly. This
      // closes the "did the file really land?" question post-upload.
      let retrievable: 'yes' | 'no' | 'unknown' = 'unknown';
      try {
        const verifyRes = await fetch(`${beeApiUrl}/bzz/${refHex}/`, {
          method: 'HEAD',
          signal: AbortSignal.timeout(10_000),
        });
        retrievable = verifyRes.ok ? 'yes' : 'no';
        console.log(
          `🔍 Retrieval probe HEAD /bzz/${refHex.slice(0, 8)}…/ → ${verifyRes.status} ${verifyRes.statusText}`
        );
      } catch (probeErr) {
        console.warn('Retrieval probe failed:', probeErr);
      }

      // Stamp + history bookkeeping. Self-custody batches are hot-key–owned;
      // Bee's `/stamps/:id` always 404s, so we never hit the network — use
      // local batch metadata and a conservative history expiry.
      try {
        const displayDepth = storedBatchEntry?.depth ?? depthForUpload;
        const displayBucket = storedBatchEntry?.bucketDepth ?? 16;
        const totalSizeString =
          STORAGE_OPTIONS.find(o => o.depth === displayDepth)?.size ?? `depth ${displayDepth}`;
        setUploadStampInfo({
          batchID: batchIdHex,
          utilization: 0,
          usable: true,
          depth: displayDepth,
          amount: storedBatchEntry?.totalAmount ?? '0',
          bucketDepth: displayBucket,
          exists: true,
          batchTTL: 0,
          totalSize: totalSizeString,
          usedSize: '—',
          remainingSize: '—',
          utilizationPercent: 0,
          createdDate: formatDateEU(new Date()),
        });
        saveUploadReference(
          refHex,
          postageBatchId,
          Date.now() + 30 * 24 * 60 * 60 * 1000,
          file.name,
          false,
          file.size
        );
      } catch (err) {
        console.warn('Self-custody post-upload bookkeeping failed:', err);
      }

      const retrievalSuffix =
        retrievable === 'yes'
          ? ' ✓ verified retrievable'
          : retrievable === 'no'
            ? ' ⚠ chunks accepted but gateway could not retrieve yet — try in a few seconds'
            : ' (retrieval probe inconclusive)';

      // Compact one-line diagnostic appended to the success message. Helps
      // users (and us, on bug reports) tell "fast gateway" from "slow
      // gateway" at a glance, and gives us a benchmark to compare future
      // optimisations against.
      const totalChunks = result.fileChunkCount + result.manifestChunkCount;
      const elapsedSec = result.elapsedMs / 1000;
      const protoLabel = result.detectedHttpProtocol
        ? result.detectedHttpProtocol.toUpperCase()
        : 'HTTP';
      const retriesLabel = result.retryCount > 0 ? `, ${result.retryCount} retries` : '';
      const diagnosticSuffix =
        ` · ${totalChunks} chunks in ${elapsedSec.toFixed(1)}s ` +
        `(${result.averageChunksPerSecond.toFixed(0)}/s, ${protoLabel} ×${result.effectiveConcurrency}${retriesLabel})`;

      setStatusMessage({
        step: 'Complete',
        message:
          `Upload Successful. Reference: ${refHex.slice(0, 6)}...${refHex.slice(-4)}` +
          retrievalSuffix +
          diagnosticSuffix,
        isSuccess: true,
        reference: refHex,
        filename: file.name,
      });
      setUploadStep('complete');
      setSelectedDays(null);
      setIsDistributing(false);
      // Same long auto-close as the legacy upload path; the user can also
      // close manually via the success screen's Close button.
      setTimeout(() => {
        setUploadStep('idle');
        setShowOverlay(false);
        setIsLoading(false);
        setUploadProgress(0);
      }, 900000);
    } catch (err) {
      console.error('Self-custody upload failed:', err);
      const translated = translateSelfCustodyUploadError(err);
      setStatusMessage({
        step: 'Error',
        message:
          err instanceof StampNotReadyError
            ? 'Stamp not ready yet'
            : 'Self-custody upload failed',
        error: translated.message,
        warning: translated.warning,
        isError: true,
      });
      // For transient failures (gateway hasn't indexed the batch yet) keep
      // the user on the upload screen with their file still selected so
      // they can hit Upload again without re-picking. Re-stamping the same
      // file content reproduces the same `(bucket, cnt)` allocations, so
      // the retry is idempotent — no slot burn.
      setUploadStep(translated.transient ? 'ready' : 'idle');
      setUploadProgress(0);
      setIsDistributing(false);
      setIsLoading(false);
    }
  };

  /**
   * Translate the most common Bee gateway error messages into something an
   * end user can act on, instead of the bare `error: failed to push chunk:
   * stamp signature does not recover…` string Bee returns. Shared by every
   * self-custody upload variant (single file / multi-file / collection /
   * NFT).
   *
   * Returns:
   *   - `message`: the primary headline shown in red.
   *   - `warning`: optional yellow follow-up text with what to do next.
   *   - `transient`: true when the failure is plausibly self-resolving
   *     (e.g. fresh batch hasn't been indexed yet); the UI can use this to
   *     keep the file selection so the user can hit Upload again without
   *     re-picking.
   */
  const translateSelfCustodyUploadError = (
    err: unknown
  ): { message: string; warning?: string; transient?: boolean } => {
    if (err instanceof StampNotReadyError) {
      // The most common case for a freshly-created batch — the gateway's
      // chain listener simply hasn't caught up to our `createBatch` block
      // yet. The uploader's readiness probe already retried for ~2 min
      // before bubbling this up, so the gateway is unusually slow OR
      // misconfigured (wrong PostageStamp contract address, RPC issues,
      // etc.). Telling the user "wait a few seconds" when they just
      // watched a 2 min spinner would feel like a lie — be honest.
      return {
        message:
          'The Bee gateway still has not indexed your new batch after waiting 2 minutes.',
        warning:
          'This usually means the gateway is slow to poll its RPC, or it is configured to watch a different PostageStamp contract. Wait another minute and click Upload again — your file selection is preserved. If it keeps failing, check the gateway URL and try a different one.',
        transient: true,
      };
    }

    const raw = err instanceof Error ? err.message : String(err);
    const lower = raw.toLowerCase();
    if (lower.includes('batch') && (lower.includes('not found') || lower.includes('unknown'))) {
      return {
        message:
          "Bee says it doesn't know this batch. Almost certainly the gateway is configured to watch a different postage-stamp contract than the one we created the batch on. Compare Bee's `--postage-stamp-contract-address` config against GNOSIS_STAMP_ADDRESS in our constants.",
      };
    }
    if (lower.includes('insufficient') && lower.includes('stamp')) {
      return {
        message:
          'Bee accepted the batch but says the stamp is not valid for this chunk. Check that the hot-key signing the stamp matches the on-chain `_owner` of the batch.',
      };
    }
    if (lower.includes('signer') || lower.includes('signature')) {
      return { message: `Bee rejected the stamp signature: ${raw}` };
    }
    if (lower.includes('bucket')) {
      return { message: `Bee rejected the stamp bucket allocation (issuer state): ${raw}` };
    }
    return { message: raw };
  };

  /**
   * Multi-file self-custody upload (Pattern: "N files, N references"). Each
   * file becomes its own minimal Mantaray manifest with a single fork; the
   * Stamper instance is shared across files so bucket counters advance
   * monotonically (matches what 1.1.x's session-token multi-file upload did,
   * but without any server-side stamping).
   */
  const handleSelfCustodyMultiUpload = async (files: File[]) => {
    if (!postageBatchId || !walletClient || !publicClient || !address) return;
    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');
    setIsNewStampCreated(false);
    setUploadProgress(0);
    setMultiFileResults([]);

    try {
      const derived = await ensureHotKey();
      const batchIdHex = postageBatchId.startsWith('0x')
        ? (postageBatchId as `0x${string}`)
        : (`0x${postageBatchId}` as `0x${string}`);
      const depthForUpload =
        isTopUp && originalStampInfo ? originalStampInfo.depth : selectedDepth;

      setStatusMessage({
        step: 'Uploading',
        message: `Chunking and stamping ${files.length} files locally — nothing leaves your browser.`,
      });
      setIsDistributing(false);

      const result = await uploadMultipleFilesClientSide({
        files,
        batchId: batchIdHex,
        hotKey: derived,
        depth: depthForUpload,
        beeApiUrl,
        onProgress: (fileIndex, totalFiles, fileProgress) => {
          // Composite progress: per-file [0..1] mapped into the full [0..99]
          // band, weighted equally per file. Doesn't account for filesize
          // variance but matches what users expect from "N of M files".
          const perFileWeight = 1 / Math.max(1, totalFiles);
          const within = Math.min(
            1,
            fileProgress.processed / Math.max(1, fileProgress.total)
          );
          const overall = (fileIndex * perFileWeight + within * perFileWeight) * 100;
          setUploadProgress(Math.min(99, overall));
          if (overall >= 99) setIsDistributing(true);
        },
        onStatus: msg => setStatusMessage({ step: 'Uploading', message: msg }),
      });

      setMultiFileResults(result.results);
      setUploadProgress(100);

      // Persist successes to upload history with their own references.
      try {
        const stampStatus = await fetchStampInfo(batchIdHex, beeApiUrl);
        const expiryDate = stampStatus
          ? Date.now() + (stampStatus.batchTTL ?? 0) * 1000
          : Date.now() + 30 * 24 * 60 * 60 * 1000;
        for (const r of result.results) {
          if (r.success && r.reference) {
            const refHex = r.reference.startsWith('0x') ? r.reference.slice(2) : r.reference;
            const file = files.find(f => f.name === r.filename);
            saveUploadReference(refHex, postageBatchId, expiryDate, r.filename, false, file?.size);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch stamp info post multi-file upload:', err);
      }

      const successCount = result.results.filter(r => r.success).length;
      setStatusMessage({
        step: 'Complete',
        message: `Upload complete: ${successCount}/${files.length} files uploaded`,
        isSuccess: true,
      });
      setUploadStep('complete');
      setSelectedDays(null);
      setIsDistributing(false);
      setTimeout(() => {
        setUploadStep('idle');
        setShowOverlay(false);
        setIsLoading(false);
        setUploadProgress(0);
      }, 900000);
    } catch (err) {
      console.error('Multi-file self-custody upload failed:', err);
      const translated = translateSelfCustodyUploadError(err);
      setStatusMessage({
        step: 'Error',
        message:
          err instanceof StampNotReadyError ? 'Stamp not ready yet' : 'Multi-file upload failed',
        error: translated.message,
        warning: translated.warning,
        isError: true,
      });
      setUploadStep(translated.transient ? 'ready' : 'idle');
      setUploadProgress(0);
      setIsDistributing(false);
      setIsLoading(false);
    }
  };

  /**
   * Folder / website / archive self-custody upload (Pattern: "N files, ONE
   * reference"). A single Mantaray manifest is built with one fork per
   * `entry.path`, optionally setting `website-index-document` and
   * `website-error-document`. Inputs accepted:
   *
   *   • a `webkitdirectory` file selection (recursive folder picker)
   *   • a single `.zip`/`.tar`/`.tgz`/`.tar.gz` archive (extracted client-side)
   *
   * In both cases, if no root `index.html` is present the helper auto-injects
   * a Swarm-styled directory listing matching the legacy 1.1.x behaviour.
   */
  const handleSelfCustodyCollectionUpload = async (
    entries: Array<{ path: string; data: File | Uint8Array; contentType?: string }>,
    folderName: string
  ) => {
    if (!postageBatchId || !walletClient || !publicClient || !address) return;
    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');
    setIsNewStampCreated(false);
    setUploadProgress(0);

    try {
      const derived = await ensureHotKey();
      const batchIdHex = postageBatchId.startsWith('0x')
        ? (postageBatchId as `0x${string}`)
        : (`0x${postageBatchId}` as `0x${string}`);
      const depthForUpload =
        isTopUp && originalStampInfo ? originalStampInfo.depth : selectedDepth;

      // Inject a generated index.html if the user hasn't supplied one. The
      // listing is the same Swarm-styled page the legacy folder upload
      // produced — see `FolderArchiveExtract.buildSwarmIndexHtml`.
      const paths = entries.map(e => e.path);
      const finalEntries = [...entries];
      if (!hasRootIndexHtml(paths)) {
        const indexHtml = buildSwarmIndexHtml({ folderName, paths });
        finalEntries.unshift({
          path: 'index.html',
          data: new TextEncoder().encode(indexHtml),
          contentType: 'text/html; charset=utf-8',
        });
      }

      setStatusMessage({
        step: 'Uploading',
        message: `Chunking and stamping ${finalEntries.length} files locally — nothing leaves your browser.`,
      });
      setIsDistributing(false);

      const result = await uploadFilesAsCollectionClientSide({
        entries: finalEntries,
        batchId: batchIdHex,
        hotKey: derived,
        depth: depthForUpload,
        beeApiUrl,
        website: { indexDocument: 'index.html', errorDocument: 'error.html' },
        onProgress: (processed, total) => {
          const pct = Math.min(99, Math.round((processed / Math.max(total, 1)) * 100));
          setUploadProgress(pct);
          if (pct >= 99) setIsDistributing(true);
        },
        onStatus: msg => setStatusMessage({ step: 'Uploading', message: msg }),
      });

      setUploadProgress(100);
      const refHex = result.reference.startsWith('0x')
        ? result.reference.slice(2)
        : result.reference;

      try {
        const stampStatus = await fetchStampInfo(batchIdHex, beeApiUrl);
        if (stampStatus) {
          const totalSizeString =
            STORAGE_OPTIONS.find(o => o.depth === stampStatus.depth)?.size ??
            `depth ${stampStatus.depth}`;
          const realUtilizationPercent = getStampUsage(
            stampStatus.utilization,
            stampStatus.depth,
            stampStatus.bucketDepth || 16
          );
          setUploadStampInfo({
            ...stampStatus,
            totalSize: totalSizeString,
            usedSize: `${realUtilizationPercent.toFixed(1)}%`,
            remainingSize: `${(100 - realUtilizationPercent).toFixed(1)}%`,
            utilizationPercent: realUtilizationPercent,
            createdDate: formatDateEU(new Date()),
          });
          const totalBytes = entries.reduce(
            (s, e) => s + (e.data instanceof File ? e.data.size : e.data.length),
            0
          );
          const expiryDate = Date.now() + (stampStatus.batchTTL ?? 0) * 1000;
          saveUploadReference(
            refHex,
            postageBatchId,
            expiryDate,
            folderName,
            true, // isWebpageUpload — folder/website uploads serve via index.html
            totalBytes,
            true // isFolderUpload — flagged so the history UI shows the folder icon
          );
        }
      } catch (err) {
        console.warn('Failed to fetch stamp info post-folder upload:', err);
      }

      setStatusMessage({
        step: 'Complete',
        message: `Upload Successful. Reference: ${refHex.slice(0, 6)}...${refHex.slice(-4)}`,
        isSuccess: true,
        reference: refHex,
        filename: 'index.html', // root resolves to the index doc by default
      });
      setUploadStep('complete');
      setSelectedDays(null);
      setIsDistributing(false);
      setTimeout(() => {
        setUploadStep('idle');
        setShowOverlay(false);
        setIsLoading(false);
        setUploadProgress(0);
      }, 900000);
    } catch (err) {
      console.error('Folder/collection self-custody upload failed:', err);
      const translated = translateSelfCustodyUploadError(err);
      setStatusMessage({
        step: 'Error',
        message:
          err instanceof StampNotReadyError ? 'Stamp not ready yet' : 'Folder upload failed',
        error: translated.message,
        warning: translated.warning,
        isError: true,
      });
      setUploadStep(translated.transient ? 'ready' : 'idle');
      setUploadProgress(0);
      setIsDistributing(false);
      setIsLoading(false);
    }
  };

  /**
   * NFT collection self-custody upload (Pattern: ZIP → 2 references).
   * Calls into {@link processNFTCollectionClientSide} which extracts the
   * ZIP locally, uploads the `images/` folder as one Mantaray collection,
   * rewrites the metadata JSON to point at `bzz.link/bzz/<imagesRef>/<file>`,
   * and uploads the resulting metadata folder as a second Mantaray
   * collection. Returns both root references for the success panel.
   */
  const handleSelfCustodyNFTUpload = async (zipFile: File) => {
    if (!postageBatchId || !walletClient || !publicClient || !address) return;
    setIsLoading(true);
    setShowOverlay(true);
    setUploadStep('uploading');
    setIsNewStampCreated(false);
    setUploadProgress(0);
    setNftCollectionResult(null);

    try {
      const derived = await ensureHotKey();
      const batchIdHex = postageBatchId.startsWith('0x')
        ? (postageBatchId as `0x${string}`)
        : (`0x${postageBatchId}` as `0x${string}`);
      const depthForUpload =
        isTopUp && originalStampInfo ? originalStampInfo.depth : selectedDepth;

      setStatusMessage({
        step: 'Uploading',
        message: 'Extracting ZIP and stamping locally — nothing leaves your browser.',
      });
      setIsDistributing(false);

      const result = await processNFTCollectionClientSide({
        zipFile,
        batchId: batchIdHex,
        hotKey: derived,
        depth: depthForUpload,
        beeApiUrl,
        onProgress: (percent, _stage) => {
          setUploadProgress(Math.min(99, percent));
          if (percent >= 99) setIsDistributing(true);
        },
        onStatus: msg => setStatusMessage({ step: 'Uploading', message: msg }),
      });

      setNftCollectionResult(result);
      setUploadProgress(100);

      // Save BOTH references to the upload history so users can re-find
      // them later. Mark them as folder uploads so the history UI can
      // render the folder icon.
      try {
        const stampStatus = await fetchStampInfo(batchIdHex, beeApiUrl);
        const expiryDate = stampStatus
          ? Date.now() + (stampStatus.batchTTL ?? 0) * 1000
          : Date.now() + 30 * 24 * 60 * 60 * 1000;
        const imagesRefHex = result.imagesReference.startsWith('0x')
          ? result.imagesReference.slice(2)
          : result.imagesReference;
        const metadataRefHex = result.metadataReference.startsWith('0x')
          ? result.metadataReference.slice(2)
          : result.metadataReference;
        saveUploadReference(
          imagesRefHex,
          postageBatchId,
          expiryDate,
          `${zipFile.name} — images`,
          false,
          zipFile.size,
          true
        );
        saveUploadReference(
          metadataRefHex,
          postageBatchId,
          expiryDate,
          `${zipFile.name} — metadata`,
          false,
          undefined,
          true
        );
      } catch (err) {
        console.warn('Failed to record NFT references in upload history:', err);
      }

      setStatusMessage({
        step: 'Complete',
        message: `NFT collection uploaded: ${result.totalImages} images, ${result.totalMetadata} metadata files`,
        isSuccess: true,
      });
      setUploadStep('complete');
      setSelectedDays(null);
      setIsDistributing(false);
      setTimeout(() => {
        setUploadStep('idle');
        setShowOverlay(false);
        setIsLoading(false);
        setUploadProgress(0);
      }, 900000);
    } catch (err) {
      console.error('NFT collection self-custody upload failed:', err);
      const translated = translateSelfCustodyUploadError(err);
      setStatusMessage({
        step: 'Error',
        message:
          err instanceof StampNotReadyError
            ? 'Stamp not ready yet'
            : 'NFT collection upload failed',
        error: translated.message,
        warning: translated.warning,
        isError: true,
      });
      setUploadStep(translated.transient ? 'ready' : 'idle');
      setUploadProgress(0);
      setIsDistributing(false);
      setIsLoading(false);
    }
  };

  /**
   * Dispatch the right self-custody upload helper based on the UI toggles.
   * Order matters: NFT-collection wins over generic archive handling, and
   * folder upload wins over single-file when both are somehow set. The
   * checkbox handlers below already prevent overlapping modes; this is just
   * a defensive ordering for the dispatch.
   */
  const handleFileUpload = async () => {
    if (!postageBatchId || !walletClient || !publicClient) {
      console.error('Missing postage batch ID or wallet', {
        postageBatchId,
        walletClient,
        publicClient,
      });
      return;
    }

    // NFT collection: a single ZIP with `images/` and `json/` folders.
    if (isNFTCollection && selectedFile && selectedFile.name.toLowerCase().endsWith('.zip')) {
      return handleSelfCustodyNFTUpload(selectedFile);
    }

    // Folder picker (webkitdirectory): a FileList already representing the tree.
    if (isFolderUpload && selectedFiles.length > 0) {
      const firstRel = (selectedFiles[0] as File & { webkitRelativePath?: string })
        .webkitRelativePath;
      const folderName = firstRel ? firstRel.split('/')[0] : 'folder';
      const entries = selectedFiles
        .map(f => {
          const rel = (f as File & { webkitRelativePath?: string }).webkitRelativePath;
          // Strip the leading "<folderName>/" so paths inside the manifest
          // are relative to the folder root, not absolute. Matches what the
          // legacy folder upload produced.
          const path = rel ? rel.replace(new RegExp(`^${folderName}/`), '') : f.name;
          return { path, data: f as File };
        })
        .filter(e => e.path && !e.path.endsWith('/'));
      return handleSelfCustodyCollectionUpload(entries, folderName);
    }

    // Single archive (.zip / .tar / .tar.gz / .tgz) with `serveUncompressed` on:
    // extract client-side and upload as a collection.
    if (selectedFile && serveUncompressed && isArchiveFile(selectedFile.name)) {
      try {
        setStatusMessage({
          step: 'Uploading',
          message: `Extracting ${selectedFile.name}…`,
        });
        const archiveEntries = await extractArchiveToEntries(selectedFile);
        if (archiveEntries.length === 0) {
          throw new Error('Archive contained no uploadable files');
        }
        const folderName = selectedFile.name.replace(/\.(zip|tar|tar\.gz|tgz|gz)$/i, '');
        return handleSelfCustodyCollectionUpload(
          archiveEntries.map(e => ({ path: e.path, data: e.data })),
          folderName
        );
      } catch (err) {
        console.error('Archive extraction failed:', err);
        setStatusMessage({
          step: 'Error',
          message: 'Failed to extract archive',
          error: err instanceof Error ? err.message : String(err),
          isError: true,
        });
        return;
      }
    }

    // Multi-file mode: each file gets its own reference.
    if (isMultipleFiles && selectedFiles.length > 0) {
      return handleSelfCustodyMultiUpload(selectedFiles);
    }

    // Default: single file (which keeps the original isWebsite=false manifest
    // shape — the user's file becomes the index document of a 1-fork tree).
    if (selectedFile) {
      return handleSelfCustodyUpload(selectedFile);
    }

    console.error('No file selection matched any upload mode', {
      selectedFile,
      selectedFiles,
      isMultipleFiles,
      isFolderUpload,
      isNFTCollection,
    });
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

  // Set hasMounted and badge label by host: LOCAL (localhost), TEST (beeport.xyz), BETA (elsewhere)
  useEffect(() => {
    setHasMounted(true);
    if (typeof window === 'undefined') return;
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') setBadgeLabel('LOCAL');
    else if (host === 'beeport.xyz') setBadgeLabel('TEST');
    else setBadgeLabel('BETA');
  }, []);

  return (
    <div className={styles.container}>
      <div className={styles.betaBadge}>{badgeLabel}</div>
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
          Upload
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
          {/* ── Self-custody info panel (always-on; SWIP §Client-side stamping mode α) */}
          <div className={styles.inputGroup}>
            <div className={styles.priceInfo}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                Self-custody storage{' '}
                <span
                  className={styles.tooltip}
                  title="Buying: Relay bridges/swaps any chain → BZZ on Gnosis, then BZZ is approved to StampsRegistryV2 and `createSelfCustodyBatch` sets the hot key as on-chain owner (the registry calls Postage Stamp). Uploading: chain-independent — chunks are BMT-hashed and stamped locally in this tab; pre-stamped chunks are POSTed to a key-less Bee gateway."
                >
                  ?
                </span>
              </div>
              {hotKey ? (
                <div>
                  🔑 Hot key (on-chain batch owner):{' '}
                  <code style={{ fontSize: 12 }}>
                    {hotKey.address.slice(0, 8)}…{hotKey.address.slice(-6)}
                  </code>
                </div>
              ) : cachedHotKeyAddress ? (
                <div>
                  🔑 Cached hot-key address:{' '}
                  <code style={{ fontSize: 12 }}>
                    {cachedHotKeyAddress.slice(0, 8)}…{cachedHotKeyAddress.slice(-6)}
                  </code>{' '}
                  (will be re-derived on the next buy or upload)
                </div>
              ) : (
                <div>
                  🔑 Your wallet will be asked to sign a single message to derive a stamping key.
                  The key never leaves this tab.
                </div>
              )}
            </div>
          </div>

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
              data-tooltip="Approximate storage duration - actual duration varies with BZZ price oracle changes"
            >
              {isTopUp ? 'Additional duration' : 'Storage duration'} (approx.)
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

          <div className={styles.buttonContainer}>
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
                'Buy Storage'
              )}
            </button>

            {/* Approval dropdown — kept so the user can pre-pick exact vs infinite
                approve mode for the BZZ allowance the buy flow will request. */}
            {false && showApprovalDropdown && (
                <div className={styles.approvalOptionsOutside} ref={approvalDropdownRef}>
                  <button
                    className={`${styles.approvalOption} ${approvalType === 'exact' ? styles.approvalOptionActive : ''}`}
                    onClick={e => {
                      e.stopPropagation();
                      setApprovalType('exact');
                      setShowApprovalDropdown(false);
                    }}
                  >
                    <span>Approve</span>
                    <span className={styles.approvalDescription}>Exact amount needed</span>
                  </button>
                  <button
                    className={`${styles.approvalOption} ${approvalType === 'infinite' ? styles.approvalOptionActive : ''}`}
                    onClick={e => {
                      e.stopPropagation();
                      setApprovalType('infinite');
                      setShowApprovalDropdown(false);
                    }}
                  >
                    <span>Approve Infinite</span>
                    <span className={styles.approvalDescription}>No future approvals needed</span>
                  </button>
                </div>
              )}
          </div>

          {executionResult && (
            <pre className={styles.resultBox}>{JSON.stringify(executionResult, null, 2)}</pre>
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
          useCustomSlippage={useCustomSlippage}
          setUseCustomSlippage={setUseCustomSlippage}
          customSlippagePercent={customSlippagePercent}
          setCustomSlippagePercent={setCustomSlippagePercent}
        />
      ) : showStampList ? (
        <StampListSection
          setShowStampList={setShowStampList}
          address={address}
          beeApiUrl={beeApiUrl}
          setPostageBatchId={setPostageBatchId}
          setShowOverlay={setShowOverlay}
          setUploadStep={setUploadStep}
          setSelectedDepth={setSelectedDepth}
        />
      ) : showUploadHistory ? (
        <UploadHistorySection address={address} setShowUploadHistory={setShowUploadHistory} />
      ) : null}
      {/* Overlay must stay mounted across tab switches — otherwise switching
          Upload / History / Help during a long upload unmounted the UI while
          chunk POSTs continued in the background. */}
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
                setMultiFileResults([]);
                setNftCollectionResult(null);
                setIsDistributing(false);
                setIsNewStampCreated(false);
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
                  {statusMessage.warning && (
                    <div className={styles.warningMessage}>{statusMessage.warning}</div>
                  )}

                  {remainingTime !== null &&
                    estimatedTime !== null &&
                    (statusMessage.step === 'Route' ||
                      statusMessage.step === 'deposit' ||
                      statusMessage.step === 'Quoting' ||
                      statusMessage.step === 'Relay') && (
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

                {/* Bee gateway health banner. Shown only when the node is
                    not OK so a healthy gateway adds zero visual noise. We
                    intentionally render it ABOVE the data-cannot-be-deleted
                    warning because a sick gateway is the more actionable
                    problem — the user can pick a different node, while the
                    data warning is informational. */}
                {(beeNodeHealth.state.status === 'unreachable' ||
                  beeNodeHealth.state.status === 'unhealthy') && (
                  <div
                    className={`${styles.healthBanner} ${
                      beeNodeHealth.state.status === 'unreachable'
                        ? styles.healthBannerError
                        : styles.healthBannerWarn
                    }`}
                  >
                    <span className={styles.healthBannerTitle}>
                      {beeNodeHealth.state.status === 'unreachable'
                        ? '⛔ Bee gateway unreachable'
                        : '⚠️ Bee gateway unhealthy'}
                    </span>
                    <button
                      type="button"
                      className={styles.healthBannerRetry}
                      onClick={beeNodeHealth.refresh}
                      disabled={beeNodeHealth.isProbing}
                    >
                      {beeNodeHealth.isProbing ? 'Checking…' : 'Retry'}
                    </button>
                    {beeNodeHealth.state.message && (
                      <div className={styles.healthBannerDetail}>
                        {beeNodeHealth.state.message}. Uploads will fail until the gateway
                        recovers.
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.uploadWarning}>
                  Warning! Uploaded data cannot be deleted - it will be removed once the stamp
                  has expired. Uploaded data exists publicly in the network - anyone who knows
                  the reference can access it.
                </div>
                {isNewStampCreated && (
                  <div className={styles.uploadWarning}>
                    ⏱️ New storage created: It takes around up to 2 minutes before it becomes
                    accessible on the network.
                  </div>
                )}
                {/* Inline banner shown when the previous upload attempt
                    failed with a transient "stamp not ready" error. We
                    keep the user on the upload screen with their file
                    selected (see catch blocks above) so they can hit
                    Upload again once the gateway has caught up — but
                    the regular overlay status box is suppressed while
                    `uploadStep === 'ready'`, so without this banner
                    the user wouldn't see *why* their previous click
                    failed. Dismissable so it doesn't linger after the
                    next successful upload. */}
                {statusMessage.isError && statusMessage.step === 'Error' && (
                  <div
                    className={`${styles.healthBanner} ${styles.healthBannerWarn}`}
                  >
                    <span className={styles.healthBannerTitle}>
                      ⚠️ {statusMessage.message}
                    </span>
                    <button
                      type="button"
                      className={styles.healthBannerRetry}
                      onClick={() =>
                        setStatusMessage({ step: '', message: '' })
                      }
                    >
                      Dismiss
                    </button>
                    {statusMessage.error && (
                      <div className={styles.healthBannerDetail}>
                        {statusMessage.error}
                      </div>
                    )}
                    {statusMessage.warning && (
                      <div className={styles.healthBannerDetail}>
                        {statusMessage.warning}
                      </div>
                    )}
                  </div>
                )}
                {statusMessage.step === 'waiting_creation' ? (
                  <div className={styles.waitingMessage}>
                    <div className={styles.spinner}></div>
                    <p>{statusMessage.message}</p>
                  </div>
                ) : (
                  <div className={styles.uploadForm}>
                    {/* Upload-mode toggles. Each one is mutually exclusive
                        with the others (the onChange handlers below clear
                        sibling state when activated), matching how the
                        legacy 1.1.x UI behaved. */}
                    <div className={styles.checkboxWrapper}>
                      <input
                        type="checkbox"
                        id="multiple-files"
                        checked={isMultipleFiles}
                        onChange={e => {
                          setIsMultipleFiles(e.target.checked);
                          setSelectedFile(null);
                          setSelectedFiles([]);
                          setIsFolderUpload(false);
                          setIsNFTCollection(false);
                        }}
                        className={styles.checkbox}
                        disabled={uploadStep === 'uploading'}
                      />
                      <label htmlFor="multiple-files" className={styles.checkboxLabel}>
                        Multiple files separately (separate hashes)
                      </label>
                    </div>

                    <div className={styles.checkboxWrapper}>
                      <input
                        type="checkbox"
                        id="folder-upload"
                        checked={isFolderUpload}
                        onChange={e => {
                          setIsFolderUpload(e.target.checked);
                          if (e.target.checked) {
                            setIsWebpageUpload(true);
                          } else {
                            setIsWebpageUpload(false);
                          }
                          setSelectedFile(null);
                          setSelectedFiles([]);
                          setIsMultipleFiles(false);
                          setIsNFTCollection(false);
                        }}
                        className={styles.checkbox}
                        disabled={uploadStep === 'uploading'}
                      />
                      <label
                        htmlFor="folder-upload"
                        className={styles.checkboxLabel}
                        title="📁 Select an entire folder. Browser will ask for permission to access folder contents — this is normal security behaviour."
                      >
                        Multiple files in a folder (one hash, served as a website)
                      </label>
                    </div>

                    <div className={styles.fileInputWrapper}>
                      <input
                        type="file"
                        multiple={isMultipleFiles || isFolderUpload}
                        {...(isFolderUpload && { webkitdirectory: 'true' })}
                        onChange={e => {
                          const files = Array.from(e.target.files || []);
                          if (isFolderUpload) {
                            setSelectedFiles(files);
                            setSelectedFile(null);
                          } else if (isMultipleFiles) {
                            setSelectedFiles(files);
                            setSelectedFile(null);
                          } else {
                            setSelectedFile(files[0] || null);
                            setSelectedFiles([]);
                          }
                        }}
                        className={styles.fileInput}
                        disabled={uploadStep === 'uploading'}
                        id="file-upload"
                      />
                      <label htmlFor="file-upload" className={styles.fileInputLabel}>
                        {isFolderUpload
                          ? selectedFiles.length > 0
                            ? `Folder: ${
                                (selectedFiles[0] as File & { webkitRelativePath?: string })
                                  .webkitRelativePath?.split('/')[0] || 'folder'
                              } (${selectedFiles.length} files)`
                            : 'Select Folder (auto-index)'
                          : isMultipleFiles
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

                    {(selectedFile || selectedFiles.length > 0) && (
                      <div className={styles.fileSizeInfo}>
                        <div className={styles.fileSizeTotal}>
                          Total size: {formatFileSize(getTotalFileSize())}
                        </div>
                        {!exceedsMaximumUploadSize() && hasVeryLargeFiles() && (
                          <div className={styles.largeFileWarning}>
                            ⚠️ Large file detected ({'>'}2GB). Self-custody upload chunks +
                            stamps locally — keep this tab open and your wallet unlocked
                            throughout. Aborting in the middle is safe (the chunks are
                            idempotent), but the upload won't resume from where it stopped.
                          </div>
                        )}
                        {exceedsMaximumUploadSize() && (
                          <div className={styles.errorMessage}>
                            ❌ Total upload size exceeds the maximum allowed of{' '}
                            {FILE_SIZE_CONFIG.maximumFileGB}GB. Pick smaller / fewer files.
                          </div>
                        )}
                      </div>
                    )}

                    {/* Single-file ZIP/GZ extras: serve uncompressed (extract
                        the archive locally and build a Mantaray manifest)
                        and the NFT-collection toggle. Same toggles as 1.1.x;
                        both feed into the new self-custody pipeline. */}
                    {!isMultipleFiles &&
                      !isFolderUpload &&
                      (selectedFile?.name.toLowerCase().endsWith('.zip') ||
                        selectedFile?.name.toLowerCase().endsWith('.tar') ||
                        selectedFile?.name.toLowerCase().endsWith('.tar.gz') ||
                        selectedFile?.name.toLowerCase().endsWith('.tgz') ||
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
                            <span
                              className={styles.tooltip}
                              title="Extract the archive locally, upload each file as its own Mantaray fork. The folder will be browseable via index.html on the resulting reference."
                            >
                              ?
                            </span>
                          </label>
                        </div>
                      )}

                    {!isMultipleFiles &&
                      !isFolderUpload &&
                      selectedFile?.name.toLowerCase().endsWith('.zip') && (
                        <div className={styles.checkboxWrapper}>
                          <input
                            type="checkbox"
                            id="nft-collection"
                            checked={isNFTCollection}
                            onChange={e => {
                              setIsNFTCollection(e.target.checked);
                              if (e.target.checked) {
                                setServeUncompressed(false);
                              }
                            }}
                            className={styles.checkbox}
                            disabled={uploadStep === 'uploading'}
                          />
                          <label htmlFor="nft-collection" className={styles.checkboxLabel}>
                            Upload NFT collection
                            <span
                              className={styles.tooltip}
                              title="Upload a ZIP file containing 'images' and 'json' folders. Images are uploaded as one Mantaray collection; JSON metadata is rewritten to point at bzz.link URLs and uploaded as a second collection."
                            >
                              ?
                            </span>
                          </label>
                        </div>
                      )}

                    <button
                      onClick={handleFileUpload}
                      disabled={
                        (isMultipleFiles || isFolderUpload
                          ? selectedFiles.length === 0
                          : !selectedFile) ||
                        uploadStep === 'uploading' ||
                        exceedsMaximumUploadSize() ||
                        // Block uploads when we KNOW the gateway is broken.
                        // 'unknown' (no probe yet) and 'checking' do NOT
                        // block — we'd rather let an early upload through
                        // than block on a slow first probe.
                        beeNodeHealth.state.status === 'unreachable' ||
                        beeNodeHealth.state.status === 'unhealthy'
                      }
                      className={styles.uploadButton}
                    >
                      {uploadStep === 'uploading' ? (
                        <>
                          <div className={styles.smallSpinner}></div>
                          {statusMessage.step === 'Uploading'
                            ? isDistributing
                              ? 'Distributing file chunks...'
                              : `Uploading... ${uploadProgress.toFixed(1)}%`
                            : 'Processing...'}
                        </>
                      ) : isMultipleFiles ? (
                        `Upload ${selectedFiles.length} files`
                      ) : isFolderUpload ? (
                        `Upload folder (${selectedFiles.length} files)`
                      ) : isNFTCollection ? (
                        'Upload NFT collection'
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
                <h3>
                  {multiFileResults.length > 0
                    ? 'Upload Complete!'
                    : nftCollectionResult
                      ? 'NFT Collection Uploaded Successfully!'
                      : 'Upload Successful!'}
                </h3>

                {/* Multi-file: list each file with its own reference. */}
                {multiFileResults.length > 0 ? (
                  <div className={styles.multiFileResults}>
                    {multiFileResults.map((result, index) => (
                      <div
                        key={index}
                        className={`${styles.fileResult} ${
                          result.success ? styles.success : styles.error
                        }`}
                      >
                        <div className={styles.fileResultHeader}>
                          <span className={styles.fileResultName}>{result.filename}</span>
                          <span
                            className={`${styles.fileResultStatus} ${
                              result.success ? styles.success : styles.error
                            }`}
                          >
                            {result.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                        {result.success && result.reference && (
                          <div
                            className={styles.fileResultReference}
                            onClick={() => {
                              navigator.clipboard.writeText(result.reference || '');
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
                  // NFT collection: two references with their own copy/open
                  // controls. Mirrors the old custodial UI exactly so any
                  // downstream NFT-deploy scripts that screen-scrape this
                  // panel keep working.
                  <div className={styles.nftCollectionResults}>
                    <div className={styles.nftCollectionSummary}>
                      <p>
                        {nftCollectionResult.totalImages} images and{' '}
                        {nftCollectionResult.totalMetadata} metadata files processed
                      </p>
                    </div>

                    <div className={styles.nftReferenceGroup}>
                      {(() => {
                        const base = beeApiUrl.endsWith('/')
                          ? `${beeApiUrl}bzz/`
                          : `${beeApiUrl}/bzz/`;
                        const stripHexLocal = (h: string) =>
                          h.startsWith('0x') ? h.slice(2) : h;
                        const imagesRef = stripHexLocal(nftCollectionResult.imagesReference);
                        const metadataRef = stripHexLocal(
                          nftCollectionResult.metadataReference
                        );
                        return (
                          <>
                            <div className={styles.referenceBox}>
                              <p>
                                <strong>Images Reference:</strong>
                              </p>
                              <div className={styles.referenceCopyWrapper}>
                                <code
                                  className={styles.referenceCode}
                                  onClick={() => {
                                    navigator.clipboard.writeText(imagesRef);
                                  }}
                                  data-copied="false"
                                >
                                  {imagesRef}
                                </code>
                              </div>
                              <div className={styles.linkButtonsContainer}>
                                <button
                                  className={`${styles.referenceLink} ${styles.copyLinkButton}`}
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${base}${imagesRef}/`);
                                  }}
                                >
                                  Copy images link
                                </button>
                                <a
                                  href={`${base}${imagesRef}/`}
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
                                    navigator.clipboard.writeText(metadataRef);
                                  }}
                                  data-copied="false"
                                >
                                  {metadataRef}
                                </code>
                              </div>
                              <div className={styles.linkButtonsContainer}>
                                <button
                                  className={`${styles.referenceLink} ${styles.copyLinkButton}`}
                                  onClick={() => {
                                    navigator.clipboard.writeText(`${base}${metadataRef}/`);
                                  }}
                                >
                                  Copy metadata link
                                </button>
                                <a
                                  href={`${base}${metadataRef}/`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={styles.referenceLink}
                                >
                                  View metadata
                                </a>
                              </div>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ) : (
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
                    {(() => {
                      // Resolve the retrieval URL against the same Bee node we
                      // uploaded to, not the hard-coded public gateway. When a
                      // user is talking to their own bee (e.g. localhost:1633)
                      // the chunks exist there first; the public gateway can't
                      // serve them until they propagate. So the link must
                      // follow `beeApiUrl`.
                      const base = beeApiUrl.endsWith('/')
                        ? `${beeApiUrl}bzz/`
                        : `${beeApiUrl}/bzz/`;
                      const retrievalUrl =
                        statusMessage.filename && !isArchiveFile(statusMessage.filename)
                          ? `${base}${statusMessage.reference}/${statusMessage.filename}`
                          : `${base}${statusMessage.reference}/`;
                      return (
                        <div className={styles.linkButtonsContainer}>
                          <button
                            className={`${styles.referenceLink} ${styles.copyLinkButton}`}
                            onClick={() => {
                              navigator.clipboard.writeText(retrievalUrl);
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
                            href={retrievalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={styles.referenceLink}
                          >
                            Open link
                          </a>
                        </div>
                      );
                    })()}
                  </div>
                )}

                {uploadStampInfo && multiFileResults.length === 0 && !nftCollectionResult && (
                  <div className={styles.stampInfoBox}>
                    <h4>Storage Stamps Details</h4>
                    <div className={styles.stampDetails}>
                      <div className={styles.stampDetail}>
                        <span>Utilization:</span>
                        <span>
                          {getStampUsage(
                            uploadStampInfo.utilization || 0,
                            uploadStampInfo.depth || 0
                          ).toFixed(2)}
                          %
                        </span>
                      </div>
                      <div className={styles.stampDetail}>
                        <span>Total Size:</span>
                        <span>{uploadStampInfo.totalSize}</span>
                      </div>
                      <div className={styles.stampDetail}>
                        <span>Created:</span>
                        <span>{uploadStampInfo.createdDate || 'Unknown'}</span>
                      </div>
                      <div className={styles.stampDetail}>
                        <span>Expires in:</span>
                        <span>{formatExpiryTime(uploadStampInfo.batchTTL)}</span>
                      </div>
                    </div>
                    <div className={styles.utilizationBarContainer}>
                      <div
                        className={styles.utilizationBar}
                        style={{
                          width: `${getStampUsage(uploadStampInfo.utilization || 0, uploadStampInfo.depth || 0).toFixed(2)}%`,
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
                    setMultiFileResults([]);
                    setNftCollectionResult(null);
                    setIsDistributing(false);
                    setUploadStampInfo(null);
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
                  <div className={styles.updateDelayNotice}>
                    ⏱️ It will take a few minutes for the stamp expiry to be updated
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
                    setIsNewStampCreated(false); // Reset the new stamp warning

                    // Clear the topup parameter from URL and return to clean state
                    if (typeof window !== 'undefined') {
                      const url = new URL(window.location.href);
                      if (url.searchParams.has('topup')) {
                        // Remove the topup parameter and navigate to clean URL
                        window.location.href = window.location.origin;
                      }
                    }
                  }}
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SwapComponent;
