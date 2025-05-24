import { ChainId } from '@lifi/sdk';
import { StorageOption, SwarmConfigType } from './types';

// Environment variable configuration
export const GNOSIS_CUSTOM_REGISTRY_ADDRESS =
  process.env.NEXT_PUBLIC_GNOSIS_CUSTOM_REGISTRY_ADDRESS ||
  '0x5EBfBeFB1E88391eFb022d5d33302f50a46bF4f3';

export const LIFI_API_KEY =
  process.env.NEXT_PUBLIC_LIFI_API_KEY ||
  '83f85c7b-97d2-4130-95b0-f72af1f0261e.b11f7330-ebb1-4684-af33-f28759ec6853';

export const DEFAULT_NODE_ADDRESS =
  process.env.NEXT_PUBLIC_DEFAULT_NODE_ADDRESS || '0xb81784e65c84ca25b595ff4f0badb502673e343b';

export const LIFI_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_LIFI_CONTRACT_ADDRESS || '0x2dfaDAB8266483beD9Fd9A292Ce56596a2D1378D';

export const GNOSIS_BZZ_ADDRESS =
  process.env.NEXT_PUBLIC_GNOSIS_BZZ_ADDRESS || '0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da';

export const GNOSIS_STAMP_ADDRESS =
  process.env.NEXT_PUBLIC_GNOSIS_STAMP_ADDRESS || '0x45a1502382541Cd610CC9068e88727426b696293';

export const DEFAULT_BEE_API_URL =
  process.env.NEXT_PUBLIC_DEFAULT_BEE_API_URL || 'https://swarming.site';

export const BEE_GATEWAY_URL = `https://bzz.link/bzz/`;

export const GNOSIS_PRICE_ORACLE_ADDRESS =
  process.env.NEXT_PUBLIC_GNOSIS_PRICE_ORACLE_ADDRESS ||
  '0x47EeF336e7fE5bED98499A4696bce8f28c1B0a8b';

export const GNOSIS_DESTINATION_TOKEN =
  process.env.NEXT_PUBLIC_GNOSIS_DESTINATION_TOKEN || '0x0000000000000000000000000000000000000000';

export const GNOSIS_WXDAI_ADDRESS =
  process.env.NEXT_PUBLIC_GNOSIS_WXDAI_ADDRESS || '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d';

// Static configuration
export const MIN_TOKEN_BALANCE_USD = 0.5;

// Minimum USD value for bridging to avoid dust amounts
export const MIN_BRIDGE_USD_VALUE = 0.1;

export const DEFAULT_SLIPPAGE = 0.05; // This is 5% slippage

// Check if we're running on the production domain
const isProduction =
  typeof window !== 'undefined' && window.location.hostname === 'app.ethswarm.org';

// Define all time options
const ALL_TIME_OPTIONS = [
  { days: 1, display: '1 day' },
  { days: 2, display: '2 days' },
  { days: 7, display: '7 days' },
  { days: 15, display: '15 days' },
  { days: 30, display: '30 days' },
  { days: 90, display: '90 days' },
  { days: 180, display: '180 days' },
  { days: 365, display: '1 year' },
  { days: 365 * 2, display: '2 years' },
  { days: 365 * 5, display: '5 years' },
  { days: 365 * 10, display: '10 years' },
];

// Define production-only time options
const PRODUCTION_TIME_OPTIONS = [
  { days: 30, display: '30 days' },
  { days: 90, display: '90 days' },
  { days: 180, display: '180 days' },
  { days: 365, display: '1 year' },
  { days: 365 * 2, display: '2 years' },
  { days: 365 * 5, display: '5 years' },
  { days: 365 * 10, display: '10 years' },
];

// Export the appropriate options based on environment
export const TIME_OPTIONS = isProduction ? PRODUCTION_TIME_OPTIONS : ALL_TIME_OPTIONS;

// Define all storage options
const ALL_STORAGE_OPTIONS: StorageOption[] = [
  { depth: 19, size: '110MB' },
  { depth: 20, size: '680MB' },
  { depth: 21, size: '2.6GB' },
  { depth: 22, size: '7.7GB' },
  { depth: 23, size: '20GB' },
  { depth: 24, size: '47GB' },
  { depth: 25, size: '105GB' },
  { depth: 26, size: '227GB' },
  { depth: 27, size: '476GB' },
];

// Define production-only storage options
const PRODUCTION_STORAGE_OPTIONS: StorageOption[] = [
  { depth: 20, size: '680MB' },
  { depth: 21, size: '2.6GB' },
  { depth: 22, size: '7.7GB' },
  { depth: 23, size: '20GB' },
  { depth: 24, size: '47GB' },
  { depth: 25, size: '105GB' },
  { depth: 26, size: '227GB' },
  { depth: 27, size: '476GB' },
];

// Export the appropriate options based on environment
export const STORAGE_OPTIONS: StorageOption[] = isProduction
  ? PRODUCTION_STORAGE_OPTIONS
  : ALL_STORAGE_OPTIONS;

export const DEFAULT_SWARM_CONFIG: SwarmConfigType = {
  toChain: ChainId.DAI,
  swarmPostageStampAddress: GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  swarmToken: GNOSIS_BZZ_ADDRESS,
  swarmContractGasLimit: '2000000',
  swarmContractAbi: [
    'function createBatch(address _owner, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) external',
    'function createBatchRegistry(address _owner,  address _nodeAddress, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) external',
    'function topUpBatch(bytes32 _batchId, uint256 _topupAmountPerChunk) external',
  ],
  swarmBatchInitialBalance: '477774720',
  swarmBatchDepth: '20',
  swarmBatchBucketDepth: '16',
  swarmBatchImmutable: false,
  swarmBatchNonce:
    '0x' +
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map(b => b.toString(16).padStart(2, '0'))
      .join(''),
  swarmBatchTotal: '0',
};

export const GNOSIS_PRICE_ORACLE_ABI = [
  {
    name: 'currentPrice',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
] as const;

// Sushiswap V3 Pool ABI (minimal for price)
export const V3_POOL_ABI = [
  {
    inputs: [],
    name: 'slot0',
    outputs: [
      { internalType: 'uint160', name: 'sqrtPriceX96', type: 'uint160' },
      { internalType: 'int24', name: 'tick', type: 'int24' },
      { internalType: 'uint16', name: 'observationIndex', type: 'uint16' },
      {
        internalType: 'uint16',
        name: 'observationCardinality',
        type: 'uint16',
      },
      {
        internalType: 'uint16',
        name: 'observationCardinalityNext',
        type: 'uint16',
      },
      { internalType: 'uint8', name: 'feeProtocol', type: 'uint8' },
      { internalType: 'bool', name: 'unlocked', type: 'bool' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token0',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'token1',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'fee',
    outputs: [{ internalType: 'uint24', name: '', type: 'uint24' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Sushiswap V3 Pool address for BZZ/WXDAI on Gnosis
export const BZZ_USDC_POOL_ADDRESS =
  process.env.NEXT_PUBLIC_BZZ_USDC_POOL_ADDRESS || '0x6f30b7cf40cb423c1d23478a9855701ecf43931e';

/**
 * Note on naming convention: The terms "Batch" and "Stamps" are used interchangeably throughout the codebase.
 * "Batch" refers to a collection of stamps created in a single transaction and is the terminology used in the
 * Swarm protocol. "Stamps" is a more user-friendly term used to describe the same concept.
 * For example: "BatchCreated" event, but "StampsRegistry" contract.
 */
// Registry ABI for the functions we need to retrieve batch data
export const REGISTRY_ABI = [
  {
    inputs: [{ internalType: 'address', name: '_owner', type: 'address' }],
    name: 'getOwnerBatches',
    outputs: [
      {
        components: [
          { internalType: 'bytes32', name: 'batchId', type: 'bytes32' },
          { internalType: 'uint256', name: 'totalAmount', type: 'uint256' },
          { internalType: 'uint256', name: 'normalisedBalance', type: 'uint256' },
          { internalType: 'address', name: 'nodeAddress', type: 'address' },
          { internalType: 'address', name: 'payer', type: 'address' },
          { internalType: 'uint8', name: 'depth', type: 'uint8' },
          { internalType: 'uint8', name: 'bucketDepth', type: 'uint8' },
          { internalType: 'bool', name: 'immutable_', type: 'bool' },
          { internalType: 'uint256', name: 'timestamp', type: 'uint256' },
        ],
        internalType: 'struct StampsRegistry.BatchInfo[]',
        name: '',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;
