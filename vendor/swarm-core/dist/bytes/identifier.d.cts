import { Bytes } from './bytes.cjs';
/**
 * A 32-byte feed/SOC identifier - an arbitrary value selected by the uploader
 * that, together with the owner's address, determines a single-owner chunk's address.
 */
export declare class Identifier extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * Derives an identifier by hashing an arbitrary string with keccak256.
     */
    static fromString(value: string): Identifier;
}
//# sourceMappingURL=identifier.d.cts.map