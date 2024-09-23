export const SEPOLIA_SWARM_CONTRACT_ADDRESS =
  "0xB67c9429e0A54d450BAAA06c944A54da93cd61fa"; //// SEPOLIA TESTNET
export const SEPOLIA_ERC20_ADDRESS =
  "0x3997c1ee3895e51B98637935549d35E034Ea0e98"; //// SEPOLIA TESTNET
export const contractABI = [
  "function createBatch(address _owner, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) external returns (bytes32)",
  "event BatchCreated(uint256 indexed batchId, uint256 totalAmount, uint256 normalisedBalance, address indexed _owner, uint8 _depth, uint8 _bucketDepth, bool _immutable)",
];

export const ERC20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
];
