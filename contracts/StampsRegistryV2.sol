// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/*
    ███████╗████████╗ █████╗ ███╗   ███╗██████╗ ███████╗
    ██╔════╝╚══██╔══╝██╔══██╗████╗ ████║██╔══██╗██╔════╝
    ███████╗   ██║   ███████║██╔████╔██║██████╔╝███████╗
    ╚════██║   ██║   ██╔══██║██║╚██╔╝██║██╔═══╝ ╚════██║
    ███████║   ██║   ██║  ██║██║ ╚═╝ ██║██║     ███████║
    ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝     ╚═╝╚═╝     ╚══════╝

    ██████╗ ███████╗ ██████╗ ██╗███████╗████████╗██████╗ ██╗   ██╗    ██╗   ██╗██████╗
    ██╔══██╗██╔════╝██╔════╝ ██║██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝    ██║   ██║╚════██╗
    ██████╔╝█████╗  ██║  ███╗██║███████╗   ██║   ██████╔╝ ╚████╔╝     ██║   ██║ █████╔╝
    ██╔══██╗██╔══╝  ██║   ██║██║╚════██║   ██║   ██╔══██╗  ╚██╔╝      ╚██╗ ██╔╝██╔═══╝
    ██║  ██║███████╗╚██████╔╝██║███████║   ██║   ██║  ██║   ██║        ╚████╔╝ ███████╗
    ╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝         ╚═══╝  ╚══════╝
*/

/**
 * @title  StampsRegistryV2
 * @notice Thin, self-custody-aware proxy over the upstream Swarm Postage Stamp
 *         contract.
 *
 * @dev Why this exists
 * ------------------------------------------------------------------------------
 * The upstream Postage Stamp contract derives `batchId` as
 *     batchId = keccak256(abi.encode(msg.sender, nonce))
 *
 * which means whoever calls `createBatch` is baked into the batch ID. Two
 * concrete UX consequences this contract exists to fix:
 *
 *  1. A user wallet calling `createBatch` directly produces an unpredictable
 *     batch ID *from the perspective of any aggregator that wants to bundle
 *     the call into a multicaller transaction* (e.g. Relay's `txs` post-action
 *     after a cross-chain swap). The aggregator's executor — not the user —
 *     ends up as `msg.sender`, so the batch ID we compute client-side from
 *     `(walletAddress, nonce)` no longer matches the on-chain ID, breaking
 *     top-up and lookup flows.
 *
 *  2. The user's wallet has to sign two more transactions on Gnosis after the
 *     bridge completes (`approve` BZZ + `createBatch`). With this contract the
 *     entire "bridge → buy stamp" path can be expressed as a single Relay
 *     `txs` action, restoring the one-signature UX of the legacy custodial
 *     flow without giving up self-custody of the on-chain `_owner` key.
 *
 * Because all interactions with Postage Stamp go through this contract,
 * `msg.sender` to Postage Stamp is always `address(this)`, so:
 *
 *     batchId = keccak256(abi.encode(address(this), nonce))
 *
 * is computable client-side before any tx is broadcast — both for direct EOA
 * callers and for aggregator-multicaller callers.
 *
 * @dev What this contract does NOT do
 * ------------------------------------------------------------------------------
 *  - It does NOT mirror per-batch state (depth, bucketDepth, normalisedBalance,
 *    immutable flag, owner, ttl). All of that is queryable live from the
 *    upstream Postage Stamp contract via {ISwarmContract}'s view methods.
 *    The previous {StampsRegistry} duplicated this state and paid SSTORE costs
 *    on every mutation; this version doesn't.
 *  - It does NOT have an admin, an upgrade path, or any way to point at a
 *    different Postage Stamp / BZZ address after deployment. The two upstream
 *    addresses are `immutable`. If the upstream Postage Stamp contract is ever
 *    redeployed, deploy a fresh `StampsRegistryV2` against it.
 *
 * @dev Self-custody integration (SWIP — Client-side postage stamping, mode α)
 * ------------------------------------------------------------------------------
 * The on-chain `_owner` of every batch created here is `hotKeyOwner`, an
 * address derived locally by the user's browser tab (per the SWIP). The
 * registry never sees the hot key's private material, never signs stamps, and
 * cannot mint stamps for the batch. It only forwards the on-chain createBatch
 * call so that `_owner` lands as the hot key on Postage Stamp.
 *
 * The `wallet` parameter on `createSelfCustodyBatch` is the address the UI
 * uses to enumerate batches under "Your Stamps". It is intentionally separate
 * from `msg.sender` (which may be an aggregator multicaller) and from
 * `hotKeyOwner` (which is a session/derivation key).
 *
 * @dev Naming
 * ------------------------------------------------------------------------------
 * "Batch" and "Stamps" are used interchangeably; "Batch" is the Swarm protocol
 * term, "Stamps" is the user-friendly synonym (`StampsRegistryV2` —
 * `BatchCreated` event).
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

    function topUp(bytes32 _batchId, uint256 _topupAmountPerChunk) external;

    function increaseDepth(bytes32 _batchId, uint8 _newDepth) external;

    function batchOwner(bytes32 _batchId) external view returns (address);

    function batchDepth(bytes32 _batchId) external view returns (uint8);

    function batchBucketDepth(bytes32 _batchId) external view returns (uint8);

    function batchImmutableFlag(bytes32 _batchId) external view returns (bool);

    function batchNormalisedBalance(bytes32 _batchId) external view returns (uint256);
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    function approve(address spender, uint256 amount) external returns (bool);
}

contract StampsRegistryV2 {
    // ─── Constants / immutables ────────────────────────────────────────────────

    /// @notice Upstream Swarm Postage Stamp contract on Gnosis Chain.
    ISwarmContract public immutable POSTAGE_STAMP;

    /// @notice BZZ token used to pay for stamps. Set at construction; cannot
    ///         change for the lifetime of this registry.
    IERC20 public immutable BZZ;

    // ─── Storage (intentionally minimal) ───────────────────────────────────────

    /**
     * @dev Per-batch attribution: which user wallet "owns" the batch in the
     *      UI sense, and which hot key was set as on-chain owner. We only
     *      record what the upstream Postage Stamp contract does NOT make easy
     *      to discover — everything else is read live via {ISwarmContract}.
     *
     *      `createdAt` is packed into 96 bits so the struct fits a single
     *      storage slot together with two addresses (160 + 160 + 96 = 416 bits
     *      → 2 slots is unavoidable; the pack is a nicety, not a saving).
     */
    struct Attribution {
        address wallet;
        address hotKeyOwner;
        uint96 createdAt;
    }

    /// @dev wallet → batch IDs the wallet is recorded as having paid for.
    mapping(address => bytes32[]) private _walletBatches;

    /// @notice batchId → attribution metadata. Empty for batches not created
    ///         through this registry (e.g. created directly on Postage Stamp
    ///         by an earlier client version).
    mapping(bytes32 => Attribution) public batchAttribution;

    // ─── Events ────────────────────────────────────────────────────────────────

    /**
     * @notice Emitted when a self-custody batch is created via this registry.
     *
     * @param batchId       keccak256(abi.encode(address(this), nonce))
     * @param wallet        Logical "user" address; how the UI lists this batch.
     * @param hotKeyOwner   On-chain `_owner` set on the Postage Stamp contract.
     * @param totalAmount   Total BZZ paid (initialBalancePerChunk * 2**depth).
     * @param depth         Stamp depth (passed through to Postage Stamp).
     * @param bucketDepth   Stamp bucket depth (passed through).
     * @param immutable_    Whether the batch is immutable (passed through).
     * @param nonce         The nonce used to derive `batchId`.
     */
    event BatchCreated(
        bytes32 indexed batchId,
        address indexed wallet,
        address indexed hotKeyOwner,
        uint256 totalAmount,
        uint8 depth,
        uint8 bucketDepth,
        bool immutable_,
        bytes32 nonce
    );

    /**
     * @notice Emitted when a batch is topped up via this registry. Permissionless:
     *         anyone can top up any batch known to this registry.
     */
    event BatchToppedUp(
        bytes32 indexed batchId,
        address indexed wallet,
        address indexed payer,
        uint256 totalAmount,
        uint256 perChunkAmount
    );

    // ─── Errors ────────────────────────────────────────────────────────────────

    error TransferFailed();
    error ApprovalFailed();
    error UnknownBatch();
    error InvalidWallet();
    error InvalidHotKey();
    error ZeroAmount();

    // ─── Constructor ───────────────────────────────────────────────────────────

    /**
     * @param postageStamp Upstream Swarm Postage Stamp contract address.
     * @param bzz          BZZ token contract address.
     */
    constructor(address postageStamp, address bzz) {
        require(postageStamp != address(0), "postageStamp = 0");
        require(bzz != address(0), "bzz = 0");
        POSTAGE_STAMP = ISwarmContract(postageStamp);
        BZZ = IERC20(bzz);
    }

    ////////////////////////////////////////
    //              ACTIONS               //
    ////////////////////////////////////////

    /**
     * @notice Create a self-custody postage batch.
     *
     *         BZZ flow:  msg.sender → this contract → Postage Stamp.
     *         The caller MUST have approved this contract for at least
     *         `initialBalancePerChunk * 2**depth` BZZ before calling.
     *
     *         The on-chain `_owner` set on Postage Stamp is `hotKeyOwner`,
     *         NOT `msg.sender`. Only the holder of `hotKeyOwner`'s private
     *         key can sign valid postage stamps for this batch.
     *
     * @dev Trust model
     *      - `msg.sender` is whoever pays the BZZ (a user EOA, or an
     *        aggregator's multicaller after a cross-chain swap fills BZZ to it).
     *      - `wallet` is whatever address the UI wants this batch listed under.
     *        It is unauthenticated by design — anyone can call this with any
     *        `wallet` value. The worst a third party can do by spamming
     *        someone else's `wallet` is gift them a batch they don't actually
     *        own (the on-chain owner is still the spammer's `hotKeyOwner`).
     *        UIs SHOULD show enumeration entries that don't match a known
     *        local hot key as "external" or hide them.
     *      - `hotKeyOwner` is the actual non-custodial owner. This contract
     *        never receives or stores its private key.
     *
     * @param wallet                The UI-side "user" address. May equal `msg.sender`
     *                              in direct calls, or differ in aggregator flows.
     * @param hotKeyOwner           On-chain `_owner` for the new batch.
     * @param initialBalancePerChunk Per-chunk balance (PLUR).
     * @param depth                 Batch depth.
     * @param bucketDepth           Bucket depth (typically 16 for Bee).
     * @param nonce                 Salt used to derive `batchId` (must be unique
     *                              per registry; collision = revert from upstream).
     * @param immutable_            Whether the batch is immutable.
     * @return batchId              keccak256(abi.encode(address(this), nonce)).
     */
    function createSelfCustodyBatch(
        address wallet,
        address hotKeyOwner,
        uint256 initialBalancePerChunk,
        uint8 depth,
        uint8 bucketDepth,
        bytes32 nonce,
        bool immutable_
    ) external returns (bytes32 batchId) {
        if (wallet == address(0)) revert InvalidWallet();
        if (hotKeyOwner == address(0)) revert InvalidHotKey();
        if (initialBalancePerChunk == 0) revert ZeroAmount();

        uint256 totalAmount = initialBalancePerChunk * (uint256(1) << depth);

        // Pull BZZ from caller (user EOA or aggregator multicaller).
        if (!BZZ.transferFrom(msg.sender, address(this), totalAmount)) revert TransferFailed();

        // Approve upstream Postage Stamp to spend exactly this batch's BZZ.
        // BZZ is a standard ERC20 (no USDT-style "approve from non-zero" quirk),
        // so a single approve is safe — leftover allowance after this call is 0
        // because Postage Stamp pulls exactly `totalAmount` inside `createBatch`.
        if (!BZZ.approve(address(POSTAGE_STAMP), totalAmount)) revert ApprovalFailed();

        POSTAGE_STAMP.createBatch(
            hotKeyOwner,
            initialBalancePerChunk,
            depth,
            bucketDepth,
            nonce,
            immutable_
        );

        batchId = keccak256(abi.encode(address(this), nonce));

        _walletBatches[wallet].push(batchId);
        batchAttribution[batchId] = Attribution({
            wallet: wallet,
            hotKeyOwner: hotKeyOwner,
            createdAt: uint96(block.timestamp)
        });

        emit BatchCreated(
            batchId,
            wallet,
            hotKeyOwner,
            totalAmount,
            depth,
            bucketDepth,
            immutable_,
            nonce
        );
    }

    /**
     * @notice Top up an existing batch known to this registry. Permissionless:
     *         anyone may top up on the original wallet's behalf.
     *
     * @dev Depth is read live from upstream Postage Stamp rather than a
     *      mirrored field, so this works correctly across `increaseDepth`
     *      operations performed in-between.
     *
     * @param batchId          Batch to top up. Must have been created via this
     *                         registry (i.e. have an attribution entry).
     * @param perChunkAmount   Per-chunk top-up amount (PLUR).
     */
    function topUpBatch(bytes32 batchId, uint256 perChunkAmount) external {
        Attribution memory a = batchAttribution[batchId];
        if (a.wallet == address(0)) revert UnknownBatch();
        if (perChunkAmount == 0) revert ZeroAmount();

        uint8 depth = POSTAGE_STAMP.batchDepth(batchId);
        uint256 totalAmount = perChunkAmount * (uint256(1) << depth);

        if (!BZZ.transferFrom(msg.sender, address(this), totalAmount)) revert TransferFailed();
        if (!BZZ.approve(address(POSTAGE_STAMP), totalAmount)) revert ApprovalFailed();

        POSTAGE_STAMP.topUp(batchId, perChunkAmount);

        emit BatchToppedUp(batchId, a.wallet, msg.sender, totalAmount, perChunkAmount);
    }

    ////////////////////////////////////////
    //              GETTERS               //
    ////////////////////////////////////////

    /**
     * @notice All batch IDs recorded under `wallet`. Newest entries are at the
     *         end of the array (push order). Use {getWalletBatchCount} for
     *         pagination.
     */
    function getWalletBatchIds(address wallet) external view returns (bytes32[] memory) {
        return _walletBatches[wallet];
    }

    /// @notice Number of batches recorded under `wallet`.
    function getWalletBatchCount(address wallet) external view returns (uint256) {
        return _walletBatches[wallet].length;
    }

    /**
     * @notice Read a single batch ID from `wallet`'s list by index.
     *         Reverts if `index` is out of range.
     */
    function getWalletBatchAt(address wallet, uint256 index) external view returns (bytes32) {
        bytes32[] storage list = _walletBatches[wallet];
        require(index < list.length, "index out of range");
        return list[index];
    }

    /**
     * @notice Compute the batch ID a future call to {createSelfCustodyBatch}
     *         with the given `nonce` would produce. Useful to the UI to
     *         pre-compute the batch ID for receipts and downstream calls
     *         (top-up, attribution checks) before the on-chain tx lands.
     *
     * @dev `keccak256(abi.encode(address(this), nonce))` mirrors the Postage
     *      Stamp contract's own `batchId` derivation when `msg.sender` is
     *      this registry.
     */
    function predictBatchId(bytes32 nonce) external view returns (bytes32) {
        return keccak256(abi.encode(address(this), nonce));
    }
}
