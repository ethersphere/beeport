/**
 * Signs keccak256(message) with the given private key, using @noble/curves'
 * constant-time secp256k1 implementation. Returns [r, s, v] with v as
 * Ethereum's 27/28 recovery-id convention.
 */
export declare function signMessage(message: Uint8Array, privateKey: bigint): [bigint, bigint, 27n | 28n];
/**
 * Signs a raw 32-byte hash directly (no keccak256 applied), otherwise
 * identical to {@link signMessage}.
 */
export declare function signHash(hash: bigint, privateKey: bigint): [bigint, bigint, 27n | 28n];
/**
 * Recovers the public key point that produced a [r, s, v] signature over keccak256(message).
 */
export declare function recoverPublicKey(message: Uint8Array, r: bigint, s: bigint, v: 27n | 28n): [bigint, bigint];
/**
 * Verifies that [r, s] is a valid signature over keccak256(message) by the given public key.
 */
export declare function verifySignature(message: Uint8Array, publicKey: [bigint, bigint], r: bigint, s: bigint): boolean;
//# sourceMappingURL=ecdsa.d.ts.map