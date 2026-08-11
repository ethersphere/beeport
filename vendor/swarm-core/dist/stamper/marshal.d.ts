import { BatchId } from '../bytes/batch-id.js';
import { Bytes } from '../bytes/bytes.js';
import { EthAddress } from '../bytes/eth-address.js';
import { Signature } from '../bytes/signature.js';
/** A postage stamp's fields, as produced by signing (e.g. via `stamp()`). */
export interface Envelope {
    issuer: EthAddress;
    index: Uint8Array;
    timestamp: Uint8Array;
    signature: Signature;
}
/** An {@link Envelope} with its batch ID, ready to marshal. */
export interface EnvelopeWithBatchId extends Envelope {
    batchId: BatchId;
}
/**
 * Marshals a postage stamp's fields into the wire format Bee expects:
 * `batchId (32) || index (8) || timestamp (8) || signature (65)`.
 */
export declare function marshalStamp(signature: Uint8Array, batchId: Uint8Array, timestamp: Uint8Array, index: Uint8Array): Bytes;
/**
 * Same as {@link marshalStamp}, taking the fields from an EnvelopeWithBatchId.
 */
export declare function convertEnvelopeToMarshaledStamp(envelope: EnvelopeWithBatchId): Bytes;
//# sourceMappingURL=marshal.d.ts.map