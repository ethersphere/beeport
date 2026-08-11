import { Bytes } from './bytes.cjs';
/**
 * A 20-byte Ethereum address.
 */
export declare class EthAddress extends Bytes {
    static readonly LENGTH = 20;
    constructor(bytes: Uint8Array | string | Bytes);
    /**
     * EIP-55 checksum-cased hex representation (e.g. `0x5aAe...`).
     */
    toChecksum(): string;
}
//# sourceMappingURL=eth-address.d.cts.map