/**
 * Calculates usage of a postage batch based on its utilization, depth, and bucket depth.
 * For smaller depths (up to 20), this may provide less accurate results.
 *
 * @returns A number between 0 and 1 representing the usage of the postage batch.
 */
export declare function getStampUsage(utilization: number, depth: number, bucketDepth: number): number;
/**
 * Calculates the theoretical maximum size of a postage batch based on its depth.
 * For smaller depths (up to 22), this may provide less accurate results.
 *
 * @returns The maximum theoretical size of the postage batch, in bytes.
 */
export declare function getStampTheoreticalBytes(depth: number): number;
/**
 * Calculates the effective size of a postage batch based on its depth.
 * Below depth 17 the effective size is 0.
 *
 * When `encryption` and `erasureCodeLevel` (0=NONE, 1=MEDIUM, 2=STRONG,
 * 3=INSANE, 4=PARANOID) are both given, uses the exact breakpoint table for
 * that combination; otherwise falls back to the encrypted+MEDIUM-optimised
 * default table.
 *
 * @returns The effective size of the postage batch, in bytes.
 */
export declare function getStampEffectiveBytes(depth: number, encryption?: boolean, erasureCodeLevel?: number): number;
/**
 * Returns the effective size (in bytes) for every depth in the supported
 * breakpoint range (17..34), keyed by depth.
 */
export declare function getStampEffectiveBytesBreakpoints(encryption: boolean, erasureCodeLevel?: number): Map<number, number>;
/**
 * Calculates the depth required for a postage batch to achieve the given
 * effective size, in bytes.
 */
export declare function getDepthForSize(size: number, encryption?: boolean, erasureCodeLevel?: number): number;
//# sourceMappingURL=capacity.d.ts.map