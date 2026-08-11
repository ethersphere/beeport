import { Reference } from '../bytes/reference.cjs';
import { ChunkBuilder } from '../chunk/splitter.cjs';
import { Fork } from './fork.cjs';
interface MantarayNodeOptions {
    selfAddress?: Uint8Array | undefined;
    targetAddress?: Uint8Array | undefined;
    obfuscationKey?: Uint8Array;
    metadata?: Record<string, string> | null | undefined;
    path?: Uint8Array | null;
    parent?: MantarayNode | null;
    type?: number | null;
    encrypt?: boolean;
}
/**
 * A node in Swarm's Mantaray trie - the data structure backing manifests
 * (directory listings, website hosting, feed pointers). Each node holds an
 * optional target address (the value at this path) and a set of forks -
 * single-byte-keyed edges to child nodes, each carrying a shared path prefix.
 */
export declare class MantarayNode {
    obfuscationKey: Uint8Array;
    selfAddress: Uint8Array | null;
    targetAddress: Uint8Array;
    metadata: Record<string, string> | undefined | null;
    path: Uint8Array;
    forks: Map<number, Fork>;
    parent: MantarayNode | null;
    type: number | null;
    encrypt: boolean;
    constructor(options?: MantarayNodeOptions);
    /**
     * The full path from the tree's root to this node, concatenating every
     * ancestor's own path segment.
     */
    get fullPath(): Uint8Array;
    /**
     * {@link fullPath} decoded as UTF-8.
     */
    get fullPathString(): string;
    /**
     * Gets the binary representation of the node.
     */
    marshal(): Promise<Uint8Array>;
    /**
     * Unmarshals a MantarayNode from previously marshaled data. Each fork's
     * child node only carries its own `selfAddress` - fetch and unmarshal it
     * (e.g. via `saveRecursively`'s chunk store) to descend further.
     */
    static unmarshalFromData(data: Uint8Array, selfAddress?: Uint8Array): MantarayNode;
    /**
     * Adds a fork to the node.
     */
    addFork(path: string | Uint8Array, reference: Reference | Uint8Array | string, metadata?: Record<string, string> | null): void;
    /**
     * Removes a fork from the node.
     */
    removeFork(path: string | Uint8Array): void;
    /**
     * Calculates the self address of the node.
     */
    calculateSelfAddress(): Promise<Reference>;
    /**
     * Saves the node and its children recursively via the given `onChunk`
     * callback - no network client involved, the caller decides how and where
     * chunks get persisted.
     *
     * Returns the reference to the saved manifest (32 bytes, or 64 bytes -
     * address || key - for an encrypted manifest) and the root chunk, so
     * callers can also create dispersed replicas from it.
     */
    saveRecursively(onChunk: (chunk: ChunkBuilder, key?: Uint8Array) => Promise<void>): Promise<{
        reference: Uint8Array;
        rootChunk: ChunkBuilder;
        encryptionKey?: Uint8Array;
    }>;
    /**
     * Finds a node in the tree by its path.
     */
    find(path: string | Uint8Array): MantarayNode | null;
    /**
     * Finds the closest node in the tree to the given path.
     */
    findClosest(path: string | Uint8Array, current?: Uint8Array): [MantarayNode, Uint8Array];
    /**
     * Returns every node in the tree that has a target address set.
     */
    collect(nodes?: MantarayNode[]): MantarayNode[];
    /**
     * Returns a path -> reference (hex) map of every node in the tree that has
     * a target address set.
     */
    collectAndMap(): Record<string, string>;
    /**
     * Computes this node's type byte (value/edge/path-separator/metadata
     * flags) from its current in-memory state.
     */
    determineType(): number;
}
export {};
//# sourceMappingURL=node.d.cts.map