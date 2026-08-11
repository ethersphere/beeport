import { Bytes } from './bytes.js';
/**
 * An 8-byte, little-endian span - the byte count prefixing a chunk's payload.
 */
export declare class Span extends Bytes {
    static readonly LENGTH = 8;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Encodes a bigint byte count as an 8-byte, little-endian Span.
     */
    static fromBigInt(value: bigint): Span;
    /**
     * Decodes the span as a bigint byte count.
     */
    toBigInt(): bigint;
    /**
     * Reads an 8-byte Span out of a larger buffer, starting at `start`.
     */
    static fromSlice(bytes: Uint8Array, start: number): Span;
}
//# sourceMappingURL=span.d.ts.map