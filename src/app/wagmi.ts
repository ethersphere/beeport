import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import {
  mainnet, // Ethereum (1)
  gnosis, // Gnosis (100)
  base, // Base (8453)
  arbitrum, // Arbitrum (42161)
  optimism, // Optimism (10)
  avalanche, // Avalanche (43114)
  bsc, // BSC (56)
  celo, // Celo (42220)
  polygon, // Polygon (137)
  mantle, // Mantle (5000)
  zksync, // zkSync Era (324)
  ink, // Ink (57073)
  // Relay supported chains only
  boba, // Boba (288)
  cronos, // Cronos (25)
  gravity, // Gravity (1625)
  linea, // Linea (59144)
  lisk, // Lisk (1135)
  metis, // Metis (1088)
  mode, // Mode (34443)
  polygonZkEvm, // Polygon zkEVM (1101)
  scroll, // Scroll (534352)
  sei, // Sei (1329)
  sonic, // Sonic (146)
  soneium, // Soneium (1868)
  taiko, // Taiko (167000)
  unichain, // Unichain (130)
  worldchain, // World Chain (480)
  sepolia, // Sepolia testnet
} from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'RainbowKit demo',
  projectId: 'YOUR_PROJECT_ID',
  chains: [
    // Primary chains in specified order
    mainnet, // Ethereum (1)
    gnosis, // Gnosis (100)
    base, // Base (8453)
    arbitrum, // Arbitrum (42161)
    optimism, // Optimism (10)
    avalanche, // Avalanche (43114)
    bsc, // BSC (56)
    celo, // Celo (42220)
    polygon, // Polygon (137)
    mantle, // Mantle (5000)
    zksync, // zkSync Era (324)
    ink, // Ink (57073)
    // Additional Relay supported chains
    boba, // Boba (288)
    cronos, // Cronos (25)
    gravity, // Gravity (1625)
    linea, // Linea (59144)
    lisk, // Lisk (1135)
    metis, // Metis (1088)
    mode, // Mode (34443)
    polygonZkEvm, // Polygon zkEVM (1101)
    scroll, // Scroll (534352)
    sei, // Sei (1329)
    sonic, // Sonic (146)
    soneium, // Soneium (1868)
    taiko, // Taiko (167000)
    unichain, // Unichain (130)
    worldchain, // World Chain (480)
    // Testnets if enabled
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === 'true' ? [sepolia] : []),
  ],
  ssr: false,
});
