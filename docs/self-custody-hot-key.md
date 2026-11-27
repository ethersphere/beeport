# Self-custody hot key — how it works

> Living doc for the SWIP self-custody pattern as implemented in Beeport.
> Edit when the design changes.

## TL;DR

When you click **Buy storage** or **Upload** for the first time in a session,
your wallet (MetaMask / Rabby / WalletConnect / …) is asked to sign **one
fixed message**. We hash that signature with `keccak256` and use the result as
a fresh, deterministic **secp256k1 private key** — the **hot key**.

```
hotKey = keccak256( walletSig( CANONICAL_MSG ) )
```

That hot key is what owns the postage batch on-chain (it is the `_owner` arg
of `createBatch`) and is what signs every per-chunk postage stamp before we
POST chunks to a Bee gateway.

The user's wallet **never** signs 250 000 chunks. It only signs the one
canonical message. Everything else is local secp256k1 work in the browser tab.

---

## Why we need a hot key at all

Every chunk uploaded to Swarm carries a 113-byte postage stamp (`batchId`,
bucket, index, timestamp, signature). The signature must come from the
**on-chain owner of the batch**. If we made the user's wallet sign every
chunk, a 1 GB upload would pop ~250 000 MetaMask popups. Unworkable.

The SWIP-prescribed answer is to derive a per-app, per-wallet "hot" signing
key from one wallet signature. That key:

1. is **deterministic** — same wallet + same message ⇒ same key, every time,
   on every device. No persistent state needed.
2. **never leaves the browser tab** — not stored in any backend, not sent to
   any gateway. We only persist the public **address** in localStorage so the
   UI can show "🔑 your hot key is 0x99…" before the wallet is prompted.
3. is **bound** to the wallet. Anyone without the wallet's private key cannot
   produce the signature, therefore cannot derive this hot key.

## The canonical message

Defined in `src/app/components/ClientStamping.ts`:

```text
Swarm postage stamping key derivation v1
Purpose: beeport.app
Wallet: 0x<lowercased-wallet-address>
```

Each line is significant:

- `v1` — version tag. Bump it (and `HOT_KEY_DERIVATION_VERSION` in
  `ClientStamping.ts`) **only** if we deliberately want to invalidate every
  existing self-custody batch's owner key. Don't change casually.
- `Purpose: beeport.app` — domain-scopes the key. Other apps using the same
  SWIP scheme will use a different purpose string and therefore a different
  hot key from the same wallet.
- `Wallet: <addr>` — pins the message to this specific wallet so a user with
  multiple connected wallets gets multiple hot keys.

Wallets that implement RFC-6979 deterministic ECDSA (MetaMask, Rabby, Brave,
Coinbase Wallet, Frame, …) will return **the same signature for the same
message every time**, so the same hot key is reproducible across sessions
and devices for the same wallet. Non-deterministic signers would re-derive a
different key on every prompt — those wallets are not currently supported by
the self-custody flow.

---

## What gets persisted, what doesn't

| Data | Where | Notes |
|---|---|---|
| Hot-key **private scalar** | Stamp **workers only** (RAM) | Main thread never holds the 32-byte key after derivation; see [Wallet security](./wallet-security.md). |
| Hot-key **address** | `localStorage["beeport.hotKeyAddress.<wallet>"]` | Public info. UI display only. |
| Hot-key **session** | In-memory `HotKeySession` | Cleared after **15 min idle** (re-sign canonical message), tab close, or wallet change. |
| SOC **AES key** | Main-thread `CryptoKey` per session | Derived from hot scalar once at unlock; used only for issuer-state blob encrypt/decrypt. |
| Self-custody batch metadata | `localStorage["beeport.selfCustodyBatches.v1"]` | `{ batchId, walletAddress, hotKeyAddress, depth, totalAmount, … }`. Used by the stamp list when Bee can't tell us about foreign-owned batches. |
| Stamper **issuer state** (bucket counters) | `IndexedDB["beeport"].stamperState[batchId]` | One `Uint32Array(65 536)` per batch, stored via structured clone (no JSON round-trip). Critical: when a `(bucket, cnt)` pair is used twice, Bee replaces the older chunk. This state MUST persist across sessions. Migrated automatically on first load from the legacy `localStorage["beeport.stamper.<batchId>"]` key. |
| Per-batch chunk-address dedup set | `IndexedDB["beeport"].stampedAddrs` (composite key `[batchId, addrHex]`, `byBatch` index) | One record per chunk address ever stamped+accepted under the batch. Written incrementally — one tiny `put` per chunk — so re-uploading the same file is cheap and there's no quota pressure. Migrated automatically on first load from the legacy `localStorage["beeport.stamped.<batchId>"]` key. |
| Wallet signature itself | nowhere | Discarded after `keccak256` produces the hot key. |

---

## How a returning user re-uses their hot key

> "I bought stamps yesterday. Today I open Beeport, connect the same wallet,
> and want to upload more files. How does that work?"

1. Page loads, no hot key in RAM yet.
2. UI shows "🔑 Cached hot-key address: 0x99…598EC1 (will be re-derived on
   the next buy or upload)" — this is read from localStorage, just for show.
3. User picks an existing self-custody batch and chooses a file.
4. `handleSelfCustodyUpload` → `ensureHotKey()` → `deriveHotKey()` is called.
5. Wallet pops the **same** canonical message. User signs.
6. Wallet returns the **same** signature → `keccak256` produces the **same**
   hot key.
7. The stamper loads its persisted bucket counters from IndexedDB (migrating legacy `localStorage` keys on first read) and
   resumes signing chunk stamps for the existing `batchId`.

No on-chain interaction is required for this — uploading to an existing
batch is purely a chunk-signing operation done in the browser.

## What the user's wallet itself can / can't do to the batch

Beeport's postage batches are deployed on the canonical Postage Stamp
contract (`GNOSIS_STAMP_ADDRESS`). Three relevant write methods, with
different access controls:

| Method | Effect | Who can call |
|---|---|---|
| `topUp(batchId, amountPerChunk)` | Adds BZZ to the batch, extending TTL. | **Anyone** (the contract just needs the caller to have approved enough BZZ). |
| `increaseDepth(batchId, newDepth)` | "Dilution" — doubles capacity per +1 depth, halves remaining TTL. | **Owner only** (= hot key). |
| `createBatch(_owner, …)` | Creates a new batch with `_owner` as on-chain owner. | Anyone — owner is set explicitly. |

So:

### Top-up of an existing batch
The **user's wallet** calls `topUp(batchId, amountPerChunk)` directly,
paying BZZ from the wallet. **The hot key is not needed for top-up.**
This is what `topUpSelfCustodyBatchViaRegistry()` in `SelfCustodyBatch.ts` does today.

### Dilution (increaseDepth) — currently a real problem ⚠

Only the batch owner (the **hot key**) can call `increaseDepth`. But:

- The hot key has **no xDAI for gas** — we never funded it; the user only
  pays gas from their main wallet.
- The hot key has **no BZZ** either — but `increaseDepth` doesn't take BZZ,
  it just changes a uint8 in storage.

If we want to support dilution from the UI today, we have to give the hot
key gas. Options, in order of how much I'd recommend them:

1. **Just-in-time gas top-up.** Before calling `increaseDepth`, send a tiny
   amount of xDAI (say $0.10) from the user's wallet to the hot-key
   address. Then have the hot key (in-tab) sign and submit the
   `increaseDepth` tx. Cleanest UX, two wallet popups (the xDAI transfer
   and the canonical-message signature; the dilute tx itself is silent).
   Leftover dust stays at the hot key forever — annoying but harmless.
2. **Gnosis Chain meta-tx / paymaster.** EIP-2771 / ERC-4337 entry-point
   sponsoring the hot key. Requires infra. Overkill for v1.
3. **Re-create-and-replicate.** Skip dilution entirely. If a user runs out
   of capacity, prompt them to create a fresh batch and re-upload. Worst
   for the user, simplest for us.

**Currently we don't expose a dilute button in the UI**, so this is a
prospective issue, not a regression. When we wire it up, option 1 is the
path of least resistance.

### Upload more chunks to an existing batch

Pure browser work — see "How a returning user re-uses their hot key" above.
Hot key signs each chunk's stamp, no on-chain tx needed.

---

## Security: who else can use the hot key?

**Only someone in possession of the wallet's private key can re-derive the
hot key**, because:

- ECDSA signing requires the wallet's private key.
- We use `keccak256(signature)` of a fixed message. Without the signature,
  no one can compute the keccak256 input.
- The signature itself is never persisted by Beeport. After `keccak256`
  consumes it we drop the bytes.

So the security of the hot key strictly inherits from the security of the
underlying wallet. A user who keeps their MetaMask seed phrase secure has
exactly the same level of protection on their self-custody batches as on
their ETH/BZZ.

### Things that DO threaten the hot key

1. **A malicious dApp on the same wallet that uses the same purpose
   string.** If another site asks the user to sign the exact same canonical
   message (`Swarm postage stamping key derivation v1\nPurpose:
   beeport.app\nWallet: 0x…`), they will get the same hot key. Mitigations:
   - The wallet displays the message text before signing. Users should
     refuse if "Purpose: beeport.app" appears on a non-Beeport origin.
   - We could (and probably should) encode the origin into the purpose
     string in a future `v2`. Trade-off: doing so per-origin breaks the
     promise that "the same wallet on any Beeport mirror gives the same hot
     key", which we currently rely on.
2. **An attacker with the wallet's private key.** Equivalent to losing the
   wallet — game over for everything, not specific to self-custody.
3. **A compromised browser tab.** A page exploit can read the hot key out
   of memory. Same threat model as any in-tab signing key.

### Things that DON'T threaten the hot key

- Anyone watching on-chain — they can see the hot key's **address** but not
  derive the private key from it (that would require breaking ECDSA).
- The Bee gateway you upload chunks to. Pre-stamped chunks include the
  envelope's signature, not the hot key itself, so the gateway can validate
  but never re-issue stamps. (This is the whole point of the self-custody
  pattern.)
- Other users / wallets connected to the same Beeport tab. Each wallet
  derives its own hot key from its own canonical message.
- Loss of persisted site data (IndexedDB cleared, or storage eviction). The hot key is regenerated on next sign-in. The
  bucket counters, however, are gone — see issuer-state recovery below.

---

## Issuer state — the one thing that's truly local

The hot key is recoverable from the wallet (just sign the canonical message
again). The **issuer state — the bucket counters — is not.** This is the
only piece of self-custody data that is genuinely browser-local and should
be backed up if the user values their batch.

### Why it matters

Each chunk's stamp picks a slot `(bucket, cnt)` inside the batch:

- `bucket` is determined by the chunk address (`addr & ((1<<bucketDepth)-1)`).
- `cnt` is allocated by the issuer (us, in the browser) from a counter that
  starts at 0 and increments per bucket.

Bee enforces a hard rule: **no two stamps for the same `(batchId, bucket,
cnt)` pair may exist.** The check is per-batch and global — every Bee node
in the network rejects a duplicate slot.

If the counters are wiped (incognito mode, clear-site-data, different
browser profile, lost laptop, …) and we then upload a *new* chunk that
lands in a bucket we already used, the stamper will try `cnt = 0` for that
bucket again and Bee will refuse the chunk because slot `(b, 0)` was
already burned by an earlier upload from the previous browser session.

### Can we ask Bee for our issuer state?

**No** — at least not for self-custody batches. The relevant Bee endpoints
are:

| Endpoint | What it returns | Works for self-custody? |
|---|---|---|
| `GET /stamps/<id>/buckets` | per-bucket `cnt` for an **owned** batch | ❌ — `404 "issuer does not exist"` for foreign-owned batches |
| `GET /batches/<id>/buckets` | — | ❌ — endpoint doesn't exist |
| `GET /batches/<id>` | chain-indexed batch summary (TTL, depth, owner) | ✅ — Bee v2.8.1+; works for self-custody batches |
| `GET /batches` | chain-indexed batch list | ✅ — but no per-bucket data |

Bee tracks the counter only on the node that **issued** stamps for the
batch, i.e. the node that owns the batch. For self-custody, *we* are that
issuer — the browser tab — and there's no central place to ask. The data
is fundamentally local to whoever signed the stamps.

### What happens to existing data on a fresh browser

A wrong counter has a worse result than a failed upload. This section explains the result.
A slot is one `(bucket, cnt)` pair. Each stamp uses one slot.

- **A chunk address does not change.** The network derives the address from the BMT hash of the content. It cannot replace chunk `X` with a different chunk `X'`.
- **An upload of the same file succeeds.** The stamper allocates the same slot as the first time. It makes the same stamp. Bee sees a repeat of the first upload.
- **An upload of new content can evict older data.** A browser with an old counter reuses a slot that holds a different chunk.
- **Bee accepts the new stamp when its timestamp is newer.** Bee moves the slot to the new chunk. The older chunk loses its stamp. The network can delete it, and the file that uses it can break.
- **Bee rejects the new stamp when its timestamp is equal or older.** The upload then fails with an overwrite error.

A stale browser makes stamps with new timestamps. Bee accepts them and replaces the older chunks.
A browser without the current issuer state can silently damage older files in the same batch.
Old data is safe only when the issuer state is current.
The app protects the state in two ways. It restores the state from Swarm before each upload. It stops the upload when it cannot find the state, unless this browser created the batch.

### Recovery options (and what's actually shipped)

1. **Encrypted Swarm SOC backup — implemented & default.** The app writes
   the current bucket counters to a Single Owner Chunk (SOC) on Swarm. The
   address of a SOC comes from an identifier and an owner key, not from its
   content. The app writes a backup at three times:

   - after you buy storage (the first backup, with all counters at zero);
   - after each upload;
   - in a sync, when a storage has no backup and this browser bought it or
     has state for it.

   These details apply to each backup:

   - SOC identifier for save number `n` =
     `keccak256("beeport.issuerState" || batchId || u32(n))`. Save 0 has no
     `u32` suffix. The identifier is the same on every browser.
   - Each save writes a new address (`n` grows by one). A node or gateway
     can serve an old copy of a chunk that the app writes twice at one
     address. The app never overwrites a backup.
   - SOC owner     = your hot key — anyone holding the same wallet can
     re-derive the hot key and address the SOC.
   - SOC payload v2 layout (~50 bytes for typical saves):
     - `u8` version (=2)
     - `u8[32]` reference to a chunked, AES-256-GCM encrypted, gzipped
       state blob containing the **pre-save** bucket counters (S₀)
     - `u64` savedAt unix-ms
     - `u32` ciphertext length
     - `u16` delta entry count `N`
     - `N × { u16 bucket, u8 increment }` — exact list of slots consumed
       by the save itself (encrypted-blob chunks + the SOC chunk)
   - AES key       = `SHA-256("beeport.issuerState.aes-key.v1" ||
     hotKeyPrivateKey)`. Without the wallet, no decrypting.

   **Restore is automatic.** Every upload path resolves its starting
   state through `resolveStamperStateForUpload` (`ClientSideUpload.ts`)
   before constructing a Stamper:

   - **No local state** (fresh browser/device): the SOC is fetched,
     decrypted and written into IndexedDB before the first chunk is
     stamped. If the SOC *read fails* (gateway unreachable), the upload
     is **aborted** rather than started from blank counters — only a
     confirmed "no SOC exists" (batch never uploaded to) proceeds blank.
   - **Local state exists**: the app probes for the backup after the
     newest one that this browser knows. The `beeport.socIndex.<batchId>`
     marker stores that number. A missing chunk means no change. A
     chunk that exists means another device uploaded since; the remote
     state is fetched and
     **merged by element-wise max** of the bucket counters — max covers
     every slot index either device allocated, so future stamps can't
     collide with either device's chunks. If the probe itself fails, the
     upload proceeds on local state (local is authoritative for this
     browser's own history).

   **Find the newest backup.** The backups form a numbered chain. The
   app tests the next two numbers after the last known one, at the same
   time. Thus one number that never reached the network does not stop the
   search. If a chunk exists, the app tests numbers that grow by powers of
   two. It then uses a binary search (it halves the range at each step) to
   find the last number that exists. The app reads each miss again in the
   next round. A browser with no saved number reads the last two misses a
   second time before it trusts them. A missing chunk needs about 1 second
   to return a 404. An up-to-date browser sends two requests at the same
   time.

   Bee does not ask a peer (another Bee node) again for one minute after
   the peer did not return a chunk. After about three reads of a missing
   address, no peer is left. Bee then answers `500 read chunk failed`
   instead of 404. The app reads that answer as a miss.

   **Before each save**, the app checks that the next number is free. If
   another device used it, the app merges that backup into its own
   counters (it takes the larger value of each counter). Then it writes
   after it.

   **Sync without an upload.** The sync button (🔄) below the storage list
   syncs every storage. The app also syncs on its own when the hot key
   unlocks, and when the list loads while the hot key is unlocked. For each
   storage, the sync restores the newest backup, merges it, or writes a
   first backup. It writes local state only while it holds the
   per-storage upload lock. Thus it cannot run at the same time as an
   upload of that storage. See `IssuerStateSync.ts`.

   **Failed saves.** The app tries a failed save again after 3 seconds and
   after 10 seconds. If the save still fails, the upload success screen
   shows a warning. Other browsers cannot use the storage until a later
   save works.

   **Upload mechanics:** the encrypted state blob is uploaded as normal CACs
   (`POST /chunks`). The SOC itself must use Bee's SOC API:
   `POST /soc/{owner}/{identifier}?sig={ownerSignatureOverIdAndInnerAddress}`
   with body = **inner CAC bytes only** (`span || payload`), and the
   postage stamp in `swarm-postage-stamp` built over the **SOC address**
   (not the inner CAC address). Posting full SOC wire data to `/chunks`
   makes Bee verify the stamp against the wrong address. See
   [Client-side chunk pipeline](./client-side-chunk-pipeline.md).

   **No drift.** The delta records every slot the save itself touched —
   K encrypted-blob chunks plus the 1 SOC chunk — and we apply it on
   restore, so the recovered state on browser B is bit-for-bit identical
   to IndexedDB on browser A at the moment the save committed.

   v1 SOCs (without delta, written by an earlier build) are still
   readable but leave a small drift on restore: the K + 1 save slots are
   un-tracked, giving ≈ K / 65 536 collision probability per new chunk.
   In practice K ≤ 15 and any retry loop absorbs it. Not worth migrating
   manually — the next successful upload writes a new v2 backup.

2. **Re-upload your existing files first to rebuild state.** Re-stamping
   the same chunk content with the same starting counters reproduces the
   *same* `(bucket, cnt)` allocation, which is the same stamp Bee already
   has — no collision, just a no-op. Useful only if SOC restore is
   unavailable (Bee gateway unreachable, or no backup of the batch
   exists).

3. **Accept some slot burn (only safe for low-fill batches).** Start
   from a blank counter array. New chunks succeed only if their bucket
   wasn't used by the lost session. Rough collision rates for a depth-20
   batch (65 536 buckets, ~1 M chunks capacity):

   | Previously uploaded | Collision rate on a fresh new upload |
   |---|---:|
   | ≤ 50 MB | < 15% |
   | 100 MB | ~33% |
   | 500 MB | ~85% |
   | ≥ 1 GB | effectively 100% |

4. **Abandon the batch.** Treat it as full. Always correct, financially
   wasteful.

The default flow is (1). Only fall back to (2)/(3) if Bee or the SOC are
unavailable. (4) is the worst case.

### Operational rule of thumb

- **Switching browsers/devices between uploads is fine.** The upload
  path auto-restores (or merges) issuer state from the Swarm SOC, so a
  batch used on a laptop yesterday works from a desktop today — same
  wallet, one signature.
- **Do not upload to the same batch from two devices at the same time.**
  Slot indices are allocated sequentially per bucket, so two devices
  stamping concurrently from the same synced state allocate the *same*
  slots and collide. The post-hoc merge fixes the counters for future
  uploads but can't un-collide chunks stamped during the overlap.
- **Do not rely on incognito mode** for the upload step — storage for that profile is wiped on exit.
- **The first backup is written at purchase.** If that write fails, the
  next sync in the browser that bought the storage writes it. Until then,
  another browser does not upload to the storage.

The hot key, by contrast, requires no backup at all because it's
deterministic from the wallet signature (see "How a returning user
re-uses their hot key" above).

---

## Recap, in one paragraph for the next person to read this

The hot key is a per-wallet, per-app secp256k1 key deterministically derived
from a single wallet signature over a fixed canonical message. It owns the
postage batch on chain and signs every chunk's postage stamp locally in the
browser. Only the wallet owner can re-derive it; the gateway never sees it.
For top-ups the user's wallet does the on-chain work directly. For dilution
we'll need to fund the hot key with a sliver of xDAI just-in-time (not yet
implemented). For just uploading more files, the wallet only needs to sign
the canonical message once per session and the rest is browser-side work.

### Browser upload implementation

For how chunks are signed (including optional Web Workers), how `POST /chunks`
and `POST /soc/...` differ, HTTP/2 concurrency caps, and why issuer-state SOC
uses **`uploadSocPresignedFetch`**, see **[Client-side chunk pipeline](./client-side-chunk-pipeline.md)**.

---
