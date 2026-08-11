/**
 * Splits `bytes` into consecutive chunks of `size` bytes. The final chunk is
 * shorter if `bytes.length` isn't a multiple of `size`. Returned chunks are
 * views into `bytes`, not copies.
 */
export declare function partition(bytes: Uint8Array, size: number): Uint8Array[];
/**
 * Byte-wise equality check. `false` if the lengths differ.
 */
export declare function equals(a: Uint8Array, b: Uint8Array): boolean;
/**
 * Returns the longest shared leading run of bytes between `one` and `other`.
 */
export declare function commonPrefix(one: Uint8Array, other: Uint8Array): Uint8Array;
/**
 * Finds the first index at or after `start` where `value` occurs as a
 * contiguous subsequence of `bytes`, or -1 if it doesn't occur.
 */
export declare function indexOf(bytes: Uint8Array, value: Uint8Array, start?: number): number;
/**
 * Concatenates any number of byte arrays into one new array.
 */
export declare function concatBytes(...arrays: Uint8Array[]): Uint8Array;
/**
 * Encodes bytes as a lowercase hex string, with no `0x` prefix.
 */
export declare function uint8ArrayToHex(bytes: Uint8Array): string;
/**
 * Encodes a bigint as a fixed-width 32-byte array.
 */
export declare function numberToUint256(value: bigint, endian: 'LE' | 'BE'): Uint8Array;
/**
 * Decodes a 32-byte array into a bigint.
 */
export declare function uint256ToNumber(bytes: Uint8Array, endian: 'LE' | 'BE'): bigint;
/**
 * Decodes a hex string (with or without a `0x`/`0X` prefix) into bytes.
 */
export declare function hexToUint8Array(hex: string): Uint8Array;
/**
 * Decodes a (padded) base64 string into bytes.
 */
export declare function base64ToUint8Array(base64: string): Uint8Array;
/**
 * Encodes bytes as a padded base64 string.
 */
export declare function uint8ArrayToBase64(bytes: Uint8Array): string;
/**
 * Decodes a (padded) base32 string into bytes.
 */
export declare function base32ToUint8Array(base32: string): Uint8Array;
/**
 * Encodes bytes as a padded base32 string.
 */
export declare function uint8ArrayToBase32(bytes: Uint8Array): string;
/**
 * Encodes bytes as a string of `'0'`/`'1'` characters, 8 per byte.
 */
export declare function uint8ArrayToBinary(bytes: Uint8Array): string;
/**
 * Decodes a string of `'0'`/`'1'` characters (8 per byte) into bytes.
 */
export declare function binaryToUint8Array(binary: string): Uint8Array;
/**
 * Splits `bytes` into consecutive sub-arrays of the given `lengths`, in order.
 */
export declare function sliceBytes(bytes: Uint8Array, lengths: number[]): Uint8Array[];
/**
 * Wraps a single byte value in a 1-byte array.
 */
export declare function numberToUint8(value: number): Uint8Array;
/**
 * Reads the first byte of a 1-byte array as a number.
 */
export declare function uint8ToNumber(bytes: Uint8Array): number;
/**
 * Encodes a number as a fixed-width 2-byte array.
 */
export declare function numberToUint16(value: number, endian: 'LE' | 'BE'): Uint8Array;
/**
 * Decodes a 2-byte array into a number.
 */
export declare function uint16ToNumber(bytes: Uint8Array, endian: 'LE' | 'BE'): number;
/**
 * Encodes a number as a fixed-width 4-byte array.
 */
export declare function numberToUint32(value: number, endian: 'LE' | 'BE'): Uint8Array;
/**
 * Decodes a 4-byte array into a number.
 */
export declare function uint32ToNumber(bytes: Uint8Array, endian: 'LE' | 'BE'): number;
/**
 * Encodes a bigint as a fixed-width 8-byte array.
 */
export declare function numberToUint64(value: bigint, endian: 'LE' | 'BE'): Uint8Array;
/**
 * Decodes an 8-byte array into a bigint.
 */
export declare function uint64ToNumber(bytes: Uint8Array, endian: 'LE' | 'BE'): bigint;
//# sourceMappingURL=encoding.d.cts.map