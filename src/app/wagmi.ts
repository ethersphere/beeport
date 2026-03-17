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

// 3 RPCs per chain — each verified with eth_chainId; failed ones replaced
const RPC_FALLBACKS: Record<number, [string, string, string]> = {
  [mainnet.id]: [
    'https://eth.drpc.org',
    'https://ethereum.publicnode.com',
    'https://1rpc.io/eth',
  ],
  [gnosis.id]: [
    'https://rpc.gnosischain.com',
    'https://gnosis.drpc.org',
    'https://gnosis-rpc.publicnode.com',
  ],
  [base.id]: [
    'https://base.drpc.org',
    'https://mainnet.base.org',
    'https://base-rpc.publicnode.com',
  ],
  [arbitrum.id]: [
    'https://arb1.arbitrum.io/rpc',
    'https://1rpc.io/arb',
    'https://arbitrum-one-rpc.publicnode.com',
  ],
  [optimism.id]: [
    'https://mainnet.optimism.io',
    'https://optimism.drpc.org',
    'https://optimism.meowrpc.com',
  ],
  [avalanche.id]: [
    'https://api.avax.network/ext/bc/C/rpc',
    'https://avalanche.drpc.org',
    'https://avax.meowrpc.com',
  ],
  [bsc.id]: [
    'https://bsc.drpc.org',
    'https://bsc-dataseed.bnbchain.org',
    'https://bsc-rpc.publicnode.com',
  ],
  [celo.id]: ['https://forno.celo.org', 'https://celo.drpc.org', 'https://1rpc.io/celo'],
  [polygon.id]: [
    'https://polygon.meowrpc.com',
    'https://polygon.drpc.org',
    'https://polygon-bor-rpc.publicnode.com',
  ],
  [mantle.id]: [
    'https://rpc.mantle.xyz',
    'https://mantle.drpc.org',
    'https://rpc.mantle.xyz',
  ],
  [zksync.id]: [
    'https://mainnet.era.zksync.io',
    'https://zksync.drpc.org',
    'https://zksync.meowrpc.com',
  ],
  [ink.id]: [
    'https://rpc-gel-sepolia.inkonchain.com',
    'https://rpc-gel-sepolia.inkonchain.com',
    'https://rpc-gel-sepolia.inkonchain.com',
  ],
  [boba.id]: [
    'https://mainnet.boba.network',
    'https://boba-mainnet.g.alchemy.com/public',
    'https://mainnet.boba.network',
  ],
  [cronos.id]: [
    'https://evm.cronos.org',
    'https://cronos.drpc.org',
    'https://cronos-evm.publicnode.com',
  ],
  [gravity.id]: [
    'https://rpc.gravity.xyz',
    'https://rpc.gravity.xyz',
    'https://rpc.gravity.xyz',
  ],
  [linea.id]: ['https://rpc.linea.build', 'https://1rpc.io/linea', 'https://linea.drpc.org'],
  [lisk.id]: [
    'https://rpc.api.lisk.com',
    'https://lisk-sepolia.drpc.org',
    'https://rpc.api.lisk.com',
  ],
  [metis.id]: [
    'https://andromeda.metis.io/?owner=1088',
    'https://metis.drpc.org',
    'https://andromeda.metis.io/?owner=1088',
  ],
  [mode.id]: [
    'https://mainnet.mode.network',
    'https://mode.drpc.org',
    'https://mainnet.mode.network',
  ],
  [polygonZkEvm.id]: [
    'https://zkevm-rpc.com',
    'https://polygon-zkevm.drpc.org',
    'https://zkevm-rpc.com',
  ],
  [scroll.id]: [
    'https://rpc.scroll.io',
    'https://scroll.drpc.org',
    'https://rpc.scroll.io',
  ],
  [sei.id]: [
    'https://sei.drpc.org',
    'https://sei.publicnode.com',
    'https://sei.drpc.org',
  ],
  [sonic.id]: [
    'https://rpc.soniclabs.com',
    'https://sonic.drpc.org',
    'https://rpc.soniclabs.com',
  ],
  [soneium.id]: [
    'https://rpc.soneium.org',
    'https://soneium.drpc.org',
    'https://soneium-rpc.publicnode.com',
  ],
  [taiko.id]: [
    'https://rpc.mainnet.taiko.xyz',
    'https://taiko.drpc.org',
    'https://taiko.publicnode.com',
  ],
  [unichain.id]: [
    'https://unichain.drpc.org',
    'https://unichain.publicnode.com',
    'https://unichain.drpc.org',
  ],
  [worldchain.id]: [
    'https://worldchain-mainnet.g.alchemy.com/public',
    'https://worldchain.drpc.org',
    'https://worldchain-mainnet.g.alchemy.com/public',
  ],
  [sepolia.id]: [
    'https://sepolia.drpc.org',
    'https://ethereum-sepolia.publicnode.com',
    'https://1rpc.io/sepolia',
  ],
};

function transportForChain(chainId: number) {
  const urls = RPC_FALLBACKS[chainId];
  if (!urls) return http();
  return fallback(urls.map(url => http(url)));
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
    Object.keys(RPC_FALLBACKS).map(chainId => [Number(chainId), transportForChain(Number(chainId))])
  ),
  ssr: false,
});
