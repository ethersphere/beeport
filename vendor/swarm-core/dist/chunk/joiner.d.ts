/**
 * Reconstructs the original data behind a chunk tree (as produced by
 * ChunkSplitter), fetching chunks on demand via a caller-supplied callback.
 */
export declare class ChunkJoiner {
    private refSize;
    private encrypted;
    private fetch;
    private onData;
    constructor(fetch: (address: Uint8Array) => Promise<Uint8Array>, onData: (data: Uint8Array) => Promise<void>, encrypted?: boolean);
    /**
     * Fetches and reconstructs the full data behind an unencrypted chunk tree.
     */
    static collect(address: Uint8Array, fetch: (address: Uint8Array) => Promise<Uint8Array>): Promise<Uint8Array>;
    /**
     * Fetches and reconstructs the full data behind an encrypted chunk tree,
     * given the root's decryption key.
     */
    static collectEncrypted(address: Uint8Array, key: Uint8Array, fetch: (address: Uint8Array) => Promise<Uint8Array>): Promise<Uint8Array>;
    /**
     * Fetches the chunk at `address` and recursively descends into its
     * children (skipping any parity references), emitting leaf payloads to
     * `onData` in order as they're reached.
     */
    join(address: Uint8Array, key?: Uint8Array): Promise<void>;
}
//# sourceMappingURL=joiner.d.ts.map