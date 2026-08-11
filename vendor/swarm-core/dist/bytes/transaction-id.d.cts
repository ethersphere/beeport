import { Bytes } from './bytes.cjs';
/**
 * A 32-byte blockchain transaction hash.
 */
export declare class TransactionId extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
}
//# sourceMappingURL=transaction-id.d.cts.map