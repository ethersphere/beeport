/**
 * Typed helpers for Bee gateway endpoints added or extended in Bee v2.8.x.
 *
 * Self-custody batches are foreign-owned from the gateway's perspective, so
 * `GET /stamps/{id}` often 404s. `GET /batches/{id}` indexes batches
 * chain-wide and still returns TTL / depth / owner for any valid batch.
 */

import type { StampInfo } from './types';

/** Parsed `GET /chainstate` (Bee v2.8.1 adds `minimumValidityBlocks`). */
export interface BeeChainState {
  block: bigint;
  chainTip?: bigint;
  currentPrice?: bigint;
  /** Minimum validity period in blocks — use with `currentPrice` for batch cost. */
  minimumValidityBlocks?: number;
}

/** `GET /batches/{batch_id}` — global batch view (works for self-custody). */
export interface BeeGlobalBatch {
  batchID: string;
  value: string;
  start: number;
  owner: string;
  depth: number;
  bucketDepth: number;
  immutable: boolean;
  batchTTL: number;
}

const DEFAULT_FETCH_TIMEOUT_MS = 15_000;

function formatBatchId(batchId: string): string {
  return batchId.startsWith('0x') ? batchId.slice(2) : batchId;
}

function joinBeeUrl(beeApiUrl: string, path: string): string {
  const base = beeApiUrl.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

function parseBigIntField(value: unknown): bigint | undefined {
  if (value === undefined || value === null) return undefined;
  try {
    return BigInt(value as string | number | bigint);
  } catch {
    return undefined;
  }
}

/**
 * Fetch Bee gateway chain state. Returns `null` when the endpoint is missing
 * or unreachable (same semantics as the legacy chainstate probe).
 */
export async function fetchChainState(
  beeApiUrl: string,
  timeoutMs = 5_000
): Promise<BeeChainState | null> {
  if (!beeApiUrl) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(joinBeeUrl(beeApiUrl, '/chainstate'), {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    if (res.status === 401 || res.status === 403 || res.status === 404 || !res.ok) {
      return null;
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = (await res.json()) as Record<string, unknown>;
    } catch {
      return null;
    }

    const block = parseBigIntField(parsed.block);
    if (block === undefined) return null;

    const minimumValidityBlocks =
      typeof parsed.minimumValidityBlocks === 'number'
        ? parsed.minimumValidityBlocks
        : typeof parsed.minimumValidityBlocks === 'string'
          ? Number.parseInt(parsed.minimumValidityBlocks, 10)
          : undefined;

    return {
      block,
      chainTip: parseBigIntField(parsed.chainTip),
      currentPrice: parseBigIntField(parsed.currentPrice),
      minimumValidityBlocks:
        minimumValidityBlocks !== undefined && Number.isFinite(minimumValidityBlocks)
          ? minimumValidityBlocks
          : undefined,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Global batch lookup — available since Bee v2.8.1. Works for batches whose
 * on-chain owner is the user's hot key (self-custody).
 */
export async function fetchGlobalBatch(
  batchId: string,
  beeApiUrl: string,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS
): Promise<BeeGlobalBatch | null> {
  if (!beeApiUrl) return null;

  const id = formatBatchId(batchId);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(joinBeeUrl(beeApiUrl, `/batches/${id}`), {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!res.ok) return null;

    const data = (await res.json()) as Record<string, unknown>;
    const batchID = typeof data.batchID === 'string' ? data.batchID : id;
    const owner = typeof data.owner === 'string' ? data.owner : '';
    const depth = typeof data.depth === 'number' ? data.depth : 0;
    const bucketDepth = typeof data.bucketDepth === 'number' ? data.bucketDepth : 16;
    const batchTTL = typeof data.batchTTL === 'number' ? data.batchTTL : 0;
    const start = typeof data.start === 'number' ? data.start : 0;
    const value =
      typeof data.value === 'string' || typeof data.value === 'number'
        ? String(data.value)
        : '0';

    return {
      batchID,
      value,
      start,
      owner,
      depth,
      bucketDepth,
      immutable: Boolean(data.immutable),
      batchTTL,
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function globalBatchToStampInfo(batch: BeeGlobalBatch): StampInfo {
  return {
    batchID: batch.batchID.startsWith('0x') ? batch.batchID : `0x${batch.batchID}`,
    utilization: 0,
    usable: true,
    depth: batch.depth,
    amount: batch.value,
    bucketDepth: batch.bucketDepth,
    exists: true,
    batchTTL: batch.batchTTL,
  };
}

function normalizeStampResponse(data: Record<string, unknown>): StampInfo {
  const batchID =
    typeof data.batchID === 'string'
      ? data.batchID
      : typeof data.batchId === 'string'
        ? data.batchId
        : '';

  const utilizationRatio =
    typeof data.utilizationRatio === 'number' ? data.utilizationRatio : undefined;

  const utilization =
    typeof data.utilization === 'number'
      ? data.utilization
      : utilizationRatio !== undefined
        ? utilizationRatio * Math.pow(2, ((data.depth as number) ?? 22) - ((data.bucketDepth as number) ?? 16))
        : 0;

  return {
    batchID,
    utilization,
    utilizationRatio,
    usable: Boolean(data.usable ?? true),
    depth: typeof data.depth === 'number' ? data.depth : 0,
    amount: String(data.amount ?? '0'),
    bucketDepth: typeof data.bucketDepth === 'number' ? data.bucketDepth : 16,
    exists: Boolean(data.exists ?? true),
    batchTTL: typeof data.batchTTL === 'number' ? data.batchTTL : 0,
    label: typeof data.label === 'string' ? data.label : undefined,
  };
}

/**
 * Resolve stamp / batch metadata from the gateway.
 *
 * Order: `GET /stamps/{id}` (issuer-owned, includes utilization) then
 * `GET /batches/{id}` (chain-indexed, works for self-custody).
 */
export async function fetchStampBatchInfo(
  batchId: string,
  beeApiUrl: string
): Promise<StampInfo | null> {
  if (!beeApiUrl) return null;

  const id = formatBatchId(batchId);

  try {
    const stampRes = await fetch(joinBeeUrl(beeApiUrl, `/stamps/${id}`), {
      signal: AbortSignal.timeout(DEFAULT_FETCH_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (stampRes.ok) {
      const data = (await stampRes.json()) as Record<string, unknown>;
      return normalizeStampResponse(data);
    }

    if (stampRes.status !== 404) {
      console.warn(`Bee /stamps returned ${stampRes.status} ${stampRes.statusText}`);
    }
  } catch (error) {
    console.warn(`Could not reach Bee /stamps for ${batchId.slice(0, 10)}…:`, error);
  }

  const global = await fetchGlobalBatch(batchId, beeApiUrl);
  if (global) {
    return globalBatchToStampInfo(global);
  }

  return null;
}

/** Headline utilization % — prefers Bee v2.8.1 `utilizationRatio` when present. */
export function stampUtilizationPercent(info: {
  utilization?: number;
  utilizationRatio?: number;
  depth: number;
  bucketDepth?: number;
}): number {
  if (typeof info.utilizationRatio === 'number' && Number.isFinite(info.utilizationRatio)) {
    return Math.min(100, Math.max(0, info.utilizationRatio * 100));
  }
  const bucketDepth = info.bucketDepth ?? 16;
  return ((info.utilization ?? 0) / Math.pow(2, info.depth - bucketDepth)) * 100;
}

/** Parse semver from Bee `/health` for capability gating (e.g. chunk stream). */
export function parseBeeSemver(version: string | undefined): { major: number; minor: number; patch: number } | null {
  if (!version) return null;
  const m = /^(\d+)\.(\d+)\.(\d+)/.exec(version.trim());
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function beeSupportsChunkStream(version: string | undefined): boolean {
  const v = parseBeeSemver(version);
  if (!v) return false;
  return v.major > 2 || (v.major === 2 && v.minor >= 8);
}
