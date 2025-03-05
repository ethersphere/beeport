import React, { useState } from "react";
import { formatUnits } from "viem";
import styles from "./css/SearchableTokenDropdown.module.css";
import { toChecksumAddress, formatTokenBalance } from "./utils";
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
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const getLoadingText = () => {
    if (isWalletLoading) return "Loading wallet...";
    if (!isConnected) return "Connect wallet to see tokens";
    if (isTokensLoading) return "Loading tokens...";
    return "Select Token";
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

  const availableTokensList =
    isConnected &&
    !isWalletLoading &&
    !isTokensLoading &&
    availableTokens?.tokens[selectedChainId]
      ?.map((token: any) => {
        if (!token.address) return null;

        const checksumTokenAddress = toChecksumAddress(token.address);
        if (!checksumTokenAddress) {
          console.log("Invalid token address:", token);
          return null;
        }

        const balance = tokenBalances?.[selectedChainId]?.find(
          (t: any) => toChecksumAddress(t.address) === checksumTokenAddress
        );
        const balanceInTokens = balance
          ? formatUnits(balance.amount || 0n, token.decimals)
          : "0";
        const usdValue = Number(balanceInTokens) * Number(token.priceUSD);

        if (
          usdValue >= minBalanceUsd ||
          checksumTokenAddress === toChecksumAddress(fromToken)
        ) {
          return {
            token,
            balance: Number(balanceInTokens),
            usdValue,
            address: checksumTokenAddress,
          };
        }
        return null;
      })
      .filter((item: any) => item !== null)
      .sort((a: any, b: any) => b.usdValue - a.usdValue);

  return (
    <div className={styles.dropdownContainer}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ""}`}
        onClick={() => {
          if (
            !isWalletLoading &&
            !isTokensLoading &&
            availableTokensList &&
            availableTokensList.length > 1
          ) {
            setIsOpen(!isOpen);
          }
        }}
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
                setIsOpen(false);
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
