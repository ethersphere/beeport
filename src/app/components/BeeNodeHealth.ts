/**
 * Lightweight liveness probe for the Bee gateway shown on the Upload page.
 *
 * Why this exists:
 *   Self-custody upload silently dies a hundred different ways when the
 *   gateway is unhealthy — chunks 5xx, the manifest GET 502s, etc. The
 *   user sees a frozen progress bar and assumes the app is broken. A
 *   30-second `/health` poll lets us detect "node is down / wrong URL /
 *   syncing" up-front and (a) show a clear message, (b) disable the
 *   Upload button so the user doesn't burn stamp slots on requests that
 *   will never land.
 *
 * The probe uses a raw `fetch` (not `bee.getHealth()`) so we can pin a
 * tight 5-second timeout via AbortController; bee-js falls back to axios
 * which has no default timeout and would happily hang for 60 s+ on a
 * stuck gateway, defeating the whole "fast feedback" point.
 */

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Result of a single `/health` probe.
 *
 *   - `unknown`     — no probe has completed yet (initial)
 *   - `checking`    — a probe is in flight; UI should show a subtle spinner
 *   - `ok`          — node returned `{status:'ok'}` within the timeout
 *   - `unreachable` — fetch failed (network error, CORS, DNS, connection refused, timeout)
 *   - `unhealthy`   — node responded but with a non-2xx status, or `{status}` ≠ ok
 */
export type BeeHealthStatus = 'unknown' | 'checking' | 'ok' | 'unreachable' | 'unhealthy';

export interface BeeHealthState {
  status: BeeHealthStatus;
  /** Human-readable diagnostic shown in the banner. */
  message?: string;
  /** Bee node version, when the probe surfaced one. Useful in the banner. */
  version?: string;
  /** Wall-clock timestamp of the most recent completed probe. */
  lastChecked?: number;
}

/**
 * Maximum wall-clock time we'll wait for a single `/health` request before
 * giving up. The endpoint is trivially cheap on a healthy node — it's a
 * static JSON literal — so anything beyond a few seconds means "the gateway
 * is sick, stop pretending".
 */
const PROBE_TIMEOUT_MS = 5_000;

/**
 * How often we re-probe while the upload UI is open. Long enough that we
 * don't add noticeable load to a public gateway; short enough that the user
 * sees the banner clear within a polling cycle once the node recovers.
 */
const POLL_INTERVAL_MS = 30_000;

/**
 * Run a single `/health` probe. Resolves with a `BeeHealthState` describing
 * the outcome — never throws.
 *
 * Network errors, CORS rejections, DNS failures and AbortController timeouts
 * all collapse into `'unreachable'`; HTTP-level rejections (5xx, 503 from a
 * still-syncing node) map to `'unhealthy'` so the banner can distinguish
 * "your URL is wrong" from "the node is up but unhappy".
 */
export async function probeBeeNodeHealth(beeApiUrl: string): Promise<BeeHealthState> {
  if (!beeApiUrl) {
    return {
      status: 'unreachable',
      message: 'No Bee gateway URL is configured.',
      lastChecked: Date.now(),
    };
  }

  const url = `${beeApiUrl.replace(/\/+$/, '')}/health`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'GET',
      signal: controller.signal,
      // `cache: 'no-store'` so transient outages aren't masked by a stale
      // SW or browser-cache hit. Health is by definition not cacheable.
      cache: 'no-store',
    });

    if (!res.ok) {
      return {
        status: 'unhealthy',
        message: `Bee gateway responded with HTTP ${res.status} ${res.statusText || ''}`.trim(),
        lastChecked: Date.now(),
      };
    }

    // The standard Bee /health response is `{status:'ok', version, apiVersion}`.
    // We tolerate gateways that don't return JSON (e.g. plain "OK") by
    // treating any 2xx as healthy in that fallback case.
    let parsed: { status?: string; version?: string } | null = null;
    try {
      parsed = (await res.json()) as { status?: string; version?: string };
    } catch {
      return { status: 'ok', lastChecked: Date.now() };
    }

    const reportedStatus = (parsed?.status ?? '').toLowerCase();
    if (reportedStatus && reportedStatus !== 'ok') {
      return {
        status: 'unhealthy',
        message: `Bee node reports status: "${parsed!.status}"`,
        version: parsed?.version,
        lastChecked: Date.now(),
      };
    }

    return {
      status: 'ok',
      version: parsed?.version,
      lastChecked: Date.now(),
    };
  } catch (err) {
    const aborted = (err as Error)?.name === 'AbortError';
    return {
      status: 'unreachable',
      message: aborted
        ? `No response from the Bee gateway within ${PROBE_TIMEOUT_MS / 1000}s.`
        : `Cannot reach the Bee gateway: ${(err as Error)?.message ?? 'unknown error'}`,
      lastChecked: Date.now(),
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

export interface UseBeeNodeHealthResult {
  state: BeeHealthState;
  /**
   * True while a probe is in flight. Tracked separately from
   * `state.status === 'checking'` so we don't have to clobber a known
   * `'unhealthy' | 'unreachable'` state during a re-probe — the banner
   * stays visible while the spinner on the Retry button spins.
   */
  isProbing: boolean;
  /** Force an immediate re-probe. Safe to call from a button onClick. */
  refresh: () => void;
}

/**
 * React hook: probes `/health` once on mount, then every {@link POLL_INTERVAL_MS}
 * while `enabled` is true. Re-probes when `beeApiUrl` changes. Cancels in-flight
 * probes on unmount / dependency change so we don't `setState` after unmount.
 *
 * @param beeApiUrl Bee gateway base URL (no trailing `/health`).
 * @param enabled   When false, no polling happens and the state stays at the
 *                  most-recent value. Pass `false` while the upload UI is
 *                  hidden so we don't ping a node the user can't see.
 */
export function useBeeNodeHealth(
  beeApiUrl: string,
  enabled: boolean = true
): UseBeeNodeHealthResult {
  const [state, setState] = useState<BeeHealthState>({ status: 'unknown' });
  const [isProbing, setIsProbing] = useState(false);
  // Increments every time we kick off a new probe; the in-flight probe
  // checks this on resolution and bails if a newer probe has been started
  // (or if the component unmounted). Cheap stand-in for full AbortController
  // wiring across the hook.
  const probeIdRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const probe = useCallback(async () => {
    if (!beeApiUrl) return;
    const myId = ++probeIdRef.current;
    setIsProbing(true);
    setState(prev => ({
      ...prev,
      status: prev.status === 'unknown' ? 'checking' : prev.status,
    }));
    const result = await probeBeeNodeHealth(beeApiUrl);
    if (!mountedRef.current || probeIdRef.current !== myId) return;
    setState(result);
    setIsProbing(false);
  }, [beeApiUrl]);

  useEffect(() => {
    if (!enabled) return;
    probe();
    const id = setInterval(probe, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [probe, enabled]);

  return { state, isProbing, refresh: probe };
}
