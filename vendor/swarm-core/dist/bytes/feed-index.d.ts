import { Bytes } from './bytes.js';
/**
 * An 8-byte, big-endian sequential feed update index.
 */
export declare class FeedIndex extends Bytes {
    static readonly LENGTH = 8;
    /** Sentinel index (all bits set) some feed types use to mean "no update yet". */
    static readonly MINUS_ONE: FeedIndex;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Encodes a bigint index as an 8-byte, big-endian FeedIndex.
     */
    static fromBigInt(value: bigint): FeedIndex;
    /**
     * Decodes the index as a bigint.
     */
    toBigInt(): bigint;
    /**
     * Returns the next sequential index, wrapping {@link MINUS_ONE} back to 0.
     */
    next(): FeedIndex;
}
//# sourceMappingURL=feed-index.d.ts.map