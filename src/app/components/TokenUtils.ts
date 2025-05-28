import { ChainType, getTokenBalancesByChain, getTokens, TokensResponse } from '@lifi/sdk';
import { useState } from 'react';
import { formatUnits } from 'viem';
import { performWithRetry, toChecksumAddress } from './utils';

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
 * @returns TokenManagementResult object with token state and methods
 */
export const useTokenManagement = (
  address: string | undefined,
  isConnected: boolean
): TokenManagementResult => {
  const [fromToken, setFromToken] = useState('0x0000000000000000000000000000000000000000');
  const [selectedTokenInfo, setSelectedTokenInfo] = useState<TokenInfo | null>(null);
  const [availableTokens, setAvailableTokens] = useState<TokensResponse | null>(null);
  const [tokenBalances, setTokenBalances] = useState<Record<string, any> | null>(null);
  const [isTokensLoading, setIsTokensLoading] = useState(true);

  /**
   * Reset token state
   */
  const resetTokens = () => {
    setTokenBalances(null);
    setAvailableTokens(null);
    setFromToken('');
    setSelectedTokenInfo(null);
  };

  /**
   * Fetch tokens and balances for a specific chain
   *
   * @param currentChainId The chain ID to fetch tokens for
   */
  const fetchTokensAndBalances = async (currentChainId: number): Promise<void> => {
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
        // Then get balances for these tokens with retry
        const tokensByChain = {
          [currentChainId]: tokens.tokens[currentChainId],
        };

        const balances = await performWithRetry(
          () => getTokenBalancesByChain(address, tokensByChain),
          'getTokenBalances',
          result => {
            // Validate that we have a non-empty balance result for the selected chain
            const chainBalances = result?.[currentChainId];
            return Boolean(chainBalances && chainBalances.length > 0);
          }
        );
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
  };

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
