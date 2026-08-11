import { Bytes } from './bytes.cjs';
/**
 * A 32-byte postage batch identifier.
 */
export declare class BatchId extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
}
//# sourceMappingURL=batch-id.d.cts.map