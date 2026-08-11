import { Bytes } from './bytes.cjs';
import { EthAddress } from './eth-address.cjs';
import { PublicKey } from './public-key.cjs';
/**
 * Ethereum's personal_sign convention: sign/recover against
 * keccak256(prefix || keccak256(data)) rather than signing `data` directly.
 * signMessage/recoverPublicKey (crypto/ecdsa.ts) each apply the outer
 * keccak256 themselves, so this only builds the prefix || keccak256(data) part.
 */
export declare function personalSignDigest(data: Uint8Array | string): Uint8Array;
/**
 * A 65-byte ECDSA signature (r || s || v), as produced by {@link PrivateKey.sign}.
 */
export declare class Signature extends Bytes {
    static readonly LENGTH = 65;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Reads a 65-byte Signature out of a larger buffer, starting at `start`.
     */
    static fromSlice(bytes: Uint8Array, start: number): Signature;
    /**
     * Recovers the public key that produced this signature over `digest`,
     * following the same personal_sign convention as {@link PrivateKey.sign}.
     */
    recoverPublicKey(digest: Uint8Array | string): PublicKey;
    /**
     * Returns whether this signature over `digest` was produced by the owner
     * of `expectedAddress`.
     */
    isValid(digest: Uint8Array | string, expectedAddress: EthAddress | Uint8Array | string): boolean;
}
//# sourceMappingURL=signature.d.cts.map