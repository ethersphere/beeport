import React, { useState } from "react";
import { Chain } from "@lifi/sdk";
import styles from "./css/SwapComponent.module.css";

interface SearchableChainDropdownProps {
  selectedChainId: number;
  availableChains: Chain[];
  onChainSelect: (chainId: number) => void;
  isChainsLoading: boolean;
}

const SearchableChainDropdown: React.FC<SearchableChainDropdownProps> = ({
  selectedChainId,
  availableChains,
  onChainSelect,
  isChainsLoading,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  console.log("Available chains:", availableChains);

  const filteredChains = availableChains.filter((chain) =>
    chain.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedChain = availableChains.find(
    (chain) => chain.id === selectedChainId
  );

  return (
    <div className={styles.selectWrapper}>
      <div
        className={`${styles.select} ${isOpen ? styles.open : ""}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedChain && (
          <div className={styles.chainItem}>
            <img
              src={selectedChain.logoURI}
              alt={selectedChain.name}
              className={styles.chainLogo}
            />
            <span>{selectedChain.name}</span>
          </div>
        )}
        {!selectedChain && "Select Chain"}
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search chains..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className={styles.optionsList}>
            {isChainsLoading ? (
              <div className={styles.option}>Loading chains...</div>
            ) : filteredChains.length === 0 ? (
              <div className={styles.option}>No chains found</div>
            ) : (
              filteredChains.map((chain) => (
                <div
                  key={chain.id}
                  className={`${styles.option} ${
                    selectedChainId === chain.id ? styles.selected : ""
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChainSelect(chain.id);
                    setIsOpen(false);
                  }}
                >
                  <div className={styles.chainItem}>
                    <img
                      src={chain.logoURI}
                      alt={chain.name}
                      className={styles.chainLogo}
                    />
                    <span>{chain.name}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchableChainDropdown;
