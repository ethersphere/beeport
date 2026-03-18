import { ChainType, getTokenBalancesByChain, getTokens, TokensResponse } from '@lifi/sdk';
import { useState, useCallback } from 'react';
import { type PublicClient, formatUnits, parseAbi } from 'viem';
import { performWithRetry, toChecksumAddress } from './utils';

const BALANCE_OF_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

const MULTICALL_BATCH_SIZE = 100;

/**
 * Fetches token balances in one or few RPC calls via multicall instead of N separate calls.
 * Returns same shape as getTokenBalancesByChain for a single chain.
 */
async function getTokenBalancesViaMulticall(
  publicClient: PublicClient,
  address: string,
  tokens: any[],
  chainId: number
): Promise<Record<number, any[]>> {
  if (tokens.length === 0) return { [chainId]: [] };

  const results: Record<number, any[]> = { [chainId]: [] };
  const userAddress = address as `0x${string}`;

  for (let i = 0; i < tokens.length; i += MULTICALL_BATCH_SIZE) {
    const chunk = tokens.slice(i, i + MULTICALL_BATCH_SIZE);
    const multicallResults = await publicClient.multicall({
      contracts: chunk.map((token) => ({
        address: token.address as `0x${string}`,
        abi: BALANCE_OF_ABI,
        functionName: 'balanceOf',
        args: [userAddress],
      })),
    });

    for (let j = 0; j < chunk.length; j++) {
      const token = chunk[j];
      const amount = (multicallResults[j]?.result as bigint) ?? 0n;
      results[chainId].push({ ...token, amount });
    }
  }

  return results;
}

// List of popular tokens to prioritize when wallet is not connected
const POPULAR_TOKENS = [
  'ETH',
  'USDC',
  'USDT',
  'WETH',
  'DAI',
  'WBTC',
  'LINK',
  'UNI',
  'AAVE',
  'MATIC',
];

/**
 * Interface for token information
 */
export interface TokenInfo {
  address: string;
  symbol: string;
  decimals: number;
  name: string;
  chainId: number;
  logoURI?: string;
  amount?: bigint;
  priceUSD?: string;
}

/**
 * Result interface for useTokenManagement hook
 */
export interface TokenManagementResult {
  fromToken: string;
  setFromToken: (token: string) => void;
  selectedTokenInfo: TokenInfo | null;
  setSelectedTokenInfo: (info: TokenInfo | null) => void;
  availableTokens: TokensResponse | null;
  tokenBalances: Record<string, any> | null;
  isTokensLoading: boolean;
  fetchTokensAndBalances: (currentChainId: number) => Promise<void>;
  resetTokens: () => void;
}

/**
 * Custom hook for token management
 *
 * @param address User wallet address
 * @param isConnected Connection status
 * @param publicClient Optional viem public client for current chain; when set, balances are fetched via multicall (1–2 RPCs) instead of LiFi SDK (many RPCs)
 * @returns TokenManagementResult object with token state and methods
 */
export const useTokenManagement = (
  address: string | undefined,
  isConnected: boolean,
  publicClient?: PublicClient | null
): TokenManagementResult => {
  const [fromToken, setFromToken] = useState('0x0000000000000000000000000000000000000000');
  const [selectedTokenInfo, setSelectedTokenInfo] = useState<TokenInfo | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokensResponse | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, any> | null>(null);
  const [isTokensLoading, setIsTokensLoading] = useState(true);

  /**
   * Reset token state
   */
  const resetTokens = useCallback(() => {
    setTokenBalances(null);
    setAvailableTokens(null);
    setFromToken('');
    setSelectedTokenInfo(null);
  }, []);

  /**
   * Fetch tokens and balances for a specific chain
   *
   * @param currentChainId The chain ID to fetch tokens for
   */
  const fetchTokensAndBalances = useCallback(
    async (currentChainId: number): Promise<void> => {
      if (!currentChainId) {
        resetTokens();
        return;
      }

      console.log('Using chain ID for token fetch:', currentChainId);
      setIsTokensLoading(true);
      try {
        // First fetch all available tokens with retry
        const tokens = await performWithRetry(
          () =>
            getTokens({
              chains: [currentChainId],
              chainTypes: [ChainType.EVM],
            }),
          'getTokens',
          result => Boolean(result?.tokens?.[currentChainId]?.length)
        );
        console.log('Available tokens:', tokens);
        setAvailableTokens(tokens);

        // Only fetch balances if wallet is connected
        if (address && isConnected) {
          const chainTokens = tokens.tokens[currentChainId] ?? [];
          let balances: Record<number, any[]>;

          if (publicClient && chainTokens.length > 0) {
            // One or two multicall RPCs instead of many separate calls
            balances = await getTokenBalancesViaMulticall(
              publicClient,
              address,
              chainTokens,
              currentChainId
            );
          } else {
            const tokensByChain = { [currentChainId]: chainTokens };
            balances = await performWithRetry(
              () => getTokenBalancesByChain(address, tokensByChain),
              'getTokenBalances',
              result => {
                const chainBalances = result?.[currentChainId];
                return Boolean(chainBalances && chainBalances.length > 0);
              }
            );
          }
          console.log('Token balances:', balances);
          setTokenBalances(balances);

          // Find tokens with balance
          if (balances?.[currentChainId]) {
            const tokensWithBalance = balances[currentChainId]
              .filter(t => (t?.amount ?? 0n) > 0n)
              .sort((a, b) => {
                const aUsdValue =
                  Number(formatUnits(a.amount || 0n, a.decimals)) * Number(a.priceUSD);
                const bUsdValue =
                  Number(formatUnits(b.amount || 0n, b.decimals)) * Number(b.priceUSD);
                return bUsdValue - aUsdValue;
              });

            // Deduplicate tokens by symbol, preferring those with logoURI
            const uniqueTokensWithBalance = tokensWithBalance.reduce((acc: any[], token: any) => {
              const existingToken = acc.find(t => t.symbol === token.symbol);
              if (!existingToken) {
                acc.push(token);
              } else if (token.logoURI && !existingToken.logoURI) {
                // Replace with token that has logoURI
                const index = acc.indexOf(existingToken);
                acc[index] = token;
              }
              return acc;
            }, []);

            console.log('Tokens with balance (deduplicated):', uniqueTokensWithBalance);

            // Set initial token if we have any with balance
            if (uniqueTokensWithBalance.length > 0) {
              const checksumAddress = toChecksumAddress(uniqueTokensWithBalance[0].address);
              if (checksumAddress) {
                setFromToken(checksumAddress);
                setSelectedTokenInfo(uniqueTokensWithBalance[0]);
              }
            }
          }
        } else {
          // When wallet is not connected, prefer popular tokens as default
          if (tokens.tokens[currentChainId] && tokens.tokens[currentChainId].length > 0) {
            // Deduplicate tokens by symbol, preferring those with logoURI
            const uniqueTokens = tokens.tokens[currentChainId].reduce((acc: any[], token: any) => {
              const existingToken = acc.find(t => t.symbol === token.symbol);
              if (!existingToken) {
                acc.push(token);
              } else if (token.logoURI && !existingToken.logoURI) {
                // Replace with token that has logoURI
                const index = acc.indexOf(existingToken);
                acc[index] = token;
              }
              return acc;
            }, []);

            // First try to find a popular token from deduplicated list
            const popularToken = uniqueTokens.find((token: any) =>
              POPULAR_TOKENS.includes(token.symbol)
            );

            // Use popular token if found, otherwise use first token from deduplicated list
            const defaultToken = popularToken || uniqueTokens[0];
            const checksumAddress = toChecksumAddress(defaultToken.address);

            if (checksumAddress) {
              setFromToken(checksumAddress);
              setSelectedTokenInfo({
                ...defaultToken,
                amount: 0n, // No balance when not connected
              });
            }
          }
        }
      } catch (error) {
        console.error('Error fetching tokens and balances:', error);
      } finally {
        setIsTokensLoading(false);
      }
    },
    [address, isConnected, publicClient, resetTokens]
  );

  return {
    fromToken,
    setFromToken,
    selectedTokenInfo,
    setSelectedTokenInfo,
    availableTokens,
    tokenBalances,
    isTokensLoading,
    fetchTokensAndBalances,
    resetTokens,
  };
};
