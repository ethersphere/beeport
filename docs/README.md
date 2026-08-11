# Swarm Upload Documentation

Documentation for uploading to Swarm with **Beeport** (self-custody: your browser stamps chunks; the gateway never holds your batch owner key).

## Upload guides

| Guide | When to use |
| ----- | ----------- |
| [Single file](./single-file-upload.md) | One file; optional archive / NFT options |
| [Multiple files](./multiple-file-upload.md) | Many files, separate references |
| [Folder](./folder-upload.md) | Whole directory → one website hash |
| [ZIP file](./zip-file-upload.md) | `.zip` compressed or extracted |
| [Webpage](./webpage-upload.md) | Static sites (`index.html`, headers) |
| [NFT collection](./nft-collection-upload.md) | ZIP with `images/` + `json/` |
| [Archive processing](./archive-processing.md) | Shared index/filter/TAR behaviour |

## Self-custody & technical

| Guide | Topic |
| ----- | ----- |
| [Self-custody hot key](./self-custody-hot-key.md) | Key derivation, issuer state, SOC backup |
| [Wallet security](./wallet-security.md) | Session model, idle lock, threat comparison |
| [Client-side chunk pipeline](./client-side-chunk-pipeline.md) | `/chunks` vs `/soc`, workers, HTTP/2 caps |
| [Chunk transport: HTTP vs WebSocket](./chunk-transport-http-vs-websocket.md) | When Auto picks each, pool tuning, measured trade-offs |
| [Postage stamps](./postage-stamps.md) | Capacity, depth, economics |
| [File formats & limits](./file-formats-limits.md) | Size caps from app constants |
| [Architecture](./architecture.md) | Stack, integrations, data flow |
| [Self-hosting Bee gateway](./self-hosting-bee-gateway.md) | nginx, CORS, presigned stamps |
| [Troubleshooting](./troubleshooting.md) | Common failures |
| [Roadmap / TODO](./TODO.md) | Known follow-ups |

## ENS

- [ENS integration](./ens-integration.md) — user guide
- [ENS technical reference](./ens-technical-reference.md) — implementation notes

## SWIP drafts (proposals)

- [Client-side postage stamping](./swip-XXXX-client-side-postage-stamping.md) — pattern Beeport ships today (mode α)
- [Streamed postage stamp signing](./swip-XXXX-streamed-postage-stamp-signing.md) — gateway-assisted signing (not implemented here)

## Developer / ops

- [Testing expiry migration](./testing-expiry-migration.md) — upload-history expiry date migration QA

## Quick start

1. Connect an EVM wallet (any chain; bridge to xBZZ on Gnosis via LI.FI when buying storage).
2. Sign the **one-time hot-key derivation message** when prompted.
3. Create or select a postage stamp.
4. Pick an upload mode from the table above and upload.
5. Open `https://bzz.link/bzz/<reference>/` or link ENS from History.

## External links

- [Swarm docs](https://docs.ethswarm.org/)
- [Bee API](https://docs.ethswarm.org/docs/api-reference/)
- [bzz.link](https://bzz.link/)
