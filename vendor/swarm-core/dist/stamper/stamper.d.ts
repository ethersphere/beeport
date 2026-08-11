import { BatchId } from '../bytes/batch-id.js';
import { PrivateKey } from '../bytes/private-key.js';
import { EnvelopeWithBatchId } from './marshal.js';
/**
 * Signs a single chunk address into a postage stamp envelope.
 *
 * `slot` is the chunk's position within its bucket (the top 16 bits of its
 * address) - callers tracking their own bucket state pick this themselves.
 * `Stamper` below tracks it automatically instead.
 */
export declare function stamp(signer: PrivateKey | Uint8Array | string, batchId: BatchId | Uint8Array | string, address: Uint8Array, slot: number, timestampMs?: number): EnvelopeWithBatchId;
/**
 * Stateful postage stamp issuer: tracks how many chunks have been stamped
 * into each of the batch's 65536 buckets, so each chunk gets a distinct,
 * capacity-respecting index without the caller managing that bookkeeping.
 */
export declare class Stamper {
    signer: PrivateKey;
    batchId: BatchId;
    buckets: Uint32Array;
    depth: number;
    maxSlot: number;
    private constructor();
    /**
     * Creates a fresh Stamper for a batch with no chunks stamped yet.
     */
    static fromBlank(signer: PrivateKey | Uint8Array | string, batchId: BatchId | Uint8Array | string, depth: number): Stamper;
    /**
     * Resumes a Stamper from a previously persisted bucket state (see {@link getState}).
     */
    static fromState(signer: PrivateKey | Uint8Array | string, batchId: BatchId | Uint8Array | string, buckets: Uint32Array, depth: number): Stamper;
    /**
     * Stamps a chunk address, automatically picking and reserving the next
     * free slot in its bucket. Throws once a bucket reaches its depth-derived capacity.
     */
    stamp(address: Uint8Array, timestampMs?: number): EnvelopeWithBatchId;
    /**
     * Returns the live bucket-height state, for persisting and later resuming
     * via {@link fromState}.
     */
    getState(): Uint32Array;
}
//# sourceMappingURL=stamper.d.ts.map