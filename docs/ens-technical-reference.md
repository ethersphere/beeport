# ENS integration — technical reference

Developer-oriented notes for the ENS modal and contract wiring. **User workflows and troubleshooting:** [ENS integration guide](./ens-integration.md).

## Components

```
ENSIntegration.tsx          — modal (set content hash + register domain)
ENSDomainDropdown.tsx       — searchable owned-domain list
UploadHistorySection.tsx    — ENS button on website uploads
```

## Contracts & libraries

| Piece | Role |
| ----- | ---- |
| ENS Registry | Ownership checks |
| Public Resolver | `setContenthash` / `contenthash` |
| BaseRegistrar, RegistrarController | `.eth` registration (commit–reveal) |
| NameWrapper | Wrapped domains |
| ENS subgraph | Domain discovery |
| wagmi + viem | Reads, writes, mainnet switching |

## Content hash encoding

ENSIP-7 Swarm content hash: `0xe40101fa011b20` + swarm reference (see encoder in `ENSIntegration.tsx`).

## Network

ENS writes require **Ethereum mainnet (chain ID 1)**. The UI prompts to switch when on another chain.

## Ownership checks

Before `setContenthash`: registry owner, resolver presence, NameWrapper/controller paths for subdomains and wrapped names.

## Integration points

- ENS action from upload history (website-type records).
- Domain ↔ reference association stored in upload history `localStorage`.
- Gas: user wallet pays mainnet tx fees.

## Status

Feature-complete for set-contenthash, registration, discovery, and validation as shipped in `ENSIntegration.tsx`.

---

- [ENS integration guide](./ens-integration.md) — end-user documentation
- [Architecture](./architecture.md) — overall project layout
