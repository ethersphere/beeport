/**
 * Wait for a Bee gateway's chain-sync to catch up past a target block.
 *
 * Why this exists:
 *   For self-custody batches (SWIP mode α) the gateway is **not** the issuer
 *   — it only validates the pre-built `presignedStamper` stamp the browser
 *   attaches to each chunk. That validation requires the gateway's local
 *   `batchstore` to know about the batch; the batchstore is fed by Bee's
 *   on-chain listener (a poll of the upstream `PostageStamp` contract on
 *   Gnosis). So the only "is the stamp ready" question that matters in the
 *   new model is **"has the gateway's chain listener seen the createBatch
 *   block yet?"** — typically a single Gnosis poll-cycle (~5 s) but
 *   occasionally tens of seconds on a backed-up RPC tier.
 *
 *   This helper polls Bee's `GET /chainstate` endpoint and resolves once
 *   `block >= targetBlockNumber`. If the gateway doesn't expose the endpoint
 *   (some operators gate it behind admin auth) we resolve `'unknown'` and
 *   the caller falls back to the optimistic "let the first chunk POST be
 *   the real check" behaviour we shipped before this helper existed.
 *
 *   No equivalent of the legacy custodial `usable: true` flag exists for
 *   self-custody batches: `/stamps/<id>` always 404s because the issuer
 *   key is in the browser, not the node. This is the closest we get.
 */

/** Outcome of {@link waitForGatewayBatchSync}. */
export type GatewayBatchSyncResult =
  /** Gateway's chain-sync block is at or past the target — safe to upload. */
  | 'synced'
  /**
   * Gateway either doesn't expose `/chainstate` or returned a non-OK status
   * we can't interpret (401/403/404/CORS). Caller should proceed optimistically
   * — the first chunk POST will surface a real error if the batch isn't
   * indexed yet.
   */
  | 'unknown'
  /**
   * Polling deadline elapsed before the gateway caught up. Caller may still
   * choose to proceed (uploads might succeed mid-flight) or surface a
   * "gateway is far behind chain" warning.
   */
  | 'timeout';

export interface WaitForGatewayBatchSyncOptions {
  /** Total wall-clock budget for the wait. Defaults to 90 s. */
  timeoutMs?: number;
  /** Interval between consecutive `/chainstate` probes. Defaults to 4 s. */
  pollMs?: number;
  /** Per-probe HTTP timeout. Defaults to 5 s. */
  probeTimeoutMs?: number;
  /**
   * Optional cancellation signal. Once aborted, the wait rejects with
   * `Error('aborted')` so the caller can distinguish user-cancel from
   * timeout.
   */
  signal?: AbortSignal;
  /**
   * Status callback invoked on each completed probe. Useful for plumbing
   * "Gateway still indexing… (block 1 234 600 / 1 234 612)" messages into
   * the upload UI.
   */
  onStatus?: (info: GatewayBatchSyncStatus) => void;
}

export interface GatewayBatchSyncStatus {
  /** Most recently observed gateway chain-sync block, or `null` if unknown. */
  gatewayBlock: bigint | null;
  /** Block number we're waiting to reach. */
  targetBlock: bigint;
  /** Number of completed probes so far (≥ 1). */
  attempts: number;
  /** Wall-clock ms since the wait began. */
  elapsedMs: number;
}

/** Default polling cadence — chosen to match Gnosis's ~5 s block time. */
const DEFAULT_POLL_INTERVAL_MS = 4_000;
/** Default total budget. Chosen to comfortably absorb a stuck RPC poll cycle. */
const DEFAULT_TIMEOUT_MS = 90_000;
/** Default per-probe timeout. `/chainstate` is cheap on a healthy node. */
const DEFAULT_PROBE_TIMEOUT_MS = 5_000;

/**
 * Single GET against the gateway's `/chainstate` endpoint.
 *
 * Resolves with the parsed `block` height when the endpoint is reachable and
 * returns valid JSON, `null` when the endpoint is unavailable / unparseable
 * (the caller should treat that as "I cannot answer this question, fall back
 * to optimistic mode"), and rejects only on programmer error — network
 * failures and timeouts collapse into `null` so a single bad probe doesn't
 * abort the whole wait loop.
 */
async function probeChainstate(
  beeApiUrl: string,
  probeTimeoutMs: number
): Promise<bigint | null> {
  const url = `${beeApiUrl.replace(/\/+$/, '')}/chainstate`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), probeTimeoutMs);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      cache: 'no-store',
    });

    // Authentication / not-exposed / endpoint-missing — caller falls back.
    if (res.status === 401 || res.status === 403 || res.status === 404) {
      return null;
    }
    if (!res.ok) return null;

    let parsed: { block?: number | string } | null = null;
    try {
      parsed = (await res.json()) as { block?: number | string };
    } catch {
      return null;
    }

    if (parsed?.block === undefined || parsed.block === null) return null;
    try {
      return BigInt(parsed.block);
    } catch {
      return null;
    }
  } catch {
    // AbortError, network blip, DNS — treat as transient, let the loop retry.
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Wait until the Bee gateway at `beeApiUrl` has chain-synced past
 * `targetBlockNumber`. Resolves with `'synced'` on success.
 *
 * Polls `GET /chainstate` until either:
 *   - `block >= targetBlockNumber` → `'synced'`
 *   - The gateway clearly doesn't expose the endpoint (consecutive null probes
 *     in fast succession on first contact) → `'unknown'`
 *   - The total budget elapses → `'timeout'`
 *
 * Never throws on its own; the only rejection path is `Error('aborted')` when
 * the caller's `AbortSignal` fires.
 */
export async function waitForGatewayBatchSync(
  beeApiUrl: string,
  targetBlockNumber: bigint,
  options: WaitForGatewayBatchSyncOptions = {}
): Promise<GatewayBatchSyncResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    pollMs = DEFAULT_POLL_INTERVAL_MS,
    probeTimeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
    signal,
    onStatus,
  } = options;

  if (!beeApiUrl) return 'unknown';
  if (targetBlockNumber <= 0n) return 'synced';

  const startedAt = Date.now();
  const deadline = startedAt + Math.max(timeoutMs, pollMs);
  let attempts = 0;
  // Consecutive null probes at the start strongly suggest the endpoint is
  // not exposed by this gateway. We bail to `'unknown'` after this threshold
  // so callers don't sit in a 90 s loop polling a 404 — the endpoint either
  // works or it doesn't.
  let leadingNullProbes = 0;
  const NULL_PROBE_BAILOUT = 2;

  // Cooperative cancellation: a single `await sleepAbortable` is the only
  // place we block, so respecting `signal` everywhere reduces to checking
  // it before each probe and at the start of every sleep.
  const bailIfAborted = () => {
    if (signal?.aborted) throw new Error('aborted');
  };

  while (true) {
    bailIfAborted();
    attempts++;
    const gatewayBlock = await probeChainstate(beeApiUrl, probeTimeoutMs);
    onStatus?.({
      gatewayBlock,
      targetBlock: targetBlockNumber,
      attempts,
      elapsedMs: Date.now() - startedAt,
    });

    if (gatewayBlock !== null) {
      if (gatewayBlock >= targetBlockNumber) return 'synced';
      leadingNullProbes = 0;
    } else {
      leadingNullProbes++;
      if (leadingNullProbes >= NULL_PROBE_BAILOUT && attempts === leadingNullProbes) {
        // Endpoint never returned a usable answer — gateway likely doesn't
        // expose it. Hand control back to the caller's fallback path.
        return 'unknown';
      }
    }

    if (Date.now() >= deadline) return 'timeout';

    bailIfAborted();
    await sleepAbortable(pollMs, signal);
  }
}

/** `setTimeout` Promise wrapper that respects an external `AbortSignal`. */
function sleepAbortable(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timeoutId = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timeoutId);
      signal?.removeEventListener('abort', onAbort);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
