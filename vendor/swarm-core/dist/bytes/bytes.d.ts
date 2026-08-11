/**
 * Base wrapper around a byte array, accepting a Uint8Array, ArrayBuffer, hex
 * string, or another Bytes instance, with an optional length check.
 */
export declare class Bytes {
    protected readonly bytes: Uint8Array;
    readonly length: number;
    /**
     * @param byteLength If given, throws unless the resulting length matches
     * (or, for an array, is one of) the expected length(s).
     */
    constructor(bytes: Uint8Array | ArrayBuffer | string | Bytes, byteLength?: number | number[]);
    /**
     * Hashes `bytes` with keccak256 and wraps the 32-byte digest.
     */
    static keccak256(bytes: Uint8Array | ArrayBuffer | string | Bytes): Bytes;
    /**
     * Wraps the UTF-8 encoding of a string.
     */
    static fromUtf8(utf8: string): Bytes;
    /**
     * Wraps a slice of `bytes` starting at `start`, running to the end unless
     * `length` is given.
     */
    static fromSlice(bytes: Uint8Array, start: number, length?: number): Bytes;
    /**
     * Returns a copy of the bytes from `index` to the end.
     */
    offset(index: number): Uint8Array;
    /**
     * Returns a copy of the underlying bytes.
     */
    toUint8Array(): Uint8Array;
    /**
     * Encodes as a lowercase hex string, with no `0x` prefix.
     */
    toHex(): string;
    /**
     * Encodes as a padded base64 string.
     */
    toBase64(): string;
    /**
     * Encodes as a padded base32 string.
     */
    toBase32(): string;
    /**
     * Same as {@link toHex}.
     */
    toString(): string;
    /**
     * Decodes the bytes as UTF-8 text.
     */
    toUtf8(): string;
    /**
     * Decodes the bytes as UTF-8 JSON.
     */
    toJSON(): unknown;
    /**
     * Byte-wise equality against another Bytes instance, raw bytes, or hex string.
     */
    equals(other: Bytes | Uint8Array | string): boolean;
    /**
     * Human-readable representation, used by debuggers/loggers. Same as {@link toHex}.
     */
    represent(): string;
}
//# sourceMappingURL=bytes.d.ts.map