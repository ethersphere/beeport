/**
 * On-chain helpers for self-custody postage batch creation (SWIP mode α).
 *
 * All create/top-up flows go through {@link STAMPS_REGISTRY_V2_ADDRESS}.
 * The registry is always `msg.sender` to the upstream Postage Stamp contract,
 * so batch IDs are deterministic:
 *
 *     batchId = keccak256(abi.encode(STAMPS_REGISTRY_V2_ADDRESS, nonce))
 *
 * regardless of whether the caller is the user's EOA or a Relay multicaller
 * (one-shot bridge → buy stamp).
 */

import {
  encodeAbiParameters,
  encodeFunctionData,
  keccak256,
  parseAbi,
  parseAbiParameters,
} from 'viem';
import type { PublicClient, WalletClient } from 'viem';

import { fetchBatchFromContract } from './PostageContract';

import {
  GNOSIS_BZZ_ADDRESS,
  STAMPS_REGISTRY_V2_ABI,
  STAMPS_REGISTRY_V2_ADDRESS,
} from './constants';

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

const BZZ_ALLOWANCE_ABI = parseAbi([
  'function allowance(address owner, address spender) external view returns (uint256)',
  'function approve(address spender, uint256 amount) external returns (bool)',
]);

/**
 * Compute `batchId = keccak256(abi.encode(sender, nonce))` exactly as the
 * upstream Postage Stamp contract does when `createBatch` is invoked with
 * `msg.sender == sender`. For Beeport, `sender` is always
 * {@link STAMPS_REGISTRY_V2_ADDRESS}.
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

// ─────────────────────────────────────────────────────────────────────────────
// StampsRegistryV2 — sole supported create/top-up path
// ─────────────────────────────────────────────────────────────────────────────

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
// Self-custody batch persistence (localStorage) + on-chain index
//
// Batches created via StampsRegistryV2 are also listed on-chain under the
// payer wallet (`getWalletBatchIds`). The local store is a fast cache and
// holds extra UI metadata. Live TTL/depth still come from the Postage Stamp
// contract (`refreshBatchesFromContract` in the stamp list).
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
   * Always set for new rows; present for all StampsRegistryV2 creates.
   * Omitted on very old local entries only.
   */
  createdVia?: 'registry';
  /**
   * True when the row was rebuilt from the registry's `getWalletBatchIds`
   * and this browser never created the batch. Such a batch can already hold
   * stamped chunks from another device, so a missing issuer-state SOC must
   * NOT be treated as "unused batch" (see {@link isBatchCreatedInThisBrowser}).
   */
  syncedFromChain?: boolean;
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
 * True when this browser recorded creating `batchId` (under any wallet).
 * Used as evidence that a batch with no issuer-state SOC really is unused.
 */
export function isBatchCreatedInThisBrowser(batchId: string): boolean {
  const id = (batchId.startsWith('0x') ? batchId : `0x${batchId}`).toLowerCase();
  const store = loadStore();
  return Object.values(store).some(
    list =>
      Array.isArray(list) &&
      list.some(b => b?.batchId?.toLowerCase() === id && !b.syncedFromChain)
  );
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

// ─── Pending purchases + on-chain reconcile ──────────────────────────────────
//
// A Relay one-shot buy can take longer than the UI waits, or the status poll
// can fail, after the user has paid. We record the purchase BEFORE it starts,
// so the batch can be found again from the chain later. `getWalletBatchIds`
// then restores any batch whose local row is missing.

const PENDING_KEY = 'beeport.pendingBatchPurchases.v1';
/** A pending purchase that is still not on chain after this long is dropped. */
const PENDING_MAX_AGE_SECONDS = 24 * 60 * 60;

export interface PendingBatchPurchase {
  batchId: `0x${string}`;
  walletAddress: string;
  hotKeyAddress: string;
  depth: number;
  bucketDepth: number;
  totalAmount: string;
  immutableFlag: boolean;
  /** Unix seconds when the purchase started. */
  timestamp: number;
}

function loadPending(): PendingBatchPurchase[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PENDING_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistPending(list: PendingBatchPurchase[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(PENDING_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Failed to persist pending batch purchases:', err);
  }
}

/** Record a purchase that is about to start. Idempotent by `batchId`. */
export function savePendingBatchPurchase(p: PendingBatchPurchase): void {
  const list = loadPending().filter(x => x.batchId.toLowerCase() !== p.batchId.toLowerCase());
  list.push(p);
  persistPending(list);
}

/** Forget a pending purchase (it succeeded, or it was reconciled). */
export function removePendingBatchPurchase(batchId: string): void {
  const id = batchId.toLowerCase();
  persistPending(loadPending().filter(x => x.batchId.toLowerCase() !== id));
}

/**
 * Bring the local batch list in line with the chain for one wallet:
 *  1. every batch id in the registry's `getWalletBatchIds(wallet)` that has no
 *     local row gets one (so a wiped browser, or a purchase whose status poll
 *     failed, still shows the stamp);
 *  2. pending purchases that landed are promoted; stale ones are dropped.
 *
 * Returns how many rows were added. Never throws on RPC failure.
 */
export async function reconcileWalletBatches(
  walletAddress: string,
  client: PublicClient
): Promise<number> {
  if (!walletAddress) return 0;
  const wallet = walletAddress.toLowerCase();
  let added = 0;
  try {
    const onChainIds = (await client.readContract({
      address: STAMPS_REGISTRY_V2_ADDRESS as `0x${string}`,
      abi: STAMPS_REGISTRY_V2_ABI,
      functionName: 'getWalletBatchIds',
      args: [walletAddress as `0x${string}`],
    })) as readonly `0x${string}`[];

    const known = new Set(getSelfCustodyBatches(walletAddress).map(b => b.batchId.toLowerCase()));
    const pending = loadPending();
    const nowSec = Math.floor(Date.now() / 1000);

    for (const rawId of onChainIds) {
      const id = rawId.toLowerCase() as `0x${string}`;
      if (known.has(id)) {
        removePendingBatchPurchase(id);
        continue;
      }
      const batch = await fetchBatchFromContract(client, id);
      if (!batch.exists) continue; // expired and removed, nothing to show
      const p = pending.find(x => x.batchId.toLowerCase() === id);
      saveSelfCustodyBatch(walletAddress, {
        batchId: id,
        walletAddress: wallet,
        hotKeyAddress: p?.hotKeyAddress ?? batch.owner,
        depth: batch.depth,
        bucketDepth: batch.bucketDepth,
        totalAmount: p?.totalAmount ?? '0',
        timestamp: p?.timestamp ?? nowSec,
        immutableFlag: batch.immutable,
        createdVia: 'registry',
        // A purchase started in this browser is known to be fresh; anything
        // else may carry stamps from another device.
        syncedFromChain: p ? undefined : true,
      });
      removePendingBatchPurchase(id);
      added++;
    }

    // Drop pending purchases that never reached the chain.
    for (const p of pending) {
      if (
        p.walletAddress.toLowerCase() === wallet &&
        nowSec - p.timestamp > PENDING_MAX_AGE_SECONDS
      ) {
        removePendingBatchPurchase(p.batchId);
      }
    }
  } catch (err) {
    console.warn('reconcileWalletBatches failed:', err);
  }
  return added;
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
  /** False when the Postage Stamp contract has no row for the batch. */
  exists?: boolean;
}
