import { Bytes } from './bytes.js';
import { PublicKey } from './public-key.js';
import { Signature } from './signature.js';
/**
 * A 32-byte secp256k1 private key.
 */
export declare class PrivateKey extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Derives the corresponding (uncompressed) public key.
     */
    publicKey(): PublicKey;
    /**
     * Signs `data` following Ethereum's personal_sign convention (signs
     * keccak256("\x19Ethereum Signed Message:\n32" || keccak256(data))).
     */
    sign(data: Uint8Array | string): Signature;
    /**
     * Decodes the private key as a bigint scalar, for use in ECDSA operations.
     */
    toBigInt(): bigint;
}
//# sourceMappingURL=private-key.d.ts.map