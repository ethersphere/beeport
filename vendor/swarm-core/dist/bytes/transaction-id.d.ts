import { Bytes } from './bytes.js';
/**
 * A 32-byte blockchain transaction hash.
 */
export declare class TransactionId extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
}
//# sourceMappingURL=transaction-id.d.ts.map