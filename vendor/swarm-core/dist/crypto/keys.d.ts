/** The order of the secp256k1 curve's generator point. */
export declare const SECP256K1_N = 115792089237316195423570985008687907852837564279074904382605163141518161494337n;
/**
 * Derives the (uncompressed) public key point for a private key.
 * Throws if the private key is out of the valid `(0, SECP256K1_N)` range.
 */
export declare function privateKeyToPublicKey(privateKey: bigint): [bigint, bigint];
/**
 * Encodes a public key point as a 33-byte compressed key (0x02/0x03 prefix || x).
 */
export declare function compressPublicKey(publicKey: [bigint, bigint]): Uint8Array;
/**
 * Decompresses a 33-byte compressed public key back into its point.
 */
export declare function publicKeyFromCompressed(compressed: Uint8Array): [bigint, bigint];
/**
 * Derives the Ethereum address for a public key point (keccak256 of the
 * uncompressed key, last 20 bytes).
 */
export declare function publicKeyToAddress(publicKey: [bigint, bigint]): Uint8Array;
/**
 * EIP-55 checksum-cases an address's hex encoding (e.g. `0x5aAe...`).
 */
export declare function checksumEncode(addressBytes: Uint8Array): string;
//# sourceMappingURL=keys.d.ts.map