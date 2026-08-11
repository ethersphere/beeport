import { Bytes } from './bytes.js';
import { EthAddress } from './eth-address.js';
/**
 * A secp256k1 public key, stored uncompressed (64 bytes: x || y). Also
 * accepts a 33-byte compressed key, decompressing it in the constructor.
 */
export declare class PublicKey extends Bytes {
    static readonly LENGTH = 64;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Derives the corresponding Ethereum address (keccak256 of the
     * uncompressed key, last 20 bytes).
     */
    address(): EthAddress;
    /**
     * Encodes as a 33-byte compressed key (0x02/0x03 prefix || x).
     */
    toCompressedUint8Array(): Uint8Array;
    /**
     * Hex encoding of {@link toCompressedUint8Array}.
     */
    toCompressedHex(): string;
}
//# sourceMappingURL=public-key.d.ts.map