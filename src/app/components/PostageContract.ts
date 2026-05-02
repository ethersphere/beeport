/**
 * Direct on-chain reads against the Gnosis Postage Stamp contract.
 *
 * The "Refresh stamps" UI flow uses these helpers as its source of truth
 * (instead of Bee's `/batches` endpoint, which depends on Bee being up and
 * synced). Self-custody batches are owned by our hot key on-chain, so reading
 * `batches(batchId)` directly always works as long as we have a Gnosis RPC.
 *
 * TTL math:
 *   chunksRemaining = normalisedBalance - currentTotalOutPayment   (PLUR)
 *   blocksRemaining = chunksRemaining / lastPrice                  (blocks)
 *   secondsRemaining = blocksRemaining * GNOSIS_BLOCK_TIME_SECONDS
 *
 * We verified the selectors against `0x45a1502382541Cd610CC9068e88727426b696293`
 * (Gnosis mainnet PostageStamp) — see commit message for the JSON-RPC probes.
 */

import type { Address, PublicClient } from 'viem';

import { GNOSIS_STAMP_ADDRESS, POSTAGE_STAMP_ABI } from './constants';
import type { ChainBatchInfo } from './SelfCustodyBatch';

/** Average Gnosis block time used to convert blocks-remaining → seconds. */
const GNOSIS_BLOCK_TIME_SECONDS = 5;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

export interface OnChainBatch {
  /** 0x-prefixed lowercase batch id. */
  batchId: `0x${string}`;
  /** 0x-prefixed lowercase owner address (= our hot key for self-custody). */
  owner: `0x${string}`;
  depth: number;
  bucketDepth: number;
  immutable: boolean;
  /** Total normalised balance in PLUR (per-chunk). */
  normalisedBalance: bigint;
  /** Block at which the batch was last updated (created or topped up). */
  lastUpdatedBlockNumber: bigint;
  /**
   * False when the contract returned a zero-owner row, which means the batch
   * either never existed or was fully expired and reaped from storage.
   */
  exists: boolean;
}

export interface OnChainPricing {
  /** Cumulative price-per-chunk paid since contract genesis (PLUR). */
  currentTotalOutPayment: bigint;
  /** Current price per chunk per block (PLUR). */
  lastPrice: bigint;
}

function toLowerHex(value: string): `0x${string}` {
  const lower = value.toLowerCase();
  return (lower.startsWith('0x') ? lower : `0x${lower}`) as `0x${string}`;
}

/** Read the global `currentTotalOutPayment` and `lastPrice` in one round-trip. */
export async function fetchOnChainPricing(
  publicClient: PublicClient
): Promise<OnChainPricing> {
  const [outPayment, price] = await Promise.all([
    publicClient.readContract({
      address: GNOSIS_STAMP_ADDRESS as Address,
      abi: POSTAGE_STAMP_ABI,
      functionName: 'currentTotalOutPayment',
    }) as Promise<bigint>,
    publicClient.readContract({
      address: GNOSIS_STAMP_ADDRESS as Address,
      abi: POSTAGE_STAMP_ABI,
      functionName: 'lastPrice',
    }) as Promise<bigint>,
  ]);
  return { currentTotalOutPayment: outPayment, lastPrice: price };
}

/** Read a single batch row from the contract. Never throws on missing rows. */
export async function fetchBatchFromContract(
  publicClient: PublicClient,
  batchId: string
): Promise<OnChainBatch> {
  const id = toLowerHex(batchId);
  const result = (await publicClient.readContract({
    address: GNOSIS_STAMP_ADDRESS as Address,
    abi: POSTAGE_STAMP_ABI,
    functionName: 'batches',
    args: [id],
  })) as readonly [string, number, number, boolean, bigint, bigint];

  const [owner, depth, bucketDepth, immutable_, normalisedBalance, lastUpdatedBlockNumber] =
    result;

  const ownerLower = (owner ?? ZERO_ADDRESS).toLowerCase() as `0x${string}`;

  return {
    batchId: id,
    owner: ownerLower,
    depth,
    bucketDepth,
    immutable: immutable_,
    normalisedBalance,
    lastUpdatedBlockNumber,
    exists: ownerLower !== ZERO_ADDRESS,
  };
}

/**
 * Compute remaining TTL in seconds. Returns 0 for non-existent / fully expired
 * batches. Pricing is read once and reused across many batches.
 */
export function computeBatchTTL(batch: OnChainBatch, pricing: OnChainPricing): number {
  if (!batch.exists) return 0;
  if (pricing.lastPrice === 0n) return 0;
  if (batch.normalisedBalance <= pricing.currentTotalOutPayment) return 0;
  const chunksRemaining = batch.normalisedBalance - pricing.currentTotalOutPayment;
  const blocksRemaining = chunksRemaining / pricing.lastPrice;
  // BigInt → number is safe up to 2^53. For TTLs > 4M years we'd overflow,
  // which won't happen with realistic batch balances.
  const seconds = Number(blocksRemaining) * GNOSIS_BLOCK_TIME_SECONDS;
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

/**
 * Convert an on-chain batch + pricing into the legacy `ChainBatchInfo` shape
 * the UI already understands. Field semantics match Bee's `/batches` endpoint
 * so consumers don't have to branch on data source.
 */
export function toChainBatchInfo(
  batch: OnChainBatch,
  pricing: OnChainPricing
): ChainBatchInfo {
  return {
    batchID: batch.batchId.startsWith('0x') ? batch.batchId.slice(2) : batch.batchId,
    value: batch.normalisedBalance.toString(),
    start: Number(batch.lastUpdatedBlockNumber),
    owner: batch.owner.startsWith('0x') ? batch.owner.slice(2) : batch.owner,
    depth: batch.depth,
    bucketDepth: batch.bucketDepth,
    immutable: batch.immutable,
    batchTTL: computeBatchTTL(batch, pricing),
  };
}

/**
 * Refresh a list of known batchIds against the contract directly. Returns a
 * map keyed by 0x-lower batchId. Failed reads (RPC error, malformed id) are
 * skipped silently; callers should treat absence as "unknown" not "expired".
 */
export async function refreshBatchesFromContract(
  publicClient: PublicClient,
  batchIds: string[]
): Promise<Map<string, ChainBatchInfo>> {
  const out = new Map<string, ChainBatchInfo>();
  if (batchIds.length === 0) return out;

  const pricing = await fetchOnChainPricing(publicClient);

  // Could be parallelised with multicall for free if the public client
  // supports it; viem's parallel readContract gives us connection pooling
  // for the same effect on small lists.
  const results = await Promise.allSettled(
    batchIds.map(id => fetchBatchFromContract(publicClient, id))
  );
  results.forEach((r, idx) => {
    if (r.status !== 'fulfilled') {
      console.warn('Batch read failed for', batchIds[idx], r.reason);
      return;
    }
    out.set(r.value.batchId, toChainBatchInfo(r.value, pricing));
  });
  return out;
}

/**
 * Discover every batch id whose `_owner` matches `ownerAddress` by scanning
 * `BatchCreated` events. The owner field is NOT indexed in the upstream
 * contract, so we filter client-side.
 *
 * @param fromBlock first block to scan from. Use the user's earliest known
 *   batch's `lastUpdatedBlockNumber` minus a small safety margin to avoid
 *   pulling millions of irrelevant logs.
 * @param chunkSize maximum range per `eth_getLogs` call. Most public RPCs cap
 *   at 10_000–50_000 blocks. Default 25_000 works on Ankr / dRPC / Gateway.fm.
 */
export async function discoverBatchesByOwner(
  publicClient: PublicClient,
  ownerAddress: string,
  fromBlock: bigint,
  chunkSize = 25_000n
): Promise<string[]> {
  const target = ownerAddress.toLowerCase();
  const found = new Set<string>();
  const latestBlock = await publicClient.getBlockNumber();
  let cursor = fromBlock;

  while (cursor <= latestBlock) {
    const end = cursor + chunkSize - 1n > latestBlock ? latestBlock : cursor + chunkSize - 1n;
    try {
      const logs = await publicClient.getContractEvents({
        address: GNOSIS_STAMP_ADDRESS as Address,
        abi: POSTAGE_STAMP_ABI,
        eventName: 'BatchCreated',
        fromBlock: cursor,
        toBlock: end,
      });
      for (const log of logs) {
        const args = (log as any).args ?? {};
        const owner = String(args.owner ?? '').toLowerCase();
        const batchId = String(args.batchId ?? '').toLowerCase();
        if (owner === target && batchId) {
          found.add(batchId);
        }
      }
    } catch (err) {
      // RPC may have rejected the range. Halve and retry the failing window.
      if (chunkSize > 1000n) {
        return discoverBatchesByOwner(publicClient, ownerAddress, cursor, chunkSize / 2n);
      }
      console.warn('discoverBatchesByOwner: skipping window', cursor, '→', end, err);
    }
    cursor = end + 1n;
  }
  return Array.from(found);
}
