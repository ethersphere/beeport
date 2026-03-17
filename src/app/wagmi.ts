import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { fallback, http } from 'wagmi';
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

// 3 CORS-safe public RPCs per chain (from Chainlist) for fallback when one is down or blocked
const RPC_FALLBACKS: Record<number, [string, string, string]> = {
  [mainnet.id]: ['https://eth.llamarpc.com', 'https://ethereum.publicnode.com', 'https://1rpc.io/eth'],
  [gnosis.id]: ['https://rpc.gnosischain.com', 'https://gnosis.drpc.org', 'https://gnosis-rpc.publicnode.com'],
  [base.id]: ['https://base.llamarpc.com', 'https://mainnet.base.org', 'https://base-rpc.publicnode.com'],
  [arbitrum.id]: ['https://arb1.arbitrum.io/rpc', 'https://1rpc.io/arb', 'https://arbitrum-one-rpc.publicnode.com'],
  [optimism.id]: ['https://mainnet.optimism.io', 'https://optimism.drpc.org', 'https://optimism.one.rpc.blxrbdn.com'],
  [avalanche.id]: ['https://api.avax.network/ext/bc/C/rpc', 'https://avalanche.drpc.org', 'https://avax.meowrpc.com'],
  [bsc.id]: ['https://binance.llamarpc.com', 'https://bsc-dataseed.bnbchain.org', 'https://bsc-rpc.publicnode.com'],
  [celo.id]: ['https://forno.celo.org', 'https://celo.drpc.org', 'https://1rpc.io/celo'],
  [polygon.id]: ['https://polygon-rpc.com', 'https://polygon.drpc.org', 'https://polygon-bor-rpc.publicnode.com'],
  [mantle.id]: ['https://rpc.mantle.xyz', 'https://mantle.drpc.org', 'https://mantle-mainnet.public.blastapi.io'],
  [zksync.id]: ['https://mainnet.era.zksync.io', 'https://zksync.drpc.org', 'https://zksync.meowrpc.com'],
  [ink.id]: ['https://rpc-gel-sepolia.inkonchain.com', 'https://gel-sepolia.inkonchain.com', 'https://inkonchain-sepolia.rpc.blxrbdn.com'],
  [boba.id]: ['https://mainnet.boba.network', 'https://boba.drpc.org', 'https://boba.rpc.blxrbdn.com'],
  [cronos.id]: ['https://evm.cronos.org', 'https://cronos.drpc.org', 'https://cronos-evm.publicnode.com'],
  [gravity.id]: ['https://rpc.gravity.xyz', 'https://gravity.drpc.org', 'https://gravity-rpc.publicnode.com'],
  [linea.id]: ['https://rpc.linea.build', 'https://1rpc.io/linea', 'https://linea.drpc.org'],
  [lisk.id]: ['https://rpc.api.lisk.com', 'https://lisk-sepolia.drpc.org', 'https://rpc.sepolia.lisk.com'],
  [metis.id]: ['https://andromeda.metis.io/?owner=1088', 'https://metis.drpc.org', 'https://metis-mainnet.public.blastapi.io'],
  [mode.id]: ['https://mainnet.mode.network', 'https://mode.drpc.org', 'https://mode-mainnet.public.blastapi.io'],
  [polygonZkEvm.id]: ['https://zkevm-rpc.com', 'https://polygon-zkevm.drpc.org', 'https://polygon-zkevm-rpc.publicnode.com'],
  [scroll.id]: ['https://rpc.scroll.io', 'https://scroll.drpc.org', 'https://scroll-mainnet.public.blastapi.io'],
  [sei.id]: ['https://evm-rpc.sei.io', 'https://sei.drpc.org', 'https://sei-evm.publicnode.com'],
  [sonic.id]: ['https://rpc.soniclabs.com', 'https://sonic.drpc.org', 'https://sonic-mainnet.public.blastapi.io'],
  [soneium.id]: ['https://rpc.soneium.org', 'https://soneium.drpc.org', 'https://soneium-rpc.publicnode.com'],
  [taiko.id]: ['https://rpc.mainnet.taiko.xyz', 'https://taiko.drpc.org', 'https://taiko-mainnet.public.blastapi.io'],
  [unichain.id]: ['https://rpc.unichain.org', 'https://unichain.drpc.org', 'https://unichain-mainnet.public.blastapi.io'],
  [worldchain.id]: ['https://worldchain-mainnet.g.alchemy.com/public', 'https://worldchain.drpc.org', 'https://worldchain-mainnet.public.blastapi.io'],
  [sepolia.id]: ['https://rpc.sepolia.org', 'https://ethereum-sepolia.drpc.org', 'https://sepolia.drpc.org'],
};

const HTTP_TRANSPORT_OPTIONS = {
  retryCount: 3,
  retryDelay: 1000,
  timeout: 30_000,
};

// Polling intervals tuned to each chain's block time (ms).
// Polling faster than block time wastes requests; polling slower delays UX.
const CHAIN_POLLING_INTERVALS: Record<number, number> = {
  [mainnet.id]: 6_000,      // ~12s blocks — poll twice per block
  [sepolia.id]: 6_000,      // testnet, same as mainnet
  [gnosis.id]: 4_000,       // ~5s blocks
  [base.id]: 2_000,         // 2s blocks
  [arbitrum.id]: 1_000,     // 0.25s blocks
  [optimism.id]: 2_000,     // 2s blocks
  [avalanche.id]: 2_000,    // ~2s blocks
  [bsc.id]: 3_000,          // 3s blocks
  [celo.id]: 4_000,         // 5s blocks
  [polygon.id]: 2_000,      // ~2s blocks
  [mantle.id]: 2_000,       // ~2s blocks (L2)
  [zksync.id]: 2_000,       // ~1-2s blocks
  [ink.id]: 2_000,          // L2
  [boba.id]: 4_000,         // ~1 min L1 batches but L2 is faster
  [cronos.id]: 4_000,       // ~5s blocks
  [gravity.id]: 2_000,      // L2
  [linea.id]: 4_000,        // ~3-4s blocks
  [lisk.id]: 2_000,         // L2
  [metis.id]: 4_000,        // ~4s blocks
  [mode.id]: 2_000,         // L2 on Base stack
  [polygonZkEvm.id]: 4_000, // batched ~5-10s
  [scroll.id]: 3_000,       // ~3s blocks
  [sei.id]: 1_000,          // ~0.4s blocks
  [sonic.id]: 2_000,        // L2
  [soneium.id]: 2_000,      // L2
  [taiko.id]: 3_000,        // ~3s blocks
  [unichain.id]: 2_000,     // L2
  [worldchain.id]: 2_000,   // L2
};

const DEFAULT_POLLING_INTERVAL = 4_000;

/**
 * Returns the appropriate polling interval (ms) for a given chain ID,
 * tuned to block time so we don't spam RPCs on slow chains or lag on fast ones.
 */
export function getPollingInterval(chainId: number): number {
  return CHAIN_POLLING_INTERVALS[chainId] ?? DEFAULT_POLLING_INTERVAL;
}

function transportForChain(chainId: number) {
  const urls = RPC_FALLBACKS[chainId];
  if (!urls) return http(undefined, HTTP_TRANSPORT_OPTIONS);
  return fallback(urls.map((url) => http(url, HTTP_TRANSPORT_OPTIONS)));
}

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
  transports: Object.fromEntries(
    Object.keys(RPC_FALLBACKS).map((chainId) => [
      Number(chainId),
      transportForChain(Number(chainId)),
    ])
  ),
  pollingInterval: 6_000,
  ssr: false,
});
