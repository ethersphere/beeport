import { Bytes } from '../bytes/bytes.js';
import { Identifier } from '../bytes/identifier.js';
import { PrivateKey } from '../bytes/private-key.js';
import { Reference } from '../bytes/reference.js';
import { Span } from '../bytes/span.js';
import { SingleOwnerChunk } from './soc.js';
/** Smallest payload a Content Addressed Chunk can hold, in bytes. */
export declare const MIN_PAYLOAD_SIZE = 1;
/** Largest payload a Content Addressed Chunk can hold, in bytes. */
export declare const MAX_PAYLOAD_SIZE = 4096;
/**
 * Content Addressed Chunk (CAC) - the immutable building block of Swarm,
 * holding at most 4096 bytes of payload.
 *
 * - `span` indicates the size of the `payload` in bytes.
 * - `payload` contains the actual data or the body of the chunk.
 * - `data` contains the full chunk data - `span` and `payload`.
 * - `address` is the Swarm hash (or reference) of the chunk.
 *
 * The `toSingleOwnerChunk` method allows converting the CAC into a Single Owner Chunk (SOC).
 */
export interface Chunk {
    readonly data: Uint8Array;
    span: Span;
    payload: Bytes;
    address: Reference;
    /**
     * Converts this CAC into a Single Owner Chunk (SOC), signed by `privateKey`
     * over `identifier` and this chunk's address.
     */
    toSingleOwnerChunk: (identifier: Identifier | Uint8Array | string, privateKey: PrivateKey | Uint8Array | string) => SingleOwnerChunk;
}
/**
 * Builds a Content Addressed Chunk from a payload (at most 4096 bytes),
 * computing its BMT address. `span` defaults to the payload's own length -
 * pass it explicitly when wrapping a larger, already-spanned subtree.
 */
export declare function makeContentAddressedChunk(rawPayload: Bytes | Uint8Array | string, span?: Span | bigint): Chunk;
/**
 * Parses raw chunk bytes (8-byte span || payload) into a Chunk, recomputing
 * its address.
 */
export declare function unmarshalContentAddressedChunk(data: Bytes | Uint8Array): Chunk;
//# sourceMappingURL=cac.d.ts.map