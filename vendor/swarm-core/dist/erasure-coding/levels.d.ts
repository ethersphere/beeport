/**
 * Returns the number of Reed-Solomon parity shards Bee would add for the
 * given redundancy level and data-shard count.
 */
export declare function getParities(level: number, shards: number, encrypted: boolean): number;
/**
 * Returns the max number of data shards per batch for a given redundancy
 * level. Matches Bee's Level.GetMaxShards() and Level.GetMaxEncShards().
 */
export declare function getMaxShards(level: number, encrypted: boolean): number;
/**
 * Returns an approximate multiplier for the storage overhead of uploading
 * `chunks` data shards at the given redundancy level: use it to estimate how
 * many extra chunks will be stored (chunks * overhead) for that upload.
 *
 * Computed directly from getParities' exact tables above rather than a
 * separate estimation table - bee-js's own redundancy.ts had a second,
 * independent set of tables for this that turned out to be a rougher
 * approximation of the same data (one threshold short per level), not a
 * genuinely different computation.
 */
export declare function approximateOverheadForRedundancyLevel(chunks: number, level: number, encrypted: boolean): number;
/** Descriptive stats for a redundancy level, as returned by getRedundancyStat(s). */
export interface RedundancyStat {
    label: string;
    value: number;
    errorTolerance: number;
}
/**
 * Returns descriptive stats (label, level, expected error tolerance) for
 * every redundancy level above NONE.
 */
export declare function getRedundancyStats(): {
    medium: RedundancyStat;
    strong: RedundancyStat;
    insane: RedundancyStat;
    paranoid: RedundancyStat;
};
/**
 * Looks up a single redundancy level's stats by name ('medium'/'strong'/
 * 'insane'/'paranoid', case-insensitive) or by its numeric level (1-4).
 */
export declare function getRedundancyStat(level: string | number): RedundancyStat;
//# sourceMappingURL=levels.d.ts.map