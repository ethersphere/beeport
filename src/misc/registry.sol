// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/*
    ╔═╗┌┬┐┌─┐┌┬┐┌─┐  ╦═╗┌─┐┌─┐┬┌─┐┌┬┐┬─┐┬ ┬
    ╚═╗ │ ├─┤│││├─┘  ╠╦╝├┤ │ ┬│└─┐ │ ├┬┘└┬┘
    ╚═╝ ┴ ┴ ┴┴ ┴┴    ╩╚═└─┘└─┘┴└─┘ ┴ ┴└─ ┴ 
*/

interface ISwarmContract {
    function createBatch(
        address _owner,
        uint256 _initialBalancePerChunk,
        uint8 _depth,
        uint8 _bucketDepth,
        bytes32 _nonce,
        bool _immutable
    ) external;

    function currentTotalOutPayment() external view returns (uint256);
}

contract StampRegistry {
    // State variables
    ISwarmContract public swarmContract;
    mapping(uint256 => address) public batchPayers;
    address public admin;

    // Events
    event BatchCreated(
        uint256 indexed batchId,
        uint256 totalAmount,
        uint256 normalisedBalance,
        address indexed owner,
        address indexed payer,
        uint8 depth,
        uint8 bucketDepth,
        bool immutable_
    );
    event SwarmContractUpdated(address oldAddress, address newAddress);

    // Modifiers
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this function");
        _;
    }

    constructor(address _swarmContractAddress) {
        swarmContract = ISwarmContract(_swarmContractAddress);
        admin = msg.sender;
    }

    /**
     * @notice Updates the swarm contract address
     * @param _newSwarmContractAddress New address of the swarm contract
     */
    function updateSwarmContract(
        address _newSwarmContractAddress
    ) external onlyAdmin {
        address oldAddress = address(swarmContract);
        swarmContract = ISwarmContract(_newSwarmContractAddress);
        emit SwarmContractUpdated(oldAddress, _newSwarmContractAddress);
    }

    /**
     * @notice Creates a new batch and registers the payer
     * @param _payer Address that pays for the batch
     * @param _initialBalancePerChunk Initial balance per chunk
     * @param _depth Depth of the batch
     * @param _bucketDepth Bucket depth
     * @param _nonce Unique nonce for the batch
     * @param _immutable Whether the batch is immutable
     */
    function registryCreateBatch(
        address _payer,
        uint256 _initialBalancePerChunk,
        uint8 _depth,
        uint8 _bucketDepth,
        bytes32 _nonce,
        bool _immutable
    ) external {
        // Call the original swarm contract with this contract as owner
        swarmContract.createBatch(
            address(this),
            _initialBalancePerChunk,
            _depth,
            _bucketDepth,
            _nonce,
            _immutable
        );

        // Calculate batchId using the same logic as in the original contract
        uint256 batchId = uint256(keccak256(abi.encode(address(this), _nonce)));

        // Store the payer information
        batchPayers[batchId] = _payer;

        // Calculate total amount and normalized balance
        uint256 totalAmount = _initialBalancePerChunk * (1 << _depth);
        uint256 normalisedBalance = swarmContract.currentTotalOutPayment() +
            _initialBalancePerChunk;

        // Emit the batch creation event
        emit BatchCreated(
            batchId,
            totalAmount,
            normalisedBalance,
            address(this),
            _payer,
            _depth,
            _bucketDepth,
            _immutable
        );
    }

    /**
     * @notice Get the payer address for a specific batch ID
     * @param _batchId The ID of the batch
     * @return The address of the payer
     */
    function getBatchPayer(uint256 _batchId) external view returns (address) {
        return batchPayers[_batchId];
    }
}
