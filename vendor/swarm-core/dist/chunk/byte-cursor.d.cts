/**
 * Sequentially reads chunks of bytes out of a buffer, tracking position.
 */
export declare class Uint8ArrayReader {
    cursor: number;
    buffer: Uint8Array;
    constructor(buffer: Uint8Array);
    /**
     * Reads (a view into) the next `size` bytes and advances the cursor.
     */
    read(size: number): Uint8Array;
    /**
     * Returns the number of unread bytes remaining.
     */
    max(): number;
}
/**
 * Sequentially writes bytes (read from a Uint8ArrayReader) into a buffer,
 * tracking position.
 */
export declare class Uint8ArrayWriter {
    cursor: number;
    buffer: Uint8Array;
    constructor(buffer: Uint8Array);
    /**
     * Copies as many bytes as fit from `reader` into the buffer at the
     * current cursor, advancing both. Returns the number of bytes written.
     */
    write(reader: Uint8ArrayReader): number;
    /**
     * Returns the number of unwritten bytes remaining.
     */
    max(): number;
}
//# sourceMappingURL=byte-cursor.d.cts.map