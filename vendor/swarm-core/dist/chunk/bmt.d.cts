import { Reference } from '../bytes/reference.cjs';
/**
 * Calculate a Binary Merkle Tree hash for a chunk.
 *
 * The BMT chunk address is the hash of the 8-byte span and the root hash of
 * a binary Merkle tree (BMT) built on the 32-byte segments of the payload.
 *
 * If the payload is less than 4096 bytes, it's treated as if padded with
 * zeros up to 4096 bytes for the purposes of this calculation.
 *
 * @param chunkContent Chunk data, including the span and the payload.
 */
export declare function calculateChunkAddress(chunkContent: Uint8Array): Reference;
//# sourceMappingURL=bmt.d.cts.map