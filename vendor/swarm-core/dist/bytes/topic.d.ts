import { Bytes } from './bytes.js';
/**
 * A 32-byte feed topic - identifies a feed stream, independent of its owner.
 */
export declare class Topic extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Derives a topic by hashing an arbitrary string with keccak256.
     */
    static fromString(value: string): Topic;
}
//# sourceMappingURL=topic.d.ts.map