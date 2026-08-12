# ENS integration guide

Link an ENS domain to your Swarm-hosted content so it's reachable at `yourname.eth` (ENS-aware browsers) or `yourname.eth.limo` / `yourname.eth.link` (gateways) instead of a raw reference hash.

Implementation notes: [ENS technical reference](./ens-technical-reference.md).

## Prerequisites

1. **An ENS domain** you own (`.eth`, imported DNS domain, or subdomain), with a **resolver set**.
2. **ETH for gas** — content-hash updates are Ethereum mainnet transactions (~50–100k gas).
3. **Wallet on Ethereum mainnet** (chain ID 1). The UI prompts you to switch if you're on another chain.

## Linking a domain

1. Upload your content (website uploads work best — see [Webpage upload](./webpage-upload.md)).
2. Open the **History** tab and click the **ENS** button on the upload.
3. Pick a domain from the owned-domains dropdown (discovered automatically) or enter one manually. Ownership is verified on-chain before the transaction is offered.
4. Click **Set Content Hash**, confirm in your wallet, wait for confirmation.
5. Visit `yourname.eth.limo`.

The Swarm reference is encoded to an ENSIP-7 content hash automatically.

To update content later: upload the new version and set the content hash again — the domain then points at the new reference.

## Registering a new domain

The ENS modal also supports `.eth` registration:

1. Switch to **Register Domain** mode, enter a name, check availability and the 1-year price.
2. Complete the two-step commit–reveal flow (commit, wait 60 seconds, register).
3. Switch back to **Set Content Hash** mode and link your content.

## Troubleshooting

| Error | Fix |
| ----- | --- |
| "Please switch to Ethereum Mainnet" | ENS is mainnet-only; switch networks in the wallet |
| "Domain is not registered or configured in ENS" | Check spelling; verify at [app.ens.domains](https://app.ens.domains); register it first if free |
| "You do not own this domain" | Wrong wallet or wrong name — the error shows the current owner's address |
| "Domain has no resolver set" | Set the Public Resolver in the [ENS Manager](https://app.ens.domains), wait for confirmation, retry |
| "Domain has no owner" / expired | Renew the domain (it may be in a grace period) |
| Transaction failed | Enough ETH for gas? Correct network? Retry when gas is lower |
| Content not loading | Verify the reference works at `bzz.link` first; give gateways a few minutes |

## Notes

- Static sites, SPAs, docs, and media galleries all work; make sure the upload has an `index.html` (folder upload or **Serve uncompressed**).
- Multiple domains can point at the same reference.
- Domain ↔ reference associations are remembered in your browser's upload history.
