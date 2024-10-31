export const swarmContractAbi = [
  "function createBatch(address _owner, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) external returns (bytes32)",
  "function getBatchesForOwner(address _owner) external view returns (bytes32[] memory)",
  "event BatchCreated(åuint256 indexed batchId, uint256 totalAmount, uint256 normalisedBalance, address indexed _owner, uint8 _depth, uint8 _bucketDepth, bool _immutable)",
]; /// Bzz postage stamp contract ABI
