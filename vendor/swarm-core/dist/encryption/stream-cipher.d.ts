/**
 * Counter-mode stream cipher: `segmentKey = keccak256(keccak256(key || LE32(initCtr+i)))`,
 * XORed 32 bytes at a time against `data`. Symmetric - the same function
 * both encrypts and decrypts.
 */
export declare function encryptSegments(key: Uint8Array, initCtr: number, data: Uint8Array): Uint8Array;
/**
 * Encrypts (or decrypts) an 8-byte chunk span with `key`.
 */
export declare function encryptSpan(key: Uint8Array, spanBytes: Uint8Array): Uint8Array;
/**
 * Encrypts (or decrypts) a chunk's payload bytes with `key`.
 */
export declare function encryptData(key: Uint8Array, data: Uint8Array): Uint8Array;
/**
 * Decrypts a full encrypted chunk (8-byte span || up to 4096-byte payload)
 * with `key`. encryptSpan/encryptData also serve as their own inverses, so
 * this just applies them to each part.
 */
export declare function decryptChunk(encBytes: Uint8Array, key: Uint8Array): {
    span: bigint;
    data: Uint8Array;
};
//# sourceMappingURL=stream-cipher.d.ts.map