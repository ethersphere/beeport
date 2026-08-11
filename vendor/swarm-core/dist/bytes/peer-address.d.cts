import { Bytes } from './bytes.cjs';
/**
 * A 32-byte Swarm overlay (peer) address.
 */
export declare class PeerAddress extends Bytes {
    static readonly LENGTH = 32;
    constructor(bytes: Uint8Array | string | Bytes);
}
//# sourceMappingURL=peer-address.d.cts.map