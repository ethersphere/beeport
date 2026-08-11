import { Bytes } from './bytes.cjs';
/**
 * A Swarm chunk/manifest reference: 32 bytes for an unencrypted address, or
 * 64 bytes (address || decryption key) for an encrypted one. Also accepts a
 * `"bah5..."` CID string, decoding it to the underlying reference bytes.
 */
export declare class Reference extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Encodes the reference as a `"bah5..."` CID string of the given type.
     */
    toCid(type: 'feed' | 'manifest'): string;
    /**
     * Returns whether `value` parses as a valid Reference (raw hex, 32/64-byte
     * bytes, or a `"bah5..."` CID string).
     */
    static isValid(value: string): boolean;
}
//# sourceMappingURL=reference.d.cts.map