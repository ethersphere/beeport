// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/*
    ███████╗██╗   ██╗███████╗██╗  ██╗██╗███████╗██╗    ██╗ █████╗ ██████╗
    ██╔════╝██║   ██║██╔════╝██║  ██║██║██╔════╝██║    ██║██╔══██╗██╔══██╗
    ███████╗██║   ██║███████╗███████║██║███████╗██║ █╗ ██║███████║██████╔╝
    ╚════██║██║   ██║╚════██║██╔══██║██║╚════██║██║███╗██║██╔══██║██╔═══╝
    ███████║╚██████╔╝███████║██║  ██║██║███████║╚███╔███╔╝██║  ██║██║
    ╚══════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝ ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝

    ███████╗████████╗ █████╗ ███╗   ███╗██████╗ ███████╗
    ██╔════╝╚══██╔══╝██╔══██╗████╗ ████║██╔══██╗██╔════╝
    ███████╗   ██║   ███████║██╔████╔██║██████╔╝███████╗
    ╚════██║   ██║   ██╔══██║██║╚██╔╝██║██╔═══╝ ╚════██║
    ███████║   ██║   ██║  ██║██║ ╚═╝ ██║██║     ███████║
    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝

    ██████╗  ██████╗ ██╗   ██╗████████╗███████╗██████╗
    ██╔══██╗██╔═══██╗██║   ██║╚══██╔══╝██╔════╝██╔══██╗
    ██████╔╝██║   ██║██║   ██║   ██║   █████╗  ██████╔╝
    ██╔══██╗██║   ██║██║   ██║   ██║   ██╔══╝  ██╔══██╗
    ██║  ██║╚██████╔╝╚██████╔╝   ██║   ███████╗██║  ██║
    ╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   ╚══════╝╚═╝  ╚═╝
*/

/**
 * @title SushiSwapStampsRouter
 * @notice Swaps any Gnosis-chain token to BZZ via SushiSwap V3 and atomically
 *         creates or tops up a Swarm postage-stamp batch in a single transaction.
 *
 * @dev Implements the Uniswap V3 callback interface (SushiSwap V3 is fully compatible).
 *      Supports both single-hop and multi-hop exact-output swaps via path encoding.
 *
 *      Path encoding for exactOutput swaps (reversed token order):
 *        single-hop: BZZ ++ uint24(fee) ++ tokenIn              (43 bytes)
 *        two-hop:    BZZ ++ uint24(fee2) ++ mid ++ uint24(fee1) ++ tokenIn (66 bytes)
 *
 *      Quote functions are non-view (Quoter simulates swaps internally) but are
 *      designed to be called via eth_call for gas-free estimation.
 *
 *      Gnosis-chain addresses (hardcoded):
 *        BZZ    = 0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da
 *        WXDAI  = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d
 *        Quoter = 0xb1e835dc2785b52265711e17fccb0fd018226a6e (SushiSwap V3 QuoterV2)
 *        Factory= 0xf78031cbca409f2fb6876bdfdbc1b2df24cf9bef (SushiSwap V3 Factory)
 */

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface IERC20 {
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface IWXDAI {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

interface ISushiV3Pool {
    function swap(
        address recipient,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 sqrtPriceLimitX96,
        bytes calldata data
    ) external returns (int256 amount0, int256 amount1);

    function token0() external view returns (address);
    function token1() external view returns (address);
    function fee() external view returns (uint24);
}

interface ISushiV3Factory {
    function getPool(
        address tokenA,
        address tokenB,
        uint24 fee
    ) external view returns (address pool);
}

interface IQuoterV2 {
    struct QuoteExactOutputSingleParams {
        address tokenIn;
        address tokenOut;
        uint256 amount;
        uint24 fee;
        uint160 sqrtPriceLimitX96;
    }

    function quoteExactOutputSingle(QuoteExactOutputSingleParams memory params)
        external
        returns (
            uint256 amountIn,
            uint160 sqrtPriceX96After,
            uint32 initializedTicksCrossed,
            uint256 gasEstimate
        );

    function quoteExactOutput(bytes memory path, uint256 amountOut)
        external
        returns (
            uint256 amountIn,
            uint160[] memory sqrtPriceX96AfterList,
            uint32[] memory initializedTicksCrossedList,
            uint256 gasEstimate
        );
}

interface IStampsRegistry {
    function createBatchRegistry(
        address _owner,
        address _nodeAddress,
        uint256 _initialBalancePerChunk,
        uint8 _depth,
        uint8 _bucketDepth,
        bytes32 _nonce,
        bool _immutable
    ) external;

    function topUpBatch(bytes32 _batchId, uint256 _topupAmountPerChunk) external;
}

// ─── Router Contract ──────────────────────────────────────────────────────────

contract SushiSwapStampsRouter {

    // ─── Constants ────────────────────────────────────────────────────────────

    /// @notice BZZ token on Gnosis
    address public constant BZZ = 0xdBF3Ea6F5beE45c02255B2c26a16F300502F68da;

    /// @notice Wrapped xDAI on Gnosis
    address public constant WXDAI = 0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d;

    /// @notice SushiSwap V3 QuoterV2 on Gnosis
    address public constant SUSHI_QUOTER = 0xb1E835Dc2785b52265711e17fCCb0fd018226a6e;

    /// @notice SushiSwap V3 Factory on Gnosis
    address public constant SUSHI_FACTORY = 0xf78031CBCA409F2FB6876BDFDBc1b2df24cF9bEf;

    /// @notice Minimum sqrt price limit (used when selling token0 → token1, zeroForOne=true)
    uint160 internal constant MIN_SQRT_RATIO = 4295128739;

    /// @notice Maximum sqrt price limit (used when selling token1 → token0, zeroForOne=false)
    uint160 internal constant MAX_SQRT_RATIO = 1461446703485210103287273052203988822378723970342;

    // Path encoding offsets (bytes): address=20, fee=3, nextOffset=23, popOffset=43
    uint256 private constant ADDR_SIZE   = 20;
    uint256 private constant FEE_SIZE    = 3;
    uint256 private constant NEXT_OFFSET = 23; // ADDR_SIZE + FEE_SIZE
    uint256 private constant POP_OFFSET  = 43; // NEXT_OFFSET + ADDR_SIZE

    // ─── Immutables ───────────────────────────────────────────────────────────

    IStampsRegistry public immutable stampsRegistry;

    // ─── Events ───────────────────────────────────────────────────────────────

    event BatchCreatedViaSwap(
        bytes32 indexed batchId,
        address indexed owner,
        address tokenIn,
        uint256 amountIn,
        uint256 bzzAmount
    );

    event BatchToppedUpViaSwap(
        bytes32 indexed batchId,
        address tokenIn,
        uint256 amountIn,
        uint256 bzzAmount
    );

    // ─── Errors ───────────────────────────────────────────────────────────────

    error InvalidCallback();
    error SlippageExceeded(uint256 required, uint256 maximum);
    error InsufficientNativeValue();
    error NativeRefundFailed();
    error BzzTransferFailed();
    error BzzApproveFailed();
    error PoolNotFound();
    error InvalidPath();

    // ─── Structs ──────────────────────────────────────────────────────────────

    struct CreateBatchParams {
        address owner;
        address nodeAddress;
        uint256 initialBalancePerChunk;
        uint8   depth;
        uint8   bucketDepth;
        bytes32 nonce;
        bool    immutable_;
    }

    /// @dev Packed into the `data` argument of pool.swap(); threaded through callback chains.
    struct SwapCallbackData {
        bytes   path;        // remaining path in exactOutput encoding (BZZ-first)
        address payer;       // who pays the input token (address(this) for native swaps)
        uint256 maxAmountIn; // slippage ceiling for the final (tokenIn) leg
    }

    // ─── Constructor ──────────────────────────────────────────────────────────

    constructor(address _stampsRegistry) {
        stampsRegistry = IStampsRegistry(_stampsRegistry);
    }

    receive() external payable {}

    // ─── Quote Functions ──────────────────────────────────────────────────────
    // These modify state internally (Quoter simulates swaps) but are designed to
    // be called via eth_call for free gas-less estimation.

    /**
     * @notice Quote: how many `tokenIn` are needed to get exactly `bzzAmountOut` BZZ
     *         via a single-hop pool.
     * @param tokenIn  Input token (use WXDAI for native xDAI quotes)
     * @param fee      Pool fee tier (e.g. 500, 3000, 10000)
     * @param bzzAmountOut  Exact BZZ amount wanted
     * @return amountIn  Input tokens required (before slippage)
     */
    function quoteSingleHop(
        address tokenIn,
        uint24  fee,
        uint256 bzzAmountOut
    ) external returns (uint256 amountIn) {
        (amountIn,,,) = IQuoterV2(SUSHI_QUOTER).quoteExactOutputSingle(
            IQuoterV2.QuoteExactOutputSingleParams({
                tokenIn:           tokenIn,
                tokenOut:          BZZ,
                amount:            bzzAmountOut,
                fee:               fee,
                sqrtPriceLimitX96: 0
            })
        );
    }

    /**
     * @notice Quote: how many input tokens are needed to get exactly `bzzAmountOut` BZZ
     *         via a multi-hop path.
     * @param path  Exact-output encoded path: BZZ ++ fee ++ [mid ++ fee]* ++ tokenIn
     * @param bzzAmountOut  Exact BZZ amount wanted
     * @return amountIn  Input tokens required (before slippage)
     */
    function quoteMultiHop(
        bytes calldata path,
        uint256        bzzAmountOut
    ) external returns (uint256 amountIn) {
        (amountIn,,,) = IQuoterV2(SUSHI_QUOTER).quoteExactOutput(path, bzzAmountOut);
    }

    // ─── Create Batch ─────────────────────────────────────────────────────────

    /**
     * @notice Swap `tokenIn` → BZZ via the given path and create a Swarm stamp batch.
     * @dev    `tokenIn` must be pre-approved to this contract for at least `maxAmountIn`.
     * @param path         Exact-output path: BZZ ++ fee ++ [mid ++ fee]* ++ tokenIn
     * @param maxAmountIn  Maximum tokenIn to spend (slippage protection)
     * @param bzzAmountOut Exact BZZ needed  (= swarmBatchTotal = initialBalancePerChunk × 2^depth)
     * @param p            Batch creation parameters
     */
    function createBatch(
        bytes calldata         path,
        uint256                maxAmountIn,
        uint256                bzzAmountOut,
        CreateBatchParams calldata p
    ) external {
        _swapExactOutput(path, msg.sender, maxAmountIn, bzzAmountOut);
        bytes32 batchId = _approveBzzAndCreate(p, bzzAmountOut);
        address tokenIn = _lastToken(path);
        emit BatchCreatedViaSwap(batchId, p.owner, tokenIn, maxAmountIn, bzzAmountOut);
    }

    /**
     * @notice Swap native xDAI → BZZ and create a Swarm stamp batch.
     * @dev    Send msg.value ≥ maxAmountIn. Excess xDAI is refunded.
     * @param path         Exact-output path where the final token MUST be WXDAI:
     *                     BZZ ++ fee ++ [mid ++ fee]* ++ WXDAI
     * @param maxAmountIn  Maximum xDAI to spend
     * @param bzzAmountOut Exact BZZ needed
     * @param p            Batch creation parameters
     */
    function createBatchNative(
        bytes calldata         path,
        uint256                maxAmountIn,
        uint256                bzzAmountOut,
        CreateBatchParams calldata p
    ) external payable {
        if (msg.value < maxAmountIn) revert InsufficientNativeValue();
        IWXDAI(WXDAI).deposit{value: maxAmountIn}();
        _swapExactOutput(path, address(this), maxAmountIn, bzzAmountOut);
        bytes32 batchId = _approveBzzAndCreate(p, bzzAmountOut);
        emit BatchCreatedViaSwap(batchId, p.owner, address(0), maxAmountIn, bzzAmountOut);
        _refundNative();
    }

    // ─── Top Up Batch ─────────────────────────────────────────────────────────

    /**
     * @notice Swap `tokenIn` → BZZ and top up an existing Swarm stamp batch.
     * @dev    `tokenIn` must be pre-approved to this contract for at least `maxAmountIn`.
     * @param path               Exact-output path: BZZ ++ fee ++ [mid ++ fee]* ++ tokenIn
     * @param maxAmountIn        Maximum tokenIn to spend
     * @param bzzAmountOut       Exact BZZ needed (= topupAmountPerChunk × 2^depth)
     * @param batchId            Batch to top up
     * @param topupAmountPerChunk Per-chunk top-up amount (matches registry call)
     */
    function topUp(
        bytes calldata path,
        uint256        maxAmountIn,
        uint256        bzzAmountOut,
        bytes32        batchId,
        uint256        topupAmountPerChunk
    ) external {
        _swapExactOutput(path, msg.sender, maxAmountIn, bzzAmountOut);
        _approveBzzAndTopUp(batchId, topupAmountPerChunk, bzzAmountOut);
        address tokenIn = _lastToken(path);
        emit BatchToppedUpViaSwap(batchId, tokenIn, maxAmountIn, bzzAmountOut);
    }

    /**
     * @notice Swap native xDAI → BZZ and top up an existing Swarm stamp batch.
     * @dev    Send msg.value ≥ maxAmountIn. Excess xDAI is refunded.
     * @param path               BZZ ++ fee ++ [mid ++ fee]* ++ WXDAI
     * @param maxAmountIn        Maximum xDAI to spend
     * @param bzzAmountOut       Exact BZZ needed
     * @param batchId            Batch to top up
     * @param topupAmountPerChunk Per-chunk top-up amount
     */
    function topUpNative(
        bytes calldata path,
        uint256        maxAmountIn,
        uint256        bzzAmountOut,
        bytes32        batchId,
        uint256        topupAmountPerChunk
    ) external payable {
        if (msg.value < maxAmountIn) revert InsufficientNativeValue();
        IWXDAI(WXDAI).deposit{value: maxAmountIn}();
        _swapExactOutput(path, address(this), maxAmountIn, bzzAmountOut);
        _approveBzzAndTopUp(batchId, topupAmountPerChunk, bzzAmountOut);
        emit BatchToppedUpViaSwap(batchId, address(0), maxAmountIn, bzzAmountOut);
        _refundNative();
    }

    // ─── Uniswap V3 / SushiSwap V3 Swap Callback ─────────────────────────────

    /**
     * @notice Called by a SushiSwap V3 pool during swap execution.
     * @dev    Implements the Uniswap V3 callback interface (SushiSwap V3 is compatible).
     *         For multi-hop swaps, this callback chains into the next pool swap before
     *         paying the current pool, routing tokens directly between pools.
     */
    function uniswapV3SwapCallback(
        int256 amount0Delta,
        int256 amount1Delta,
        bytes calldata data
    ) external {
        require(amount0Delta > 0 || amount1Delta > 0, "Zero deltas");

        SwapCallbackData memory cb = abi.decode(data, (SwapCallbackData));

        // Decode the first pool in the path to verify the caller is legitimate.
        (address tokenOut, uint24 fee, address tokenIn) = _decodeFirstPool(cb.path);
        address expectedPool = ISushiV3Factory(SUSHI_FACTORY).getPool(tokenOut, tokenIn, fee);
        if (msg.sender != expectedPool) revert InvalidCallback();

        // Determine which token we owe to the calling pool and how much.
        // The positive delta is what the pool expects us to pay.
        (address tokenOwed, uint256 amountOwed) = amount0Delta > 0
            ? (ISushiV3Pool(msg.sender).token0(), uint256(amount0Delta))
            : (ISushiV3Pool(msg.sender).token1(), uint256(amount1Delta));

        if (_hasMultiplePools(cb.path)) {
            // Multi-hop: continue to next pool. Skip the first token from path to get
            // the remaining sub-path: mid ++ fee ++ ... ++ tokenIn
            bytes memory remainingPath = _skipToken(cb.path);

            // Decode the next pool info from remaining path.
            (address nextTokenOut, uint24 nextFee, address nextTokenIn) = _decodeFirstPool(remainingPath);
            address nextPool = ISushiV3Factory(SUSHI_FACTORY).getPool(nextTokenOut, nextTokenIn, nextFee);
            if (nextPool == address(0)) revert PoolNotFound();

            // Swap in the next pool, sending output directly to msg.sender (current pool)
            // so it receives the tokens it needs without going through this contract.
            bool zeroForOne = nextTokenIn < nextTokenOut;
            ISushiV3Pool(nextPool).swap(
                msg.sender,              // recipient = current pool (gets tokenOwed directly)
                zeroForOne,
                -int256(amountOwed),     // exact output = amountOwed
                zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
                abi.encode(SwapCallbackData({
                    path:        remainingPath,
                    payer:       cb.payer,
                    maxAmountIn: cb.maxAmountIn
                }))
            );
        } else {
            // Final hop: pay tokenOwed from the original payer.
            if (amountOwed > cb.maxAmountIn) {
                revert SlippageExceeded(amountOwed, cb.maxAmountIn);
            }

            if (cb.payer == address(this)) {
                // Native xDAI flow: we already hold WXDAI from the deposit.
                if (!IERC20(tokenOwed).transfer(msg.sender, amountOwed)) {
                    revert BzzTransferFailed();
                }
            } else {
                // ERC20 flow: pull from user who pre-approved this contract.
                if (!IERC20(tokenOwed).transferFrom(cb.payer, msg.sender, amountOwed)) {
                    revert BzzTransferFailed();
                }
            }
        }
    }

    // ─── Internal Helpers ─────────────────────────────────────────────────────

    /**
     * @dev Execute an exact-output swap for `bzzAmountOut` BZZ using the given path.
     *      The path is in exactOutput encoding: BZZ ++ fee ++ [...] ++ tokenIn.
     *      BZZ lands in address(this) after the swap completes.
     */
    function _swapExactOutput(
        bytes memory path,
        address      payer,
        uint256      maxAmountIn,
        uint256      bzzAmountOut
    ) internal {
        if (path.length < POP_OFFSET) revert InvalidPath();

        // Decode the first (and for single-hop, only) pool in the path.
        (address tokenOut, uint24 fee, address tokenIn) = _decodeFirstPool(path);
        if (tokenOut != BZZ) revert InvalidPath();

        address pool = ISushiV3Factory(SUSHI_FACTORY).getPool(tokenOut, tokenIn, fee);
        if (pool == address(0)) revert PoolNotFound();

        // zeroForOne: true if tokenIn is token0 (address < BZZ)
        bool zeroForOne = tokenIn < tokenOut;

        // amountSpecified < 0 → exact output (we want exactly bzzAmountOut of BZZ)
        ISushiV3Pool(pool).swap(
            address(this),   // receive BZZ here
            zeroForOne,
            -int256(bzzAmountOut),
            zeroForOne ? MIN_SQRT_RATIO + 1 : MAX_SQRT_RATIO - 1,
            abi.encode(SwapCallbackData({
                path:        path,
                payer:       payer,
                maxAmountIn: maxAmountIn
            }))
        );
    }

    /**
     * @dev Approve BZZ to the stamps registry and call createBatchRegistry.
     *      Returns the keccak256 batch ID consistent with the registry's derivation.
     */
    function _approveBzzAndCreate(
        CreateBatchParams memory p,
        uint256 bzzAmountOut
    ) internal returns (bytes32 batchId) {
        if (!IERC20(BZZ).approve(address(stampsRegistry), bzzAmountOut)) {
            revert BzzApproveFailed();
        }

        stampsRegistry.createBatchRegistry(
            p.owner,
            p.nodeAddress,
            p.initialBalancePerChunk,
            p.depth,
            p.bucketDepth,
            p.nonce,
            p.immutable_
        );

        // Registry derives batchId as keccak256(abi.encode(registry, nonce)).
        batchId = keccak256(abi.encode(address(stampsRegistry), p.nonce));
    }

    /**
     * @dev Approve BZZ to the stamps registry and call topUpBatch.
     */
    function _approveBzzAndTopUp(
        bytes32 batchId,
        uint256 topupAmountPerChunk,
        uint256 bzzAmountOut
    ) internal {
        if (!IERC20(BZZ).approve(address(stampsRegistry), bzzAmountOut)) {
            revert BzzApproveFailed();
        }
        stampsRegistry.topUpBatch(batchId, topupAmountPerChunk);
    }

    /**
     * @dev Unwrap any remaining WXDAI and refund all native xDAI to msg.sender.
     */
    function _refundNative() internal {
        uint256 wxdaiBalance = IERC20(WXDAI).balanceOf(address(this));
        if (wxdaiBalance > 0) {
            IWXDAI(WXDAI).withdraw(wxdaiBalance);
        }
        uint256 nativeBalance = address(this).balance;
        if (nativeBalance > 0) {
            (bool ok,) = msg.sender.call{value: nativeBalance}("");
            if (!ok) revert NativeRefundFailed();
        }
    }

    // ─── Path Utilities ───────────────────────────────────────────────────────

    /**
     * @dev Returns true if the path encodes more than one pool (length > 43 bytes).
     */
    function _hasMultiplePools(bytes memory path) internal pure returns (bool) {
        return path.length > POP_OFFSET;
    }

    /**
     * @dev Decodes the first pool segment from the path:
     *      tokenA (20 bytes) ++ fee (3 bytes) ++ tokenB (20 bytes)
     */
    function _decodeFirstPool(bytes memory path)
        internal
        pure
        returns (address tokenA, uint24 fee, address tokenB)
    {
        tokenA = _toAddress(path, 0);
        fee    = _toUint24(path, ADDR_SIZE);
        tokenB = _toAddress(path, NEXT_OFFSET);
    }

    /**
     * @dev Returns the path with the first token removed (skips ADDR_SIZE + FEE_SIZE bytes).
     *      Used to advance through multi-hop paths in the callback.
     */
    function _skipToken(bytes memory path) internal pure returns (bytes memory skipped) {
        uint256 newLen = path.length - NEXT_OFFSET;
        skipped = new bytes(newLen);
        // Copy from offset NEXT_OFFSET onward
        for (uint256 i = 0; i < newLen; i++) {
            skipped[i] = path[i + NEXT_OFFSET];
        }
    }

    /**
     * @dev Extracts the last 20-byte address from the path (the tokenIn address).
     */
    function _lastToken(bytes memory path) internal pure returns (address token) {
        uint256 offset = path.length - ADDR_SIZE;
        token = _toAddress(path, offset);
    }

    /**
     * @dev Reads a 20-byte address from `data` at `offset` using assembly.
     *      The address occupies bytes [offset, offset+20) and is right-aligned
     *      by shifting the 32-byte word 96 bits right.
     */
    function _toAddress(bytes memory data, uint256 offset) internal pure returns (address addr) {
        assembly {
            addr := shr(96, mload(add(add(data, 0x20), offset)))
        }
    }

    /**
     * @dev Reads a 3-byte uint24 from `data` at `offset` using assembly.
     *      Shifts the 32-byte word 232 bits right to extract the top 3 bytes.
     */
    function _toUint24(bytes memory data, uint256 offset) internal pure returns (uint24 result) {
        assembly {
            result := shr(232, mload(add(add(data, 0x20), offset)))
        }
    }
}
