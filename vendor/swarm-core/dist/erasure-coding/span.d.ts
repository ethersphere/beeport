/**
 * Encodes the redundancy level used for an intermediate chunk into bit 7 of
 * span byte 7 (assumes little-endian span), keeping the real byte count in
 * the remaining bits. Matches Bee's redundancy.EncodeLevel. Only meaningful
 * for level > 0 - callers should not call this for level 0 (NONE).
 */
export declare function encodeRedundancyLevel(span: bigint, level: number): bigint;
/**
 * Decodes a span produced by encodeRedundancyLevel back into the redundancy
 * level (0 if none was encoded) and the real byte count. Matches Bee's
 * redundancy.DecodeSpan/IsLevelEncoded.
 */
export declare function decodeRedundancyLevel(span: bigint): {
    level: number;
    span: bigint;
};
/**
 * Brute-forces the data- and parity-shard count of an intermediate chunk's
 * children from its (already redundancy-level-decoded) span alone, without
 * inspecting the chunk's payload bytes.
 *
 * This works because a redundancy-enabled ChunkSplitter always fills each
 * level to exactly getMaxShards(level, encrypted) data children (except
 * possibly the last, which may be a smaller remainder) before adding parity
 * refs - so the tree shape at any node is fully determined by its span and
 * level. Matches Bee's file.ReferenceCount. Assumes span > 4096 (i.e. this
 * chunk actually has children, not just a leaf payload).
 */
export declare function referenceCount(span: bigint, level: number, encrypted: boolean): {
    dataShardCount: number;
    parityShardCount: number;
};
//# sourceMappingURL=span.d.ts.map