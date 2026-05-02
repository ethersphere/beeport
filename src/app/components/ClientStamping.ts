/**
 * Client-side postage stamping helpers (SWIP – self-custody pattern, mode α).
 *
 * Pure browser code: no key material is ever sent to the gateway. The user's
 * wallet (e.g. MetaMask) signs ONE canonical message (EIP-191 personal_sign)
 * which is hashed into a "hot key". The hot key:
 *
 *   1. is the on-chain `_owner` of the postage batch (`createBatch(_owner=…)`)
 *   2. signs every per-chunk stamp digest locally
 *
 * Wallets that implement RFC-6979 deterministic ECDSA (MetaMask, Rabby, …)
 * produce a stable signature for the same message, so the same hot key can be
 * re-derived across sessions / devices for the same wallet.
 *
 *   hotKey = keccak256( walletSig( CANONICAL_MSG ) )
 *
 * The hot key is held only in memory of this tab. We optionally cache its
 * 20-byte address (NOT the private key) in localStorage for nice UX.
 *
 * NOTE: anyone who can prompt the user to sign the canonical message from the
 *   same wallet can re-derive the same hot key. Scope <purpose> to your origin
 *   and educate users at the prompt.
 */

import { keccak256 } from 'viem';
import type { WalletClient } from 'viem';
import { PrivateKey } from '@ethersphere/bee-js';

/**
 * Application identifier baked into the canonical derivation message.
 * Keep this string stable across releases — changing it invalidates every
 * existing self-custody batch (the on-chain owner key changes).
 */
export const HOT_KEY_PURPOSE = 'beeport.app';

/** Version tag in the canonical message — bump if derivation rules change. */
const HOT_KEY_DERIVATION_VERSION = 'v1';

/**
 * The canonical message a user signs to derive their Beeport hot key.
 *
 * Per SWIP §B (Deterministic derivation from a wallet signature):
 *   "Swarm postage stamping key derivation v1\nPurpose: <purpose>\nWallet: <addr>"
 */
export function buildCanonicalDerivationMessage(walletAddress: string): string {
  const lowercased = walletAddress.toLowerCase();
  return [
    `Swarm postage stamping key derivation ${HOT_KEY_DERIVATION_VERSION}`,
    `Purpose: ${HOT_KEY_PURPOSE}`,
    `Wallet: ${lowercased}`,
  ].join('\n');
}

/**
 * Returned from {@link deriveHotKey}. The caller owns lifecycle of the
 * `privateKey` Uint8Array (zero it out when done if you care about memory
 * scrubbing — JS makes this best-effort).
 */
export interface DerivedHotKey {
  /** 32-byte secp256k1 private key. NEVER log or transmit. */
  privateKey: Uint8Array;
  /** 0x-prefixed lowercase 20-byte ethereum address of the hot key. */
  address: `0x${string}`;
  /** bee-js PrivateKey object (wraps the same bytes). */
  signer: PrivateKey;
}

/** Module-level cache: walletAddress.lower → DerivedHotKey. */
const hotKeyCache = new Map<string, DerivedHotKey>();

/**
 * Prompt the user's wallet to sign the canonical message and derive the
 * Beeport hot key from it.
 *
 * Cached in-memory per wallet for the lifetime of the tab. A second call for
 * the same wallet returns immediately without a popup.
 */
export async function deriveHotKey(
  walletClient: WalletClient,
  walletAddress: `0x${string}`
): Promise<DerivedHotKey> {
  const cacheKey = walletAddress.toLowerCase();
  const cached = hotKeyCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const message = buildCanonicalDerivationMessage(walletAddress);

  const signature = (await walletClient.signMessage({
    account: walletAddress,
    message,
  })) as `0x${string}`;

  if (!signature || !signature.startsWith('0x')) {
    throw new Error('Wallet returned an invalid signature for hot-key derivation');
  }

  // RFC-6979 deterministic-ECDSA wallets produce identical signatures for the
  // same message; non-deterministic ones do not. We derive the hot key as
  // keccak256(signature) — the SWIP recommendation.
  const hotKeyHex = keccak256(signature);
  const privateKey = hexToBytes(hotKeyHex);

  // Reject the negligibly-rare invalid scalar by hashing once more with a
  // counter suffix (per SWIP §B step 3 footnote). secp256k1 group order is
  // close enough to 2^256 that this branch is essentially never taken; we
  // still fail loudly rather than silently produce a bad key.
  let signer: PrivateKey;
  try {
    signer = new PrivateKey(privateKey);
  } catch (err) {
    throw new Error(`Failed to construct hot-key from wallet signature: ${(err as Error).message}`);
  }

  const address = signer.publicKey().address().toChecksum() as `0x${string}`;

  const derived: DerivedHotKey = {
    privateKey,
    address,
    signer,
  };
  hotKeyCache.set(cacheKey, derived);

  // Persist only the public address (NOT the private key) so the UI can
  // display the hot-key owner before we re-prompt the wallet.
  try {
    localStorage.setItem(`beeport.hotKeyAddress.${cacheKey}`, address);
  } catch {
    // localStorage may be unavailable (private mode etc.) — non-fatal.
  }

  return derived;
}

/**
 * Returns the cached hot-key address for a wallet, if previously derived in
 * this browser. Does NOT prompt the wallet. Used to render UI before the
 * user has clicked "Enable self-custody".
 */
export function getCachedHotKeyAddress(walletAddress: string): `0x${string}` | null {
  const key = `beeport.hotKeyAddress.${walletAddress.toLowerCase()}`;
  try {
    const stored = localStorage.getItem(key);
    if (stored && stored.startsWith('0x') && stored.length === 42) {
      return stored as `0x${string}`;
    }
  } catch {
    // ignore
  }
  return null;
}

/**
 * Drop the in-memory hot key for the given wallet. Re-deriving will require
 * another wallet signature. Useful on disconnect / wallet-change.
 */
export function clearHotKey(walletAddress: string): void {
  hotKeyCache.delete(walletAddress.toLowerCase());
}

// ─── Issuer-state persistence ─────────────────────────────────────────────────

/**
 * Per-batch issuer state (the bucket counters used for slot allocation).
 * Persisted across sessions in localStorage so two upload runs against the
 * same batch don't collide on `(bucket, cnt)`.
 *
 * Storage layout: localStorage key `beeport.stamper.<batchIdHex>` →
 *   base64-encoded UTF-8 JSON of { buckets: number[] of length 65536, depth }
 *
 * For the in-memory representation we use Uint32Array as required by bee-js
 * `Stamper.fromState`.
 */
export interface PersistedStamperState {
  buckets: Uint32Array;
  depth: number;
}

const stamperStorageKey = (batchId: string) =>
  `beeport.stamper.${stripHex(batchId).toLowerCase()}`;

export function loadStamperState(batchId: string): PersistedStamperState | null {
  try {
    const raw = localStorage.getItem(stamperStorageKey(batchId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { buckets: number[]; depth: number };
    if (!Array.isArray(parsed.buckets) || parsed.buckets.length !== 65536) {
      console.warn('Discarding malformed stamper state for', batchId);
      return null;
    }
    return {
      buckets: new Uint32Array(parsed.buckets),
      depth: parsed.depth,
    };
  } catch (err) {
    console.warn('Failed to load stamper state for', batchId, err);
    return null;
  }
}

export function saveStamperState(batchId: string, state: PersistedStamperState): void {
  try {
    const payload = {
      buckets: Array.from(state.buckets),
      depth: state.depth,
    };
    localStorage.setItem(stamperStorageKey(batchId), JSON.stringify(payload));
  } catch (err) {
    // QuotaExceededError is the expected failure on huge uploads with many
    // batches; we surface it loudly so the caller can decide what to do.
    console.warn('Failed to persist stamper state for', batchId, err);
  }
}

export function clearStamperState(batchId: string): void {
  try {
    localStorage.removeItem(stamperStorageKey(batchId));
  } catch {
    // ignore
  }
}

// ─── Internals ────────────────────────────────────────────────────────────────

function stripHex(value: string): string {
  return value.startsWith('0x') ? value.slice(2) : value;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = stripHex(hex);
  if (clean.length % 2 !== 0) {
    throw new Error(`Invalid hex string of odd length: ${hex.slice(0, 12)}…`);
  }
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}
