import React, { useState, useEffect } from "react";
import { formatUnits } from "viem";
import styles from "./css/SearchableTokenDropdown.module.css";
import { toChecksumAddress } from "./utils";
import { MIN_TOKEN_BALANCE_USD } from "./constants";

interface TokenDropdownProps {
  fromToken: string;
  selectedChainId: number;
  isWalletLoading: boolean;
  isTokensLoading: boolean;
  isConnected: boolean;
  availableTokens: any;
  tokenBalances: any;
  selectedTokenInfo: any;
  onTokenSelect: (address: string, tokenInfo: any) => void;
  minBalanceUsd?: number;
  activeDropdown: string | null;
  onOpenDropdown: (name: string) => void;
}

const SearchableTokenDropdown: React.FC<TokenDropdownProps> = ({
  fromToken,
  selectedChainId,
  isWalletLoading,
  isTokensLoading,
  isConnected,
  availableTokens,
  tokenBalances,
  selectedTokenInfo,
  onTokenSelect,
  minBalanceUsd = MIN_TOKEN_BALANCE_USD,
  activeDropdown,
  onOpenDropdown,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getLoadingText = () => {
    if (isWalletLoading || isTokensLoading) {
      return "Finding tokens...";
    }
    if (!isConnected) {
      return "Connect wallet to see tokens";
    }
    return "No tokens with balance";
  };

  const renderTokenContent = (
    token: any,
    balance: number,
    usdValue: number
  ) => (
    <>
      <div className={styles.tokenLeft}>
        {token.logoURI && (
          <img
            src={token.logoURI}
            alt={token.symbol}
            className={styles.tokenLogo}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        )}
        <span className={styles.tokenSymbol}>{token.symbol}</span>
      </div>
      <div className={styles.tokenRight}>
        <span>{balance.toFixed(4)}</span>
        <span className={styles.tokenUsdValue}>(${usdValue.toFixed(2)})</span>
      </div>
    </>
  );

  const availableTokensList = tokenBalances?.[selectedChainId]
    ?.filter((token: any) => {
      const balance = Number(formatUnits(token.amount || 0n, token.decimals));
      const usdValue = balance * Number(token.priceUSD);
      return usdValue >= minBalanceUsd;
    })
    .map((token: any) => {
      const balance = Number(formatUnits(token.amount || 0n, token.decimals));
      const usdValue = balance * Number(token.priceUSD);
      return { token, balance, usdValue, address: token.address };
    })
    .sort((a: any, b: any) => b.usdValue - a.usdValue);

  useEffect(() => {
    // Reset token selection when chain changes
    onTokenSelect("", null);
  }, [selectedChainId]);

  useEffect(() => {
    if (availableTokensList?.length > 0 && !selectedTokenInfo) {
      const firstToken = tokenBalances?.[selectedChainId]?.find(
        (t: any) =>
          toChecksumAddress(t.address) === availableTokensList[0].address
      );
      if (firstToken) {
        onTokenSelect(availableTokensList[0].address, firstToken);
      }
    }
  }, [availableTokensList, selectedTokenInfo, selectedChainId]);

  useEffect(() => {
    // Close this dropdown if another one opens
    if (activeDropdown !== "token" && isOpen) {
      setIsOpen(false);
    }
  }, [activeDropdown, isOpen]);

  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    // Notify parent component
    if (newIsOpen) {
      onOpenDropdown("token");
    } else {
      onOpenDropdown("");
    }
  };

  return (
    <div className={styles.dropdownContainer}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ""} ${
          availableTokensList && availableTokensList.length > 1
            ? styles.clickable
            : ""
        }`}
        onClick={toggleDropdown}
      >
        {selectedTokenInfo ? (
          renderTokenContent(
            selectedTokenInfo,
            Number(
              formatUnits(
                selectedTokenInfo.amount || 0n,
                selectedTokenInfo.decimals
              )
            ),
            Number(
              formatUnits(
                selectedTokenInfo.amount || 0n,
                selectedTokenInfo.decimals
              )
            ) * Number(selectedTokenInfo.priceUSD)
          )
        ) : availableTokensList && availableTokensList.length > 0 ? (
          renderTokenContent(
            availableTokensList[0].token,
            availableTokensList[0].balance,
            availableTokensList[0].usdValue
          )
        ) : (
          <div className={styles.placeholder}>{getLoadingText()}</div>
        )}
      </div>

      {isOpen && availableTokensList && availableTokensList.length > 1 && (
        <div className={styles.dropdown}>
          {availableTokensList?.map(({ token, balance, usdValue, address }) => (
            <div
              key={address}
              className={`${styles.option} ${
                address === fromToken ? styles.selected : ""
              }`}
              onClick={() => {
                const selectedToken = tokenBalances?.[selectedChainId]?.find(
                  (t: any) => toChecksumAddress(t.address) === address
                );
                onTokenSelect(address, selectedToken);
                toggleDropdown();
              }}
            >
              {renderTokenContent(token, balance, usdValue)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SearchableTokenDropdown;
