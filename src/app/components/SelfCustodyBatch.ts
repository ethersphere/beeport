/**
 * On-chain helpers for SELF-CUSTODY postage batch creation (SWIP mode α).
 *
 * Two on-chain paths are supported, both ending in a non-custodial batch
 * (on-chain `_owner` is a hot key the browser tab derived; the Bee node
 * holds no key material):
 *
 *  1. **Direct path** (legacy): the user's wallet calls the upstream
 *     Postage Stamp contract directly. `msg.sender` to PostageStamp is the
 *     wallet, so:
 *
 *         batchId = keccak256(abi.encode(walletAddress, nonce))
 *
 *     Two wallet prompts (BZZ approve → createBatch).
 *
 *  2. **Registry path** (preferred — enables Relay one-shot buy):
 *     the wallet (or a Relay multicaller) calls `StampsRegistryV2`, which
 *     then calls PostageStamp. `msg.sender` to PostageStamp is always the
 *     registry, so:
 *
 *         batchId = keccak256(abi.encode(STAMPS_REGISTRY_V2_ADDRESS, nonce))
 *
 *     This is deterministic regardless of who calls the registry, which
 *     is what lets Relay's `txs` action (post-bridge multicaller) produce
 *     the same `batchId` we computed client-side.
 *
 * Both paths set the same on-chain `_owner = hotKeyAddress` and produce
 * batches that are equally non-custodial. Direction of new code should
 * prefer the registry path; the direct helpers are kept for non-Relay
 * fallback (e.g. the user is already on Gnosis with BZZ and wants to skip
 * any aggregator).
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiParameters,
} from 'viem';
import type { PublicClient, WalletClient } from 'viem';

import {
  GNOSIS_BZZ_ADDRESS,
  GNOSIS_STAMP_ADDRESS,
  POSTAGE_STAMP_ABI,
  STAMPS_REGISTRY_V2_ABI,
  STAMPS_REGISTRY_V2_ADDRESS,
} from './constants';

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const BZZ_ALLOWANCE_ABI = parseAbi([
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

export interface CreateSelfCustodyBatchParams {
  walletClient: WalletClient;
  publicClient: PublicClient;
  /** Connected wallet address (msg.sender, payer). */
  walletAddress: `0x${string}`;
  /** Hot-key address that becomes the on-chain owner of the batch. */
  hotKeyAddress: `0x${string}`;
  initialBalancePerChunk: bigint;
  depth: number;
  bucketDepth: number;
  /** 32-byte hex nonce. With or without 0x prefix. */
  nonce: `0x${string}` | string;
  immutable_: boolean;
  approvalType?: 'exact' | 'infinite';
  onStatus?: (msg: string) => void;
}

export interface SelfCustodyBatchResult {
  /** Lower-case 0x-prefixed batch id. */
  batchId: `0x${string}`;
  /** Tx hash of the createBatch call. */
  createBatchTxHash: `0x${string}`;
  /**
   * Block number at which `createBatch` mined. Used downstream by
   * {@link ../GatewayChainSync.waitForGatewayBatchSync} so the upload UI
   * can wait for the gateway's chain listener to index past this block
   * before posting the first chunk.
   */
  createBatchBlockNumber: bigint;
  /** Tx hash of the BZZ approve call (undefined if allowance was sufficient). */
  approveTxHash?: `0x${string}`;
}

/**
 * Compute `batchId = keccak256(abi.encode(sender, nonce))` exactly as the
 * upstream Swarm Postage Stamp contract does on `createBatch`.
 *
 * When `sender` is the user's wallet (self-custody mode), use the wallet
 * address. When `sender` is the StampsRegistry (legacy mode), pass that.
 */
export function computeBatchId(sender: string, nonce: string): `0x${string}` {
  const senderHex = sender.startsWith('0x') ? sender : `0x${sender}`;
  const nonceHex = nonce.startsWith('0x') ? nonce : `0x${nonce}`;
  const encoded = encodeAbiParameters(parseAbiParameters(['address', 'bytes32']), [
    senderHex as `0x${string}`,
    nonceHex as `0x${string}`,
  ]);
  return keccak256(encoded);
}

/**
 * Approve BZZ to the postage contract (if needed) and call
 * `createBatch(_owner = hotKeyAddress, …)`. Returns the resulting `batchId`
 * once the tx is mined. Persisted to localStorage so the UI can list it
 * without depending on Bee's `/stamps` endpoint (which only enumerates
 * batches owned by Bee's own wallet, not self-custody ones).
 */
export async function createSelfCustodyBatch(
  params: CreateSelfCustodyBatchParams
): Promise<SelfCustodyBatchResult> {
  const {
    walletClient,
    publicClient,
    walletAddress,
    hotKeyAddress,
    initialBalancePerChunk,
    depth,
    bucketDepth,
    nonce,
    immutable_,
    approvalType = 'exact',
    onStatus,
  } = params;

  const totalAmount = initialBalancePerChunk * BigInt(2 ** depth);

  // ── Step 1: BZZ approval (if needed) ──────────────────────────────────────
  // Direct postage path requires the user's wallet to approve BZZ to the
  // postage contract, NOT the StampsRegistry — different spender.
  onStatus?.('Checking BZZ allowance…');
  const allowance = await publicClient.readContract({
    address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
    abi: BZZ_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [walletAddress, GNOSIS_STAMP_ADDRESS as `0x${string}`],
  });

  let approveTxHash: `0x${string}` | undefined;
  if ((allowance as bigint) < totalAmount) {
    onStatus?.('Approving BZZ to the Swarm postage contract…');
    const approveAmount = approvalType === 'infinite' ? BigInt(MAX_UINT256) : totalAmount;
    approveTxHash = await walletClient.writeContract({
      address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
      abi: BZZ_ALLOWANCE_ABI,
      functionName: 'approve',
      args: [GNOSIS_STAMP_ADDRESS as `0x${string}`, approveAmount],
      account: walletAddress,
      chain: walletClient.chain,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveTxHash,
    });
    if (approveReceipt.status !== 'success') {
      throw new Error('BZZ approval transaction reverted');
    }
  }

  // ── Step 2: createBatch on the postage contract directly ─────────────────
  onStatus?.('Creating batch on Swarm postage contract…');
  const createTxHash = await walletClient.writeContract({
    address: GNOSIS_STAMP_ADDRESS as `0x${string}`,
    abi: POSTAGE_STAMP_ABI,
    functionName: 'createBatch',
    args: [
      hotKeyAddress,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      (nonce.startsWith('0x') ? nonce : `0x${nonce}`) as `0x${string}`,
      immutable_,
    ],
    account: walletAddress,
    chain: walletClient.chain,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash });
  if (receipt.status !== 'success') {
    throw new Error('createBatch transaction reverted');
  }

  // batchId derivation: msg.sender is the user's wallet here.
  const batchId = computeBatchId(walletAddress, nonce);

  return {
    batchId,
    createBatchTxHash: createTxHash,
    createBatchBlockNumber: receipt.blockNumber,
    approveTxHash,
  };
}

/**
 * Top up a self-custody batch directly on the postage contract.
 * Caller must be the original payer-wallet (or any wallet with enough BZZ).
 */
export interface TopUpSelfCustodyBatchParams {
  walletClient: WalletClient;
  publicClient: PublicClient;
  walletAddress: `0x${string}`;
  batchId: `0x${string}`;
  /** Per-chunk top-up amount in BZZ atomic units. */
  topUpAmountPerChunk: bigint;
  /** Required to compute total BZZ to approve. */
  depth: number;
  approvalType?: 'exact' | 'infinite';
  onStatus?: (msg: string) => void;
}

export async function topUpSelfCustodyBatch(
  params: TopUpSelfCustodyBatchParams
): Promise<{ topUpTxHash: `0x${string}`; approveTxHash?: `0x${string}` }> {
  const {
    walletClient,
    publicClient,
    walletAddress,
    batchId,
    topUpAmountPerChunk,
    depth,
    approvalType = 'exact',
    onStatus,
  } = params;

  const totalAmount = topUpAmountPerChunk * BigInt(2 ** depth);

  onStatus?.('Checking BZZ allowance…');
  const allowance = await publicClient.readContract({
    address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
    abi: BZZ_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [walletAddress, GNOSIS_STAMP_ADDRESS as `0x${string}`],
  });

  let approveTxHash: `0x${string}` | undefined;
  if ((allowance as bigint) < totalAmount) {
    onStatus?.('Approving BZZ for top-up…');
    const approveAmount = approvalType === 'infinite' ? BigInt(MAX_UINT256) : totalAmount;
    approveTxHash = await walletClient.writeContract({
      address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
      abi: BZZ_ALLOWANCE_ABI,
      functionName: 'approve',
      args: [GNOSIS_STAMP_ADDRESS as `0x${string}`, approveAmount],
      account: walletAddress,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  onStatus?.('Topping up batch on Swarm postage contract…');
  const topUpTxHash = await walletClient.writeContract({
    address: GNOSIS_STAMP_ADDRESS as `0x${string}`,
    abi: POSTAGE_STAMP_ABI,
    functionName: 'topUp',
    args: [batchId, topUpAmountPerChunk],
    account: walletAddress,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: topUpTxHash });
  if (receipt.status !== 'success') {
    throw new Error('topUp transaction reverted');
  }
  return { topUpTxHash, approveTxHash };
}

// ─────────────────────────────────────────────────────────────────────────────
// Registry-routed path (StampsRegistryV2)
//
// All BZZ + createBatch interactions go through `StampsRegistryV2`, which is
// the actual `msg.sender` to PostageStamp. This makes `batchId` deterministic
// (= `keccak256(REGISTRY_V2, nonce)`) regardless of who calls the registry,
// which in turn lets a Relay multicaller execute the whole "approve BZZ +
// createSelfCustodyBatch" sequence as a `txs` post-action after a cross-chain
// fill — restoring the legacy one-signature buy UX.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * BZZ approve + `createSelfCustodyBatch` against {@link STAMPS_REGISTRY_V2_ADDRESS}.
 * Caller is the user's wallet on Gnosis (i.e. no aggregator). For the Relay
 * one-shot path see {@link encodeRegistryCreateBatchTxs} which produces the
 * raw calldata for `txs[]`.
 */
export async function createSelfCustodyBatchViaRegistry(
  params: CreateSelfCustodyBatchParams
): Promise<SelfCustodyBatchResult> {
  const {
    walletClient,
    publicClient,
    walletAddress,
    hotKeyAddress,
    initialBalancePerChunk,
    depth,
    bucketDepth,
    nonce,
    immutable_,
    approvalType = 'exact',
    onStatus,
  } = params;

  const totalAmount = initialBalancePerChunk * BigInt(2 ** depth);

  // ── Step 1: BZZ approval to the REGISTRY (not PostageStamp) ──────────────
  onStatus?.('Checking BZZ allowance…');
  const allowance = await publicClient.readContract({
    address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
    abi: BZZ_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [walletAddress, STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`],
  });

  let approveTxHash: `0x${string}` | undefined;
  if ((allowance as bigint) < totalAmount) {
    onStatus?.('Approving BZZ to the StampsRegistryV2…');
    const approveAmount = approvalType === 'infinite' ? BigInt(MAX_UINT256) : totalAmount;
    approveTxHash = await walletClient.writeContract({
      address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
      abi: BZZ_ALLOWANCE_ABI,
      functionName: 'approve',
      args: [STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`, approveAmount],
      account: walletAddress,
      chain: walletClient.chain,
    });

    const approveReceipt = await publicClient.waitForTransactionReceipt({
      hash: approveTxHash,
    });
    if (approveReceipt.status !== 'success') {
      throw new Error('BZZ approval transaction reverted');
    }
  }

  // ── Step 2: createSelfCustodyBatch on the registry ───────────────────────
  onStatus?.('Creating batch via StampsRegistryV2…');
  const createTxHash = await walletClient.writeContract({
    address: STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`,
    abi: STAMPS_REGISTRY_V2_ABI,
    functionName: 'createSelfCustodyBatch',
    args: [
      walletAddress,
      hotKeyAddress,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      (nonce.startsWith('0x') ? nonce : `0x${nonce}`) as `0x${string}`,
      immutable_,
    ],
    account: walletAddress,
    chain: walletClient.chain,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: createTxHash });
  if (receipt.status !== 'success') {
    throw new Error('createSelfCustodyBatch transaction reverted');
  }

  // batchId derivation: msg.sender to PostageStamp is the registry, so the
  // sender for keccak256 is REGISTRY_V2 — NOT the wallet.
  const batchId = computeBatchId(STAMPS_REGISTRY_V2_ADDRESS, nonce);

  return {
    batchId,
    createBatchTxHash: createTxHash,
    createBatchBlockNumber: receipt.blockNumber,
    approveTxHash,
  };
}

/**
 * Top up an existing registry-created batch via the registry. Permissionless:
 * any wallet with enough BZZ may call this, not just the original payer.
 */
export async function topUpSelfCustodyBatchViaRegistry(
  params: TopUpSelfCustodyBatchParams
): Promise<{ topUpTxHash: `0x${string}`; approveTxHash?: `0x${string}` }> {
  const {
    walletClient,
    publicClient,
    walletAddress,
    batchId,
    topUpAmountPerChunk,
    depth,
    approvalType = 'exact',
    onStatus,
  } = params;

  const totalAmount = topUpAmountPerChunk * BigInt(2 ** depth);

  onStatus?.('Checking BZZ allowance…');
  const allowance = await publicClient.readContract({
    address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
    abi: BZZ_ALLOWANCE_ABI,
    functionName: 'allowance',
    args: [walletAddress, STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`],
  });

  let approveTxHash: `0x${string}` | undefined;
  if ((allowance as bigint) < totalAmount) {
    onStatus?.('Approving BZZ for top-up…');
    const approveAmount = approvalType === 'infinite' ? BigInt(MAX_UINT256) : totalAmount;
    approveTxHash = await walletClient.writeContract({
      address: GNOSIS_BZZ_ADDRESS as `0x${string}`,
      abi: BZZ_ALLOWANCE_ABI,
      functionName: 'approve',
      args: [STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`, approveAmount],
      account: walletAddress,
      chain: walletClient.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTxHash });
  }

  onStatus?.('Topping up batch via StampsRegistryV2…');
  const topUpTxHash = await walletClient.writeContract({
    address: STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`,
    abi: STAMPS_REGISTRY_V2_ABI,
    functionName: 'topUpBatch',
    args: [batchId, topUpAmountPerChunk],
    account: walletAddress,
    chain: walletClient.chain,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: topUpTxHash });
  if (receipt.status !== 'success') {
    throw new Error('registry topUpBatch transaction reverted');
  }
  return { topUpTxHash, approveTxHash };
}

/**
 * Build the calldata for the two-step Relay `txs` post-action that turns a
 * cross-chain swap into a single-signature self-custody buy:
 *
 *   1. `BZZ.approve(STAMPS_REGISTRY_V2, totalAmount)` — Relay's multicaller,
 *      which holds BZZ after the bridge fill, lets the registry pull it.
 *   2. `StampsRegistryV2.createSelfCustodyBatch(wallet, hotKey, …)` — registry
 *      pays BZZ to PostageStamp and registers the batch under `wallet` with
 *      `_owner = hotKey`.
 *
 * Returned objects match Relay's `RelayQuoteRequest.txs[]` shape:
 *   `{ to: string; value: string; data: 0x… }`.
 *
 * NOTE: When using these `txs`, set Relay's `recipient` to the multicaller
 * (per Relay's docs for executor-side actions) so BZZ lands where step 1's
 * approve will spend from. The user pays exactly once: the original signed
 * tx that funds the bridge on the origin chain.
 */
export function encodeRegistryCreateBatchTxs(args: {
  walletAddress: `0x${string}`;
  hotKeyAddress: `0x${string}`;
  initialBalancePerChunk: bigint;
  depth: number;
  bucketDepth: number;
  nonce: `0x${string}` | string;
  immutable_: boolean;
  approvalType?: 'exact' | 'infinite';
}): Array<{ to: `0x${string}`; value: string; data: `0x${string}` }> {
  const {
    walletAddress,
    hotKeyAddress,
    initialBalancePerChunk,
    depth,
    bucketDepth,
    nonce,
    immutable_,
    approvalType = 'exact',
  } = args;

  const totalAmount = initialBalancePerChunk * BigInt(2 ** depth);
  const approveAmount = approvalType === 'infinite' ? BigInt(MAX_UINT256) : totalAmount;
  const nonceHex = (nonce.startsWith('0x') ? nonce : `0x${nonce}`) as `0x${string}`;

  const approveData = encodeFunctionData({
    abi: BZZ_ALLOWANCE_ABI,
    functionName: 'approve',
    args: [STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`, approveAmount],
  });

  const createData = encodeFunctionData({
    abi: STAMPS_REGISTRY_V2_ABI,
    functionName: 'createSelfCustodyBatch',
    args: [
      walletAddress,
      hotKeyAddress,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      nonceHex,
      immutable_,
    ],
  });

  return [
    { to: GNOSIS_BZZ_ADDRESS as `0x${string}`, value: '0', data: approveData },
    { to: STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`, value: '0', data: createData },
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Self-custody batch persistence (localStorage)
//
// Self-custody batches are NOT discoverable via `StampsRegistry.getOwnerBatches`
// — they're created directly on the upstream Postage Stamp contract with the
// user's wallet as `msg.sender` and a hot key as `_owner`. To list them in the
// "Your Stamps" UI we store metadata locally, keyed by the connected wallet.
//
// The Bee gateway is still the source of truth for live state (`utilization`,
// `batchTTL`, `usable`); we only persist what we need to find the batch later.
// ─────────────────────────────────────────────────────────────────────────────

export interface StoredSelfCustodyBatch {
  batchId: `0x${string}`;
  /** Wallet address that paid (msg.sender of createBatch). */
  walletAddress: string;
  /** On-chain owner — only this hot key can sign valid stamps for this batch. */
  hotKeyAddress: string;
  depth: number;
  bucketDepth: number;
  /** Total BZZ paid, atomic units (= initialBalancePerChunk × 2^depth). */
  totalAmount: string;
  /** Unix seconds. Best-effort, set at save time. */
  timestamp: number;
  immutableFlag: boolean;
  /** createBatch tx hash, for trail / explorer linking. */
  createBatchTxHash?: string;
  /**
   * Gnosis block number at which `createBatch` mined. Stored as a JSON-safe
   * `number` (bigint round-trips cleanly here — block heights are well below
   * `Number.MAX_SAFE_INTEGER` for the next ~10⁵ years).
   *
   * Optional because entries persisted by an older build won't have it; the
   * upload flow falls back to optimistic mode in that case.
   */
  createBatchBlockNumber?: number;
  /** Set true once a top-up has completed. UI hint only. */
  hasBeenToppedUp?: boolean;
  /**
   * Which on-chain path created this batch. Determines `batchId` derivation:
   *   - 'direct'   → keccak256(walletAddress, nonce)        [legacy]
   *   - 'registry' → keccak256(STAMPS_REGISTRY_V2, nonce)   [preferred]
   *
   * Defaulted to 'direct' for entries written before this field existed so
   * the Bee gateway lookup logic remains correct after upgrade.
   */
  createdVia?: 'direct' | 'registry';
}

const STORE_KEY = 'beeport.selfCustodyBatches.v1';

interface SelfCustodyBatchStore {
  [walletAddress: string]: StoredSelfCustodyBatch[];
}

function loadStore(): SelfCustodyBatchStore {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (err) {
    console.warn('Failed to read self-custody batch store:', err);
    return {};
  }
}

function persistStore(store: SelfCustodyBatchStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch (err) {
    console.warn('Failed to persist self-custody batch store:', err);
  }
}

/**
 * Save a freshly-created self-custody batch under `walletAddress`. Idempotent
 * by `batchId` — calling twice for the same batch is a no-op.
 */
export function saveSelfCustodyBatch(
  walletAddress: string,
  batch: StoredSelfCustodyBatch
): void {
  const key = walletAddress.toLowerCase();
  const store = loadStore();
  const list = store[key] ?? [];
  const existing = list.findIndex(b => b.batchId.toLowerCase() === batch.batchId.toLowerCase());
  if (existing === -1) {
    list.unshift(batch);
  } else {
    list[existing] = { ...list[existing], ...batch };
  }
  store[key] = list;
  persistStore(store);
}

/**
 * Return all self-custody batches saved under `walletAddress`, newest first.
 */
export function getSelfCustodyBatches(walletAddress: string): StoredSelfCustodyBatch[] {
  if (!walletAddress) return [];
  const key = walletAddress.toLowerCase();
  const store = loadStore();
  const list = store[key] ?? [];
  return [...list].sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Mark an existing batch as topped up so the UI can reflect the state. No-op
 * if the batch isn't already saved under this wallet.
 */
export function markSelfCustodyBatchToppedUp(
  walletAddress: string,
  batchId: string
): void {
  const key = walletAddress.toLowerCase();
  const target = batchId.toLowerCase().startsWith('0x')
    ? batchId.toLowerCase()
    : `0x${batchId.toLowerCase()}`;
  const store = loadStore();
  const list = store[key];
  if (!list) return;
  const idx = list.findIndex(b => b.batchId.toLowerCase() === target);
  if (idx === -1) return;
  list[idx] = { ...list[idx], hasBeenToppedUp: true };
  store[key] = list;
  persistStore(store);
}

/**
 * Remove a saved self-custody batch (e.g. expired / explicitly forgotten).
 */
export function removeSelfCustodyBatch(walletAddress: string, batchId: string): void {
  const key = walletAddress.toLowerCase();
  const target = batchId.toLowerCase().startsWith('0x')
    ? batchId.toLowerCase()
    : `0x${batchId.toLowerCase()}`;
  const store = loadStore();
  const list = store[key];
  if (!list) return;
  store[key] = list.filter(b => b.batchId.toLowerCase() !== target);
  persistStore(store);
}

// ─── Chain-indexed batch info shape ──────────────────────────────────────────

/**
 * Canonical batch-info shape used across the UI. Field names mirror Bee's
 * legacy `/batches` JSON output for backwards-compat, but the data is now
 * sourced directly from the Postage Stamp contract via `PostageContract.ts`.
 */
export interface ChainBatchInfo {
  batchID: string;
  /** Total normalised payment in PLUR. */
  value: string;
  /** Block number at which the batch was created or last topped up. */
  start: number;
  /** Batch owner address (no 0x prefix) — for self-custody this is the hot key. */
  owner: string;
  depth: number;
  bucketDepth: number;
  immutable: boolean;
  /** Seconds until expiry. */
  batchTTL: number;
}
