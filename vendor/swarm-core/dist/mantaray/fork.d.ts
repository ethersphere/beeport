import { Uint8ArrayReader } from '../chunk/byte-cursor.js';
import { MantarayNode } from './node.js';
/**
 * A single edge in a MantarayNode's trie: the shared path `prefix` leading
 * to `node`. Forks are keyed by their prefix's first byte in the parent's
 * `forks` map.
 */
export declare class Fork {
    prefix: Uint8Array;
    node: MantarayNode;
    constructor(prefix: Uint8Array, node: MantarayNode);
    /**
     * Merges two forks that share a path prefix, splitting off a new
     * intermediate node at the point where their prefixes diverge.
     */
    static split(a: Fork, b: Fork): Fork;
    /**
     * Gets the binary representation of the fork (type byte, prefix, self
     * address, and optional metadata).
     */
    marshal(): Uint8Array;
    /**
     * Reads a single fork (and its node's selfAddress/metadata) out of a
     * reader positioned at the start of the fork's bytes.
     */
    static unmarshal(reader: Uint8ArrayReader, addressLength: number): Fork;
}
//# sourceMappingURL=fork.d.ts.map