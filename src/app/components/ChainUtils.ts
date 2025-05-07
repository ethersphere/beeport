import { useState, useEffect } from "react";
import { ChainType, getChains, Chain } from "@lifi/sdk";
import { useSwitchChain } from "wagmi";

/**
 * Interface for the result of the useChainSelection hook
 */
export interface UseChainSelectionResult {
  availableChains: Chain[] | null;
  isChainsLoading: boolean;
  selectedChainId: number | null;
  setSelectedChainId: (chainId: number | null) => void;
}

/**
 * Hook for managing chain selection
 */
export const useChainSelection = (
  isConnected: boolean,
  defaultChainId?: number
): UseChainSelectionResult => {
  const [availableChains, setAvailableChains] = useState<Chain[] | null>(null);
  const [isChainsLoading, setIsChainsLoading] = useState(true);
  const [selectedChainId, setSelectedChainId] = useState<number | null>(defaultChainId || null);
  const { switchChain } = useSwitchChain();

  // Function to fetch available chains
  const fetchChains = async () => {
    try {
      setIsChainsLoading(true);
      const chains = await getChains({ chainTypes: [ChainType.EVM] });
      setAvailableChains(chains);
    } catch (error) {
      console.error("Error fetching chains:", error);
    } finally {
      setIsChainsLoading(false);
    }
  };

  // Initialize chains when connected
  useEffect(() => {
    if (isConnected) {
      fetchChains();
    }
  }, [isConnected]);

  // Handle chain switching
  const handleChainSwitch = (chainId: number | null) => {
    setSelectedChainId(chainId);
    if (switchChain && chainId !== null) {
      switchChain({ chainId });
    }
  };

  return {
    availableChains,
    isChainsLoading,
    selectedChainId,
    setSelectedChainId: handleChainSwitch,
  };
};
