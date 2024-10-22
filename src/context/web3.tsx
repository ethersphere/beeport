"use client";

import { createWeb3Modal, defaultConfig } from "@web3modal/ethers/react";
import { METADATA_SITE, PUBLIC_URL_DOMAIN } from "@/constants";
import { gnosis, sepolia } from "@/helpers/networks";

// import { createAppKit } from '@reown/appkit/react'
// import { EthersAdapter } from '@reown/appkit-adapter-ethers'
// import { mainnet, arbitrum } from '@reown/appkit/networks'

// types
import type { metadataType } from "@/types/web3";
const PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID!;

const projectId = PROJECT_ID;
if (!projectId) {
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");
}

// Create Ethers config
const ethersConfig = defaultConfig({
  /*Required*/
  metadata: {
    ...METADATA_SITE,
    url: PUBLIC_URL_DOMAIN,
  },

  /*Optional*/
  enableEIP6963: true, // true by default
  enableInjected: true, // true by default
  enableCoinbase: true, // true by default
  defaultChainId: 1, // used for the Coinbase SDK
});

// Create a AppKit instance
createWeb3Modal({
  ethersConfig,
  chains: [sepolia, gnosis],
  defaultChain: sepolia,
  projectId,
  enableAnalytics: true, // Optional - defaults to your Cloud configuration
});

export function AppKit({ children }: { children: React.ReactNode }) {
  return children;
}
