/**
 * XORs `bytes` against `key`, repeating the key as needed. Symmetric - the
 * same function both encrypts and decrypts. Used for Mantaray's per-node
 * obfuscation key.
 */
export declare function xorCypher(bytes: Uint8Array, key: Uint8Array): Uint8Array;
//# sourceMappingURL=xor-cipher.d.cts.map