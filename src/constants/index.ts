export const SEPOLIA_SWARM_CONTRACT_ADDRESS =
  "0x46c46f96Fa488cb491353804528C8591E2E2D9eA"; //// SEPOLIA TESTNET
export const SEPOLIA_ERC20_ADDRESS =
  "0x3997c1ee3895e51B98637935549d35E034Ea0e98"; //// SEPOLIA TESTNET

export const contractABI = [
  "function createBatch(address _owner, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) external returns (bytes32)",
  "event BatchCreated(uint256 indexed batchId, uint256 totalAmount, uint256 normalisedBalance, address indexed _owner, uint8 _depth, uint8 _bucketDepth, bool _immutable)",
  "function getBatchesForOwner(address _owner) external view returns (bytes32[] memory)",
]; /// Bzz postage stamp contract ABI

export const ERC20ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function transfer(address to, uint256 amount) external returns (bool)",
  "function balanceOf(address account) external view returns (uint256)",
  "function allowance(address owner, address spender) external view returns (uint256)",
];
