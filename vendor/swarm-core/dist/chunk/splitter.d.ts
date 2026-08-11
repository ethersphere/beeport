import { Reference } from '../bytes/reference.js';
import { Uint8ArrayWriter } from './byte-cursor.js';
/**
 * A chunk (up to 4096 bytes of payload) being filled in by a ChunkSplitter,
 * before it's sealed. Unlike the immutable CAC {@link Chunk}, this is a
 * mutable buffer - only `hash()`/`encryptedHash()`/`build()` finalize it.
 */
export declare class ChunkBuilder {
    span: bigint;
    writer: Uint8ArrayWriter;
    constructor(span?: bigint);
    /**
     * Returns the raw chunk bytes: 8-byte span || 4096-byte payload buffer.
     */
    build(): Uint8Array;
    /**
     * Computes the unencrypted BMT address of this chunk.
     */
    hash(): Reference;
    /**
     * Encrypts this chunk with `key` (generating a random one if omitted) and
     * returns the resulting address alongside the key used.
     */
    encryptedHash(key?: Uint8Array): {
        address: Reference;
        key: Uint8Array;
    };
}
/** A sealed chunk awaiting upload, with its encryption key if encrypted. */
export type ChunkEntry = {
    chunk: ChunkBuilder;
    key?: Uint8Array;
};
/**
 * Splits arbitrary data into a tree of 4096-byte chunks (the inverse of
 * ChunkJoiner), calling `onBatch` with each level's sealed chunks as they
 * fill up - e.g. to upload them, or (via erasure-coding/batch.ts) to add
 * Reed-Solomon parity chunks.
 */
export declare class ChunkSplitter {
    static readonly NOOP: (_: ChunkEntry[]) => Promise<ChunkEntry[]>;
    private refSize;
    private encrypted;
    private maxShards;
    private chunks;
    private counters;
    private pending;
    private onBatch;
    private onIntermediateChunk?;
    private hasParity;
    private pendingEntries;
    /**
     * @param onBatch Called with each level's sealed chunks as a batch fills
     * up; return any parity entries to append as extra references (empty
     * array for no redundancy).
     * @param maxShards Max data-chunk references per intermediate node.
     * Defaults to as many as fit in one 4096-byte node; pass a smaller value
     * (e.g. via erasure-coding's getMaxShards) to leave room for parity refs.
     * @param onIntermediateChunk Called with each intermediate chunk as it's
     * sealed, so callers can tag it (e.g. encoding a redundancy level into its span).
     */
    constructor(onBatch: (batch: ChunkEntry[]) => Promise<ChunkEntry[]>, maxShards?: number, encrypted?: boolean, onIntermediateChunk?: (chunk: ChunkBuilder, hasParity: boolean) => void);
    /**
     * Splits `data` into a chunk tree (no redundancy, no encryption, no
     * upload callback) and returns just its root chunk.
     */
    static root(data: Uint8Array): Promise<ChunkBuilder>;
    /**
     * Splits `data` into an encrypted chunk tree (no upload callback) and
     * returns the root's encrypted address and key.
     */
    static encryptedRoot(data: Uint8Array): Promise<{
        address: Reference;
        key: Uint8Array;
    }>;
    /**
     * Appends more data to the tree, sealing and elevating chunks as needed.
     * `level`/`spanIncrement` are internal - callers building a tree from raw
     * input data should always call this at the default level 0.
     */
    append(data: Uint8Array, level?: number, spanIncrement?: bigint): Promise<void>;
    private elevate;
    private sealParities;
    private flushBatch;
    /**
     * Seals every level and returns the tree's root chunk. `level` is
     * internal - callers should always start at the default level 0.
     */
    finalize(level?: number): Promise<ChunkBuilder>;
}
//# sourceMappingURL=splitter.d.ts.map