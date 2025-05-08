import React, { useState, useEffect, useRef } from 'react';
import styles from './css/SearchableChainDropdown.module.css';
import { Chain } from '@lifi/sdk';

// Define priority chains that will appear at the top of the list
const PRIORITY_CHAINS = [
  100, // Gnosis (DAI) - First priority as it's the destination chain
  1, // Ethereum Mainnet
  8453, // Base
  42161, // Arbitrum
  10, // Optimism
  43114, // Avalanche
  56, // Binance Smart Chain
  137, // Polygon
]; // Prioritize Gnosis and other major chains

export interface ChainDropdownProps {
  selectedChainId: number;
  isLoading: boolean;
  availableChains: Chain[];
  onChainSelect: (chainId: number) => void;
  isChainsLoading: boolean;
  activeDropdown: string | null;
  onOpenDropdown: (name: string) => void;
  sortMethod?: 'priority' | 'alphabetical' | 'id'; // Optional sort method
}

const SearchableChainDropdown: React.FC<ChainDropdownProps> = ({
  selectedChainId,
  isLoading,
  availableChains,
  onChainSelect,
  activeDropdown,
  onOpenDropdown,
  sortMethod = 'priority', // Default to priority sorting
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedChain = availableChains.find(chain => chain.id === selectedChainId);

  // Filter chains based on search query
  const filteredChains = availableChains.filter(chain =>
    chain.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Sort the filtered chains based on the specified method
  const sortedChains = [...filteredChains].sort((a, b) => {
    // First handle priority sorting
    if (sortMethod === 'priority') {
      const aIndex = PRIORITY_CHAINS.indexOf(a.id);
      const bIndex = PRIORITY_CHAINS.indexOf(b.id);

      // If both chains are in priority list, sort by their position in the list
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // If only one chain is in priority list, it should come first
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;

      // If neither chain is in priority list, fall back to alphabetical sorting
      return a.name.localeCompare(b.name);
    }

    // Alphabetical sorting
    if (sortMethod === 'alphabetical') {
      return a.name.localeCompare(b.name);
    }

    // Chain ID sorting
    if (sortMethod === 'id') {
      return a.id - b.id;
    }

    return 0;
  });

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Close this dropdown if another one opens
    if (activeDropdown !== 'chain' && isOpen) {
      setIsOpen(false);
    }
  }, [activeDropdown, isOpen]);

  const toggleDropdown = () => {
    const newIsOpen = !isOpen;
    setIsOpen(newIsOpen);

    // Notify parent component
    if (newIsOpen) {
      onOpenDropdown('chain');
    } else {
      onOpenDropdown('');
    }
  };

  return (
    <div className={styles.dropdownContainer} ref={dropdownRef}>
      <div
        className={`${styles.dropdownButton} ${isOpen ? styles.open : ''}`}
        onClick={toggleDropdown}
      >
        {selectedChain ? (
          <div className={styles.selectedChain}>
            {selectedChain.logoURI && (
              <img
                src={selectedChain.logoURI}
                alt={selectedChain.name}
                className={styles.chainLogo}
                onError={e => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            )}
            <span className={styles.chainName}>{selectedChain.name}</span>
          </div>
        ) : (
          <div className={styles.placeholder}>
            {isLoading ? 'Loading chains...' : 'Select a chain'}
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
            onChange={e => setSearchQuery(e.target.value)}
            onClick={e => e.stopPropagation()}
          />
          {isLoading ? (
            <div className={styles.loadingIndicator}>Loading chains...</div>
          ) : sortedChains.length > 0 ? (
            sortedChains.map(chain => (
              <div
                key={chain.id}
                className={`${styles.option} ${
                  chain.id === selectedChainId ? styles.selected : ''
                }`}
                onClick={() => {
                  onChainSelect(chain.id);
                  setIsOpen(false);
                  setSearchQuery('');
                }}
              >
                <div className={styles.chainContainer}>
                  {chain.logoURI && (
                    <img
                      src={chain.logoURI}
                      alt={chain.name}
                      className={styles.chainLogo}
                      onError={e => {
                        (e.target as HTMLImageElement).style.display = 'none';
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
