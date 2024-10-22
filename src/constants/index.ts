export const SEPOLIA_SWARM_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_SWARM_CONTRACT_ADDRESS!; //// SEPOLIA TESTNET
export const SEPOLIA_ERC20_ADDRESS = process.env.NEXT_PUBLIC_ERC20_ADDRESS!; //// SEPOLIA TESTNET

if (!SEPOLIA_SWARM_CONTRACT_ADDRESS || !SEPOLIA_ERC20_ADDRESS) {
  throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
}

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
