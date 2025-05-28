import React, { useState, useEffect } from 'react';
import { formatUnits } from 'viem';
import styles from './css/SearchableTokenDropdown.module.css';
import { toChecksumAddress } from './utils';
import { MIN_TOKEN_BALANCE_USD } from './constants';

// List of popular tokens to show when wallet is not connected
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

interface TokenDropdownProps {
  fromToken: string;
  selectedChainId: number;
  isWalletLoading: boolean;
  isTokensLoading: boolean;
  isConnected: boolean;
  tokenBalances: any;
  selectedTokenInfo: any;
  onTokenSelect: (address: string, tokenInfo: any) => void;
  minBalanceUsd?: number;
  activeDropdown: string | null;
  onOpenDropdown: (name: string) => void;
  availableTokens?: any;
}

const SearchableTokenDropdown: React.FC<TokenDropdownProps> = ({
  fromToken,
  selectedChainId,
  isWalletLoading,
  isTokensLoading,
  isConnected,
  tokenBalances,
  selectedTokenInfo,
  onTokenSelect,
  minBalanceUsd = MIN_TOKEN_BALANCE_USD,
  activeDropdown,
  onOpenDropdown,
  availableTokens,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getLoadingText = () => {
    if (isWalletLoading || isTokensLoading) {
      return 'Finding tokens...';
    }
    if (!isConnected) {
      return 'Connect wallet to see balances';
    }
    return 'No tokens with balance';
  };

  const renderTokenContent = (token: any, balance?: number, usdValue?: number) => (
    <>
      <div className={styles.tokenLeft}>
        {token.logoURI && (
          <img
            src={token.logoURI}
            alt={token.symbol}
            className={styles.tokenLogo}
            onError={e => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        )}
        <span className={styles.tokenSymbol}>{token.symbol}</span>
      </div>
      <div className={styles.tokenRight}>
        {isConnected && balance !== undefined && usdValue !== undefined ? (
          <>
            <span>{balance.toFixed(4)}</span>
            <span className={styles.tokenUsdValue}>(${usdValue.toFixed(2)})</span>
          </>
        ) : (
          <span className={styles.tokenUsdValue}>-</span>
        )}
      </div>
    </>
  );

  // Helper function to deduplicate tokens by symbol, preferring tokens with images
  const deduplicateTokens = (tokens: any[]) => {
    const seenSymbols = new Set<string>();
    const uniqueTokens: any[] = [];

    // Sort tokens to prioritize those with logoURI first
    const sortedTokens = [...tokens].sort((a, b) => {
      const aHasLogo = Boolean(a.token ? a.token.logoURI : a.logoURI);
      const bHasLogo = Boolean(b.token ? b.token.logoURI : b.logoURI);

      if (aHasLogo && !bHasLogo) return -1;
      if (!aHasLogo && bHasLogo) return 1;
      return 0;
    });

    for (const tokenData of sortedTokens) {
      const token = tokenData.token || tokenData;
      const symbol = token.symbol;

      if (!seenSymbols.has(symbol)) {
        seenSymbols.add(symbol);
        uniqueTokens.push(tokenData);
      }
    }

    return uniqueTokens;
  };

  // Get available tokens list based on connection status
  const availableTokensList = isConnected
    ? // When connected, show tokens with balance above minimum
      deduplicateTokens(
        tokenBalances?.[selectedChainId]
          ?.filter((token: any) => {
            const balance = Number(formatUnits(token.amount || 0n, token.decimals));
            const usdValue = balance * Number(token.priceUSD);
            return usdValue >= minBalanceUsd;
          })
          .map((token: any) => {
            const balance = Number(formatUnits(token.amount || 0n, token.decimals));
            const usdValue = balance * Number(token.priceUSD);
            return { token, balance, usdValue, address: token.address };
          }) || []
      ).sort((a: any, b: any) => b.usdValue - a.usdValue)
    : // When not connected, show only popular tokens
      deduplicateTokens(
        availableTokens?.tokens?.[selectedChainId]
          ?.filter((token: any) => POPULAR_TOKENS.includes(token.symbol))
          .map((token: any) => ({
            token,
            address: token.address,
          })) || []
      ).sort((a: any, b: any) => {
        // Sort by popularity order (index in POPULAR_TOKENS array)
        const aIndex = POPULAR_TOKENS.indexOf(a.token.symbol);
        const bIndex = POPULAR_TOKENS.indexOf(b.token.symbol);
        return aIndex - bIndex;
      });

  useEffect(() => {
    // Reset token selection when chain changes
    onTokenSelect('', null);
  }, [selectedChainId]);

  useEffect(() => {
    if (availableTokensList?.length > 0 && !selectedTokenInfo) {
      const firstTokenData = availableTokensList[0];
      const firstToken = isConnected
        ? tokenBalances?.[selectedChainId]?.find(
            (t: any) => toChecksumAddress(t.address) === firstTokenData.address
          )
        : firstTokenData.token;

      if (firstToken) {
        onTokenSelect(firstTokenData.address, firstToken);
      }
    }
  }, [availableTokensList, selectedTokenInfo, selectedChainId, isConnected]);

  useEffect(() => {
    // Close this dropdown if another one opens
    if (activeDropdown !== 'token' && isOpen) {
      setIsOpen(false);
    }
  }, [activeDropdown, isOpen]);

  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    // Notify parent component
    if (newIsOpen) {
      onOpenDropdown('token');
    } else {
      onOpenDropdown('');
    }
  };

  return (
    <div className={styles.dropdownContainer}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ''} ${
          availableTokensList && availableTokensList.length > 1 ? styles.clickable : ''
        }`}
        onClick={toggleDropdown}
      >
        {selectedTokenInfo ? (
          renderTokenContent(
            selectedTokenInfo,
            isConnected
              ? Number(formatUnits(selectedTokenInfo.amount || 0n, selectedTokenInfo.decimals))
              : undefined,
            isConnected
              ? Number(formatUnits(selectedTokenInfo.amount || 0n, selectedTokenInfo.decimals)) *
                  Number(selectedTokenInfo.priceUSD)
              : undefined
          )
        ) : (
          <div className={styles.placeholder}>{getLoadingText()}</div>
        )}
      </div>

      {isOpen && availableTokensList && availableTokensList.length > 1 && (
        <div className={styles.dropdown}>
          {availableTokensList?.map((tokenData: any) => {
            const { token, balance, usdValue, address } = tokenData;
            return (
              <div
                key={address}
                className={`${styles.option} ${address === fromToken ? styles.selected : ''}`}
                onClick={() => {
                  const selectedToken = isConnected
                    ? tokenBalances?.[selectedChainId]?.find(
                        (t: any) => toChecksumAddress(t.address) === address
                      )
                    : token;
                  onTokenSelect(address, selectedToken);
                  toggleDropdown();
                }}
              >
                {renderTokenContent(token, balance, usdValue)}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default SearchableTokenDropdown;
