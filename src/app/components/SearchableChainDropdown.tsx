import React, { useState, useEffect, useRef } from "react";
import styles from "./css/SearchableChainDropdown.module.css";
import { Chain } from "@lifi/sdk";

export interface ChainDropdownProps {
  selectedChainId: number;
  isLoading: boolean;
  availableChains: Chain[];
  onChainSelect: (chainId: number) => void;
  isChainsLoading: boolean;
}

const SearchableChainDropdown: React.FC<ChainDropdownProps> = ({
  selectedChainId,
  isLoading,
  availableChains,
  onChainSelect,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedChain = availableChains.find(
    (chain) => chain.id === selectedChainId
  );

  // Filter chains based on search query
  const filteredChains = availableChains.filter((chain) =>
    chain.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ""}`}
        onClick={() => !isLoading && setIsOpen(!isOpen)}
      >
        {selectedChain ? (
          <div className={styles.selectedChain}>
            {selectedChain.logoURI && (
              <img
                src={selectedChain.logoURI}
                alt={selectedChain.name}
                className={styles.chainLogo}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <span className={styles.chainName}>{selectedChain.name}</span>
          </div>
        ) : (
          <div className={styles.placeholder}>
            {isLoading ? "Loading chains..." : "Select a chain"}
          </div>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          fill="currentColor"
          viewBox="0 0 16 16"
        >
          <path
            fillRule="evenodd"
            d="M1.646 4.646a.5.5 0 0 1 .708 0L8 10.293l5.646-5.647a.5.5 0 0 1 .708.708l-6 6a.5.5 0 0 1-.708 0l-6-6a.5.5 0 0 1 0-.708z"
          />
        </svg>
      </div>

      {isOpen && (
        <div className={styles.dropdown}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search chains..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
          />
          {isLoading ? (
            <div className={styles.loadingIndicator}>Loading chains...</div>
          ) : filteredChains.length > 0 ? (
            filteredChains.map((chain) => (
              <div
                key={chain.id}
                className={`${styles.option} ${
                  chain.id === selectedChainId ? styles.selected : ""
                }`}
                onClick={() => {
                  onChainSelect(chain.id);
                  setIsOpen(false);
                  setSearchQuery("");
                }}
              >
                <div className={styles.chainContainer}>
                  {chain.logoURI && (
                    <img
                      src={chain.logoURI}
                      alt={chain.name}
                      className={styles.chainLogo}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span className={styles.chainName}>{chain.name}</span>
                </div>
              </div>
            ))
          ) : (
            <div className={styles.noResults}>No chains found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableChainDropdown;
