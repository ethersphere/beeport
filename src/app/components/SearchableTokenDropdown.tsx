import React from "react";
import { formatUnits } from "viem";
import styles from "./css/SearchableTokenDropdown.module.css";
import { toChecksumAddress } from "./utils";

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
}) => {
  const getLoadingText = () => {
    if (isWalletLoading) return "Loading wallet...";
    if (!isConnected) return "Connect wallet to see tokens";
    if (isTokensLoading) return "Loading tokens...";
    return "Select Token";
  };

  return (
    <div className={styles.selectWrapper}>
      <select
        className={styles.select}
        value={fromToken}
        onChange={(e) => {
          const checksumAddress = toChecksumAddress(e.target.value);
          if (checksumAddress) {
            const token = tokenBalances?.[selectedChainId]?.find(
              (t: any) => toChecksumAddress(t.address) === checksumAddress
            );
            onTokenSelect(checksumAddress, token);
          }
        }}
        disabled={isWalletLoading || isTokensLoading}
      >
        <option value="" className={styles.tokenOption}>
          {getLoadingText()}
        </option>
        {isConnected &&
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
                (t: any) =>
                  toChecksumAddress(t.address) === checksumTokenAddress
              );
              const balanceInTokens = balance
                ? formatUnits(balance.amount || 0n, token.decimals)
                : "0";
              const usdValue = Number(balanceInTokens) * Number(token.priceUSD);

              if (
                Number(balanceInTokens) > 0 ||
                checksumTokenAddress === toChecksumAddress(fromToken)
              ) {
                return {
                  token,
                  balance: Number(balanceInTokens),
                  usdValue,
                  address: checksumTokenAddress,
                  symbol: token.symbol,
                };
              }
              return null;
            })
            .filter((item: any) => item !== null)
            .sort((a: any, b: any) => b.usdValue - a.usdValue)
            .map(({ token, balance, usdValue }: any) => (
              <option
                key={token.address}
                value={token.address}
                className={styles.tokenOption}
              >
                {`${token.symbol} - ${balance.toFixed(4)} ($${usdValue.toFixed(
                  2
                )})`}
              </option>
            ))}
      </select>
      {selectedTokenInfo && (
        <div className={styles.tokenBalance}>
          <div className={styles.balanceAmount}>
            {Number(
              formatUnits(
                selectedTokenInfo.amount || 0n,
                selectedTokenInfo.decimals
              )
            ).toFixed(4)}
          </div>
          <div className={styles.balanceUsd}>
            $
            {(
              Number(
                formatUnits(
                  selectedTokenInfo.amount || 0n,
                  selectedTokenInfo.decimals
                )
              ) * Number(selectedTokenInfo.priceUSD)
            ).toFixed(2)}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableTokenDropdown;
