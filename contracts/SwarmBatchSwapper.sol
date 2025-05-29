// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface ISushiSwapV2Router {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);
    
    function getAmountsOut(uint amountIn, address[] calldata path)
        external view returns (uint[] memory amounts);
}

interface IBatchRegistry {
    function createBatchRegistry(
        address owner,
        address nodeAddress,
        uint256 initialPaymentPerChunk,
        uint8 depth,
        uint8 bucketDepth,
        bytes32 nonce,
        bool immutableFlag
    ) external;
    
    function topUpBatch(bytes32 batchId, uint256 topupAmountPerChunk) external;
}

contract SwarmBatchSwapper is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    
    // Default addresses on Gnosis Chain
    ISushiSwapV2Router public sushiRouter;
    IBatchRegistry public batchRegistry;
    address public bzzToken;
    address public defaultInputToken; // USDC by default
    address public defaultPool;
    
    // Events
    event SwapAndCreateBatch(
        address indexed user,
        address inputToken,
        uint256 inputAmount,
        uint256 bzzReceived,
        uint256 bzzUsed,
        uint256 bzzReturned,
        bytes32 indexed batchId
    );
    
    event SwapAndTopUpBatch(
        address indexed user,
        address inputToken,
        uint256 inputAmount,
        uint256 bzzReceived,
        uint256 bzzUsed,
        uint256 bzzReturned,
        bytes32 indexed batchId
    );
    
    event ConfigUpdated(
        address sushiRouter,
        address batchRegistry,
        address bzzToken,
        address defaultInputToken,
        address defaultPool
    );
    
    constructor(
        address _sushiRouter,
        address _batchRegistry,
        address _bzzToken,
        address _defaultInputToken,
        address _defaultPool
    ) Ownable(msg.sender) {
        sushiRouter = ISushiSwapV2Router(_sushiRouter);
        batchRegistry = IBatchRegistry(_batchRegistry);
        bzzToken = _bzzToken;
        defaultInputToken = _defaultInputToken;
        defaultPool = _defaultPool;
    }
    
    /**
     * @dev Swap input token to BZZ and create new batch
     */
    function swapAndCreateBatch(
        address inputToken,
        uint256 inputAmount,
        uint256 exactBzzNeeded,
        uint256 minBzzReceived,
        address owner,
        address nodeAddress,
        uint256 initialPaymentPerChunk,
        uint8 depth,
        uint8 bucketDepth,
        bytes32 nonce,
        bool immutableFlag
    ) external nonReentrant {
        require(inputAmount > 0, "Input amount must be greater than 0");
        require(exactBzzNeeded > 0, "BZZ needed must be greater than 0");
        
        // Transfer input tokens from user
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);
        
        // Perform swap
        uint256 bzzReceived = _performSwap(inputToken, inputAmount, minBzzReceived);
        require(bzzReceived >= exactBzzNeeded, "Insufficient BZZ received from swap");
        
        // Approve BZZ for batch registry
        IERC20(bzzToken).forceApprove(address(batchRegistry), exactBzzNeeded);
        
        // Create batch
        batchRegistry.createBatchRegistry(
            owner,
            nodeAddress,
            initialPaymentPerChunk,
            depth,
            bucketDepth,
            nonce,
            immutableFlag
        );
        
        // Return excess BZZ to user
        uint256 excessBzz = bzzReceived - exactBzzNeeded;
        if (excessBzz > 0) {
            IERC20(bzzToken).safeTransfer(msg.sender, excessBzz);
        }
        
        // Calculate batch ID (same logic as frontend)
        bytes32 batchId = keccak256(abi.encodePacked(nonce, address(batchRegistry)));
        
        emit SwapAndCreateBatch(
            msg.sender,
            inputToken,
            inputAmount,
            bzzReceived,
            exactBzzNeeded,
            excessBzz,
            batchId
        );
    }
    
    /**
     * @dev Swap input token to BZZ and top up existing batch
     */
    function swapAndTopUpBatch(
        address inputToken,
        uint256 inputAmount,
        uint256 exactBzzNeeded,
        uint256 minBzzReceived,
        bytes32 batchId,
        uint256 topupAmountPerChunk
    ) external nonReentrant {
        require(inputAmount > 0, "Input amount must be greater than 0");
        require(exactBzzNeeded > 0, "BZZ needed must be greater than 0");
        require(batchId != bytes32(0), "Invalid batch ID");
        
        // Transfer input tokens from user
        IERC20(inputToken).safeTransferFrom(msg.sender, address(this), inputAmount);
        
        // Perform swap
        uint256 bzzReceived = _performSwap(inputToken, inputAmount, minBzzReceived);
        require(bzzReceived >= exactBzzNeeded, "Insufficient BZZ received from swap");
        
        // Approve BZZ for batch registry
        IERC20(bzzToken).forceApprove(address(batchRegistry), exactBzzNeeded);
        
        // Top up batch
        batchRegistry.topUpBatch(batchId, topupAmountPerChunk);
        
        // Return excess BZZ to user
        uint256 excessBzz = bzzReceived - exactBzzNeeded;
        if (excessBzz > 0) {
            IERC20(bzzToken).safeTransfer(msg.sender, excessBzz);
        }
        
        emit SwapAndTopUpBatch(
            msg.sender,
            inputToken,
            inputAmount,
            bzzReceived,
            exactBzzNeeded,
            excessBzz,
            batchId
        );
    }
    
    /**
     * @dev Get expected BZZ output for input amount
     */
    function getExpectedBzzOutput(address inputToken, uint256 inputAmount) 
        external view returns (uint256 expectedBzz) {
        if (inputToken == bzzToken) {
            return inputAmount;
        }
        
        address[] memory path = _getSwapPath(inputToken);
        uint[] memory amounts = sushiRouter.getAmountsOut(inputAmount, path);
        return amounts[amounts.length - 1];
    }
    
    /**
     * @dev Internal function to perform token swap
     */
    function _performSwap(
        address inputToken, 
        uint256 inputAmount, 
        uint256 minBzzReceived
    ) internal returns (uint256 bzzReceived) {
        // If input token is already BZZ, no swap needed
        if (inputToken == bzzToken) {
            return inputAmount;
        }
        
        address[] memory path = _getSwapPath(inputToken);
        
        // Approve SushiSwap router
        IERC20(inputToken).forceApprove(address(sushiRouter), inputAmount);
        
        // Perform swap
        uint[] memory amounts = sushiRouter.swapExactTokensForTokens(
            inputAmount,
            minBzzReceived,
            path,
            address(this),
            block.timestamp + 300 // 5 minute deadline
        );
        
        return amounts[amounts.length - 1];
    }
    
    /**
     * @dev Get swap path for token to BZZ
     */
    function _getSwapPath(address inputToken) internal view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = inputToken;
        path[1] = bzzToken;
        return path;
    }
    
    /**
     * @dev Update contract configuration (owner only)
     */
    function updateConfig(
        address _sushiRouter,
        address _batchRegistry,
        address _bzzToken,
        address _defaultInputToken,
        address _defaultPool
    ) external onlyOwner {
        sushiRouter = ISushiSwapV2Router(_sushiRouter);
        batchRegistry = IBatchRegistry(_batchRegistry);
        bzzToken = _bzzToken;
        defaultInputToken = _defaultInputToken;
        defaultPool = _defaultPool;
        
        emit ConfigUpdated(_sushiRouter, _batchRegistry, _bzzToken, _defaultInputToken, _defaultPool);
    }
    
    /**
     * @dev Emergency function to recover stuck tokens (owner only)
     */
    function emergencyRecover(address token, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(owner(), amount);
    }
} 