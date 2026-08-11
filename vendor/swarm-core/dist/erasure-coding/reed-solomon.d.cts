/**
 * Encodes `data` shards (all the same length) into `parityCount` parity
 * shards of that same length, using GF(2^8) Reed-Solomon. Data shards are
 * not modified. Compatible with klauspost/reedsolomon's default encoder -
 * the same scheme real Bee nodes use, so this interoperates with them.
 */
export declare function rsEncode(data: Uint8Array[], parityCount: number): Uint8Array[];
/**
 * Reconstructs missing DATA shards from a mix of available data and parity
 * shards using GF(2^8) Reed-Solomon (erasure decoding) — the inverse of
 * `rsEncode`. `shards` is index-aligned and `dataCount + parityCount` long:
 * data shards first, then parity shards. Present shards are equal-length
 * Uint8Arrays; missing shards are `null`. Returns the `dataCount` data shards
 * with any missing ones reconstructed (present ones are returned as-is).
 * Throws if fewer than `dataCount` shards are present (unrecoverable).
 * Compatible with klauspost/reedsolomon, so it decodes data produced by real
 * Bee nodes.
 */
export declare function rsDecode(shards: (Uint8Array | null)[], dataCount: number, parityCount: number): Uint8Array[];
//# sourceMappingURL=reed-solomon.d.cts.map