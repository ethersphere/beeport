import { Bytes } from '../bytes/bytes.cjs';
import { EthAddress } from '../bytes/eth-address.cjs';
import { Identifier } from '../bytes/identifier.cjs';
import { Reference } from '../bytes/reference.cjs';
import { Signature } from '../bytes/signature.cjs';
import { Span } from '../bytes/span.cjs';
import type { Chunk } from './cac.cjs';
import { ChunkBuilder } from './splitter.cjs';
/**
 * Ethereum address derived from the fixed replicas private key below -
 * constant across all Bee nodes.
 */
export declare const REPLICAS_OWNER: Uint8Array<ArrayBufferLike>;
/**
 * Single Owner Chunk (SOC) - a chunk type where the address is determined by
 * the owner and an arbitrary identifier. Its integrity is attested by the
 * owner's digital signature rather than by hashing the content directly.
 *
 * - `span` indicates the size of the `payload` in bytes.
 * - `payload` contains the actual data or the body of the chunk.
 * - `data` contains the full chunk data - `identifier`, `signature`, `span` and `payload`.
 * - `address` is the Swarm hash (or reference) of the chunk.
 * - `identifier` is an arbitrary identifier selected by the uploader.
 * - `signature` is the 65-byte (r || s || v) signature of the owner over the identifier and the wrapped chunk's address.
 * - `owner` is the Ethereum address of the chunk owner.
 */
export interface SingleOwnerChunk {
    readonly data: Uint8Array;
    span: Span;
    payload: Bytes;
    address: Reference;
    identifier: Identifier;
    signature: Signature;
    owner: EthAddress;
}
/**
 * SOC address = keccak256(identifier || owner).
 */
export declare function makeSOCAddress(identifier: Identifier | Uint8Array | string, owner: EthAddress | Uint8Array | string): Reference;
/**
 * Wraps a Content Addressed Chunk in a Single Owner Chunk, signed by
 * `privateKey` over the identifier and the wrapped chunk's address.
 */
export declare function makeSingleOwnerChunk(chunk: Pick<Chunk, 'data' | 'span' | 'payload' | 'address'>, identifier: Identifier | Uint8Array | string, privateKey: bigint): SingleOwnerChunk;
/**
 * Unmarshals arbitrary data into a Single Owner Chunk, verifying that the
 * recovered owner's SOC address matches the given address.
 * Throws if the data is not a valid SOC for that address.
 */
export declare function unmarshalSingleOwnerChunk(data: Bytes | Uint8Array, address: Reference | Uint8Array | string): SingleOwnerChunk;
/**
 * Creates all dispersed replica SOC chunks for the given root chunk, signed
 * by the well-known REPLICAS_OWNER key. Returns an empty array when
 * redundancyLevel is 0 (NONE).
 */
export declare function makeReplicas(rootChunk: ChunkBuilder, redundancyLevel: number): Array<{
    address: Reference;
    data: Uint8Array;
}>;
/**
 * Creates dispersed replica SOC chunks for an *encrypted* root chunk: the
 * replica wraps the encrypted span + payload, and identifiers are derived
 * from the encrypted chunk's address rather than the plaintext one.
 */
export declare function makeEncryptedReplicas(rootChunk: ChunkBuilder, key: Uint8Array, redundancyLevel: number): Array<{
    address: Reference;
    data: Uint8Array;
}>;
//# sourceMappingURL=soc.d.cts.map