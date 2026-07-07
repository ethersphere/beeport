/**
 * In-memory hot-key session: private scalar lives only in stamp workers.
 *
 * - Derived once per tab from a single wallet `personal_sign` (no extra password).
 * - Main thread holds address, AES key for SOC blobs, and a {@link StampSignerPool}.
 * - After {@link HOT_KEY_IDLE_MS} without user activity, the session is cleared;
 *   the next upload prompts the wallet to sign the canonical message again.
 */

import { keccak256 } from 'viem';
import type { WalletClient } from 'viem';
import { EthAddress, type PrivateKey } from '@ethersphere/bee-js';

import { StampSignerPool } from './FastPresignedStamp';

/** Re-sign with main wallet after this much user inactivity (no extra password). */
export const HOT_KEY_IDLE_MS = 15 * 60 * 1000;

/** Application identifier baked into the canonical derivation message. */
export const HOT_KEY_PURPOSE = 'beeport.app';

const HOT_KEY_DERIVATION_VERSION = 'v1';
const AES_KEY_PURPOSE = 'beeport.issuerState.aes-key.v1';
const utf8 = new TextEncoder();

export function buildCanonicalDerivationMessage(walletAddress: string): string {
  const lowercased = walletAddress.toLowerCase();
  return [
    `Swarm postage stamping key derivation ${HOT_KEY_DERIVATION_VERSION}`,
    `Purpose: ${HOT_KEY_PURPOSE}`,
    `Wallet: ${lowercased}`,
  ].join('\n');
}

/** Public session handle — no private key bytes on the main thread. */
export interface DerivedHotKey {
  readonly address: `0x${string}`;
  readonly issuerAddrBytes: Uint8Array;
  readonly stampPool: StampSignerPool;
  readonly socAesKey: CryptoKey;
  touch(): void;
  signOwnerPayload(data: Uint8Array): Promise<Uint8Array>;
  /** bee-js {@link Stamper} needs a signer object; we only use the public address. */
  stamperSigner(): PrivateKey;
}

class HotKeySession implements DerivedHotKey {
  readonly address: `0x${string}`;
  readonly issuerAddrBytes: Uint8Array;
  readonly stampPool: StampSignerPool;
  readonly socAesKey: CryptoKey;
  private lastActivityAt: number;
  private readonly ownerAddress: EthAddress;

  private constructor(opts: {
    address: `0x${string}`;
    issuerAddrBytes: Uint8Array;
    stampPool: StampSignerPool;
    socAesKey: CryptoKey;
    ownerAddress: EthAddress;
  }) {
    this.address = opts.address;
    this.issuerAddrBytes = opts.issuerAddrBytes;
    this.stampPool = opts.stampPool;
    this.socAesKey = opts.socAesKey;
    this.ownerAddress = opts.ownerAddress;
    this.lastActivityAt = Date.now();
  }

  touch(): void {
    this.lastActivityAt = Date.now();
  }

  isExpired(): boolean {
    return Date.now() - this.lastActivityAt > HOT_KEY_IDLE_MS;
  }

  stamperSigner(): PrivateKey {
    const addr = this.ownerAddress;
    return {
      publicKey: () => ({
        address: () => addr,
      }),
    } as unknown as PrivateKey;
  }

  signOwnerPayload(data: Uint8Array): Promise<Uint8Array> {
    this.touch();
    return this.stampPool.signOwnerPayload(data);
  }

  destroy(): void {
    this.stampPool.terminate();
  }

  static async create(
    walletClient: WalletClient,
    walletAddress: `0x${string}`
  ): Promise<HotKeySession> {
    const message = buildCanonicalDerivationMessage(walletAddress);

    const signature = (await walletClient.signMessage({
      account: walletAddress,
      message,
    })) as `0x${string}`;

    if (!signature || !signature.startsWith('0x')) {
      throw new Error('Wallet returned an invalid signature for hot-key derivation');
    }

    const hotKeyHex = keccak256(signature);
    let privateKey = hexToBytes(hotKeyHex);

    const stampPool = new StampSignerPool(privateKey);
    await stampPool.whenReady();

    const socAesKey = await deriveSocAesKey(privateKey);
    const { address, issuerAddrBytes, ownerAddress } = await derivePublicMaterial(privateKey);

    zeroBytes(privateKey);
    privateKey = new Uint8Array(0);

    return new HotKeySession({
      address,
      issuerAddrBytes,
      stampPool,
      socAesKey,
      ownerAddress,
    });
  }
}

const hotKeyCache = new Map<string, HotKeySession>();
let activityListenersAttached = false;

function attachActivityListeners(): void {
  if (activityListenersAttached || typeof window === 'undefined') return;
  activityListenersAttached = true;
  let lastGlobalTouch = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - lastGlobalTouch < 60_000) return;
    lastGlobalTouch = now;
    for (const session of hotKeyCache.values()) {
      if (!session.isExpired()) session.touch();
    }
  };
  window.addEventListener('mousedown', onActivity);
  window.addEventListener('keydown', onActivity);
  window.addEventListener('touchstart', onActivity, { passive: true });
}

function dropExpiredSessions(): void {
  for (const [key, session] of hotKeyCache) {
    if (session.isExpired()) {
      session.destroy();
      hotKeyCache.delete(key);
    }
  }
}

/**
 * Prompt the wallet (if needed) and return an active hot-key session.
 * Cached per wallet until idle timeout or {@link clearHotKey}.
 */
export async function deriveHotKey(
  walletClient: WalletClient,
  walletAddress: `0x${string}`
): Promise<DerivedHotKey> {
  attachActivityListeners();
  dropExpiredSessions();

  const cacheKey = walletAddress.toLowerCase();
  const cached = hotKeyCache.get(cacheKey);
  if (cached && !cached.isExpired()) {
    cached.touch();
    return cached;
  }
  if (cached) {
    cached.destroy();
    hotKeyCache.delete(cacheKey);
  }

  const session = await HotKeySession.create(walletClient, walletAddress);
  hotKeyCache.set(cacheKey, session);

  try {
    localStorage.setItem(`beeport.hotKeyAddress.${cacheKey}`, session.address);
  } catch {
    // non-fatal
  }

  return session;
}

/** Drop in-memory session for a wallet (workers terminated). */
export function clearHotKey(walletAddress: string): void {
  const key = walletAddress.toLowerCase();
  const session = hotKeyCache.get(key);
  if (session) {
    session.destroy();
    hotKeyCache.delete(key);
  }
}

export function touchHotKeySession(walletAddress: string): void {
  const session = hotKeyCache.get(walletAddress.toLowerCase());
  if (session && !session.isExpired()) session.touch();
}

async function derivePublicMaterial(privateKey: Uint8Array): Promise<{
  address: `0x${string}`;
  issuerAddrBytes: Uint8Array;
  ownerAddress: EthAddress;
}> {
  const secp = await import('@noble/secp256k1');
  const pub = secp.getPublicKey(privateKey, false);
  const { keccak_256 } = await import('@noble/hashes/sha3');
  const hash = keccak_256(pub.slice(1));
  const addressBytes = hash.slice(-20);
  const hex =
    `0x${Array.from(addressBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')}` as `0x${string}`;
  const ownerAddress = new EthAddress(hex);
  return {
    address: hex,
    issuerAddrBytes: ownerAddress.toUint8Array(),
    ownerAddress,
  };
}

async function deriveSocAesKey(privateKey: Uint8Array): Promise<CryptoKey> {
  const purpose = utf8.encode(AES_KEY_PURPOSE);
  const buf = new Uint8Array(purpose.length + privateKey.length);
  buf.set(purpose, 0);
  buf.set(privateKey, purpose.length);
  const raw = await crypto.subtle.digest('SHA-256', buf);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

function hexToBytes(hex: string): Uint8Array {
  const h = hex.startsWith('0x') ? hex.slice(2) : hex;
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function zeroBytes(buf: Uint8Array): void {
  buf.fill(0);
}
