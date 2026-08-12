# Postage stamps

Postage stamps are prepaid storage credits on Swarm: you buy a batch with a certain capacity (depth) and duration (amount), then spend its slots stamping chunks as you upload. When the batch's value runs out, the network may garbage-collect the data.

## Key properties

- **Batch ID** — 64-char hex identifier, permanent, case-insensitive.
- **Depth** — determines capacity (see table below).
- **Amount** — xBZZ paid per chunk-block; determines duration (TTL).
- **Utilization** — how full the batch is. Self-custody batches track this locally per bucket; see [Self-custody hot key](./self-custody-hot-key.md).

## Buying a stamp in Beeport

1. Connect a wallet with tokens on any supported EVM chain — LI.FI bridges to xBZZ on Gnosis automatically.
2. Choose capacity and duration, confirm the transaction on Gnosis Chain.
3. Freshly created batches take a short while (usually seconds, occasionally a couple of minutes) before the gateway indexes them; the app waits and probes automatically.

The batch is created with your **hot key** as on-chain owner (self-custody) — the gateway cannot stamp on your behalf.

## Depth and capacity

Approximate **guaranteed** capacity labels in the Beeport UI (from `STORAGE_OPTIONS` in `src/app/components/constants.ts`):

| Depth | Label (approx.) |
| ----- | --------------- |
| 19 | 110 MB |
| 20 | 680 MB |
| 21 | 2.6 GB |
| 22 | 7.7 GB |
| 23 | 20 GB |
| 24 | 47 GB |
| 25 | 105 GB |
| 26 | 227 GB |
| 27 | 476 GB |

Each +1 depth doubles slot space but dilutes TTL for the same amount. A batch has 65,536 buckets; a single hot bucket can fill before overall utilization looks high ("Bucket is full") — deeper batches make this less likely.

## Top-up

Existing batches can be topped up (more duration) from the stamp list. Files stay under the same batch ID and references never change.

## Choosing a size

Pick a depth comfortably above your planned upload volume — bucket distribution is hash-driven, so running a batch near 100% invites per-bucket saturation. For a one-off 5 GB upload, depth 22–23 is a sensible floor.

## Sharing a batch

Anyone holding the batch owner key can stamp against the batch. In Beeport's self-custody model that key is derived from your wallet — sharing the batch ID alone does **not** let others upload with it.

## Troubleshooting

| Symptom | Cause / fix |
| ------- | ----------- |
| "Stamp not ready yet" right after buying | Gateway still indexing the batch — the app retries automatically; see [Troubleshooting](./troubleshooting.md) |
| "Bucket is full" with low MB used | Per-bucket saturation — deeper stamp, top up, or reset local state if counters look wrong |
| Stamp missing from list | Reconnect the same wallet; batches are on-chain and rediscovered from the wallet |
| Expired stamp | Data may be garbage-collected; buy a new batch and re-upload |

---

_Related: [Single file upload](./single-file-upload.md) · [Self-custody hot key](./self-custody-hot-key.md) · [File formats & limits](./file-formats-limits.md)_
