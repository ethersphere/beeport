# Wallet security — self-custody hot key

How Beeport derives, stores, and uses the postage **hot key**, and how that compares to a normal wallet extension (MetaMask) or a dedicated Swarm wallet (BeeWallet).

See also: [Self-custody hot key](./self-custody-hot-key.md), [Client-side chunk pipeline](./client-side-chunk-pipeline.md), implementation in `src/app/components/HotKeySession.ts`.

---

## Two keys, two jobs

| Role | Key | Where it lives | Used for |
| --- | --- | --- | --- |
| **Main wallet (cold)** | User’s MetaMask / Rabby / WalletConnect key | Wallet extension vault | Connect, `createBatch`, BZZ approve, `topUp`, bridge txs |
| **Hot key (derived)** | `keccak256(walletSig(canonical message))` | Stamp **workers only** (main thread never holds the 32-byte scalar) | Owns batch on-chain; signs every postage stamp + SOC owner attestation |

Derivation message (stable — do not change casually):

```text
Swarm postage stamping key derivation v1
Purpose: beeport.app
Wallet: 0x<lowercased-wallet-address>
```

One wallet `personal_sign` per active session (see idle timeout below). No separate Beeport password.

---

## What we ship today (security controls)

| Control | Behaviour |
| --- | --- |
| **No hot key on disk** | Private scalar is never written to `localStorage` / IndexedDB. Only the public hot-key address is cached for UI. |
| **Worker-only private key** | After derivation, the scalar is copied into `StampSignerPool` workers; main-thread buffers are zeroed. Signing (stamps + SOC owner sig) goes through the pool. |
| **15-minute idle lock** | After **15 minutes without user activity** (mouse / keyboard / touch, throttled), the session is cleared and workers terminated. Next upload/buy prompts the **same canonical wallet message** again — not a new password. |
| **Wallet change** | Switching accounts calls `clearHotKey()` and terminates workers. |
| **Gateway never sees key** | Bee receives pre-built 113-byte stamps; `RecoverBatchOwner` checks them against the on-chain batch owner. |
| **SOC AES key** | Derived once per session (`SHA-256(purpose \|\| hotKeyScalar)`) and kept as a `CryptoKey` on the main thread for encrypt/decrypt of issuer-state blobs — not the secp256k1 scalar itself. |

### Hard limit (honest)

While a session is **active**, the hot key must exist in worker memory to sign. **JavaScript cannot hide that from XSS or malware on an unlocked machine.** Encryption without a user-chosen password only helps **at-rest** artifacts; it does not upgrade the fundamental class to “extension vault + per-action popup.”

---

## Comparison tables

### Main wallet vs Beeport hot key

| Topic | Main wallet (MetaMask etc.) | Beeport derived hot key |
| --- | --- | --- |
| **Wallet type** | Software key in browser extension | Software key derived in **web app**, held in **workers** |
| **Key at rest (disk)** | Password-encrypted vault in extension storage | **Not stored** — only public address on disk |
| **Vault crypto** | PBKDF2/scrypt + symmetric encryption (wallet-dependent) | **None for scalar** — session unlock = wallet `personal_sign` |
| **While active** | Decrypted in extension when unlocked | Scalar in stamp workers; main thread has address + AES `CryptoKey` |
| **Session persistence** | Stays unlocked until user locks / auto-lock | Stays derived until **15 min idle**, tab close, or wallet change |
| **Unlock** | Wallet password once per wallet session | **One wallet signature** per hot-key session |
| **Auto-lock** | Wallet setting (optional) | **15 min idle → re-sign canonical message** (no extra password) |
| **Explicit lock** | Wallet “Lock” | Disconnect wallet / close tab / idle timeout |
| **Approve before sign** | Yes — each tx + derivation message | **No for stamping** once session is active |
| **Password per action** | No (while wallet unlocked) | No |
| **Random sites can trigger** | Yes via `window.ethereum` | Only if user signs the **exact same canonical message** elsewhere |
| **Offline attack** | Encrypted vault can be password-guessed | Scalar not on disk; attacker needs wallet vault or live session |
| **Unlocked + XSS / malware** | Wallet txs usually still need popup | **Batch stamping power** until session ends or slots exhausted |
| **Close UI = key gone?** | Wallet still unlocked | Hot key **gone from workers**; wallet may still be unlocked |
| **On-chain power** | Pays gas, creates batch, tops up | **Batch owner** — `increaseDepth` (needs hot-key gas; not in UI yet) |
| **Fundamental class** | Hot software wallet (extension) | **Hot derived signing key in web app** |

### MetaMask vs BeeWallet vs Beeport (summary)

| Topic | MetaMask (hot) | BeeWallet (hot) | Beeport hot key |
| --- | --- | --- | --- |
| **Wallet type** | Extension | Extension | Web app + workers |
| **Key at rest** | Encrypted vault | PBKDF2 + AES-GCM vault | Scalar **not on disk** |
| **Unlock** | Password / biometrics | Password per session | Wallet `personal_sign` (canonical message) |
| **Auto-lock** | User setting | Default 15 min idle | **15 min idle → wallet re-sign** |
| **Per stamp / chunk approve** | N/A | Yes (upload flows) | **No** (by design — throughput) |
| **Websites can request sigs** | Yes (`window.ethereum`) | No dApp bridge | Only via **same canonical message** on another origin |
| **Gateway holds batch owner key** | N/A | No (local) | **No** (self-custody) |
| **Fundamental class** | Hot extension wallet | Hot extension wallet | Hot **session-derived** web key |

### Self-custody vs custodial gateway

| | Beeport self-custody | Custodial Bee gateway |
| --- | --- | --- |
| **Who can stamp** | Client with hot key | Gateway operator |
| **Trust operator for key** | Low | High |
| **Compromised Beeport tab** | Attacker can stamp until session/slots run out | Does not get operator’s gateway key |
| **Compromised gateway** | Sees traffic, not owner key | May stamp as users |
| **Edge nginx** | Path allowlist + rate limits (transport hardening) | Same — does not replace cryptographic stamp checks |

---

## Stamp cryptography (why forgeries fail)

Each postage stamp signs Bee’s `ToSignDigest(chunkAddress, batchId, index, timestamp)` (EIP-191-style path). Bee runs `RecoverBatchOwner` and checks:

- signature recovers to **on-chain batch owner** (hot-key address);
- bucket / index match the chunk address and batch depth.

Stamps are bound to a **specific chunk address and slot** — they cannot be replayed on other content. The weakness is **obtaining the hot key**, not breaking stamp math.

SOC uploads use `POST /soc/{owner}/{identifier}?sig=…` with postage stamped over the **SOC address** (`keccak256(identifier \|\| owner)`), not the inner CAC address. See [Client-side chunk pipeline](./client-side-chunk-pipeline.md).

---

## Threats and mitigations

| Threat | Mitigation / note |
| --- | --- |
| Malicious site asks user to sign **same canonical message** | User reads wallet prompt (`Purpose: beeport.app`); refuse off-site. Future `v2` could bind origin (orphans existing batches). |
| Attacker has wallet seed | Full wallet compromise — not specific to Beeport. |
| XSS in Beeport tab while session active | Can use hot key until idle timeout or tab close — same class as any in-tab secret. Workers reduce main-thread exposure, not eliminate risk. |
| On-chain observer | Sees hot-key **address** only; cannot derive private key. |
| Bee gateway | Validates stamps; never receives private key. |
| Lost IndexedDB issuer state | Hot key recoverable via wallet re-sign; bucket counters restored from SOC backup when available. |

---

## Bottom line

- **Main wallet** = standard extension hot-wallet security (user-approved txs).
- **Hot key** = **hotter** for bulk uploads: no vault password, no per-stamp popup, full batch stamping for an active session.
- **Still better than custodial** for trust: the gateway never holds the batch owner key.
- **Idle lock** = wallet re-sign after 15 minutes without activity — **not** a Beeport password; same approval type as first unlock.
- **Worker-only scalar** = best-effort hardening in a browser; not a substitute for extension-grade vaults or hardware keys.
