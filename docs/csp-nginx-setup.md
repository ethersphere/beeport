# Content-Security-Policy for Nginx

## Quick Setup

Add these lines to your Nginx configuration (`/etc/nginx/sites-available/swarming.site`):

### 1. Add CSP Header (inside server block, after `index index.html;`)

```nginx
# Security Headers
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://mtm.swarm.foundation https://app.formbricks.com https://unpkg.com https://*.walletconnect.com https://*.walletconnect.org; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.walletconnect.com https://*.walletconnect.org https://ethswarm.org https://www.ethswarm.org https://bzz.link https://swarming.site https://*.githubusercontent.com https://avatars.githubusercontent.com https://raw.githubusercontent.com; font-src 'self' data:; connect-src 'self' https://mtm.swarm.foundation https://app.formbricks.com https://api.relay.link https://gateway.thegraph.com https://swarming.site https://bzz.link https://rpc.gnosischain.com https://gnosis-mainnet.public.blastapi.io https://gnosis.drpc.org https://eth.llamarpc.com https://ethereum.publicnode.com https://cloudflare-eth.com https://rpc.ankr.com https://1rpc.io https://*.infura.io https://*.alchemy.com https://*.quicknode.pro https://*.walletconnect.com https://*.walletconnect.org https://relay.walletconnect.com https://relay.walletconnect.org https://*.coinbase.com https://*.web3modal.com wss://relay.walletconnect.com wss://relay.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org; frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://verify.walletconnect.org https://*.coinbase.com https://app.formbricks.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### 2. Test and Reload

```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 3. Verify

```bash
curl -I https://swarming.site | grep -i content-security-policy
```

## 3rd Party Domains Whitelisted

### Analytics & Feedback
- **`https://mtm.swarm.foundation`** - Matomo analytics
- **`https://app.formbricks.com`** - Formbricks feedback widget

### Blockchain & Web3
- **`https://api.relay.link`** - Relay API for cross-chain swaps
- **`https://gateway.thegraph.com`** - The Graph for ENS subgraph queries
- **`https://*.walletconnect.com`** - WalletConnect protocol
- **`https://*.walletconnect.org`** - WalletConnect services
- **`wss://relay.walletconnect.com`** - WalletConnect WebSocket
- **`https://*.coinbase.com`** - Coinbase Wallet
- **`https://*.web3modal.com`** - Web3Modal

### RPC Providers (Blockchain Nodes)
- **`https://rpc.gnosischain.com`** - Gnosis Chain RPC
- **`https://gnosis-mainnet.public.blastapi.io`** - Gnosis Chain (BlastAPI)
- **`https://gnosis.drpc.org`** - Gnosis Chain (dRPC)
- **`https://eth.llamarpc.com`** - Ethereum RPC (Llama)
- **`https://ethereum.publicnode.com`** - Ethereum public node
- **`https://cloudflare-eth.com`** - Ethereum (Cloudflare)
- **`https://rpc.ankr.com`** - Multi-chain RPC (Ankr)
- **`https://1rpc.io`** - Multi-chain RPC (1RPC)
- **`https://*.infura.io`** - Infura RPC services
- **`https://*.alchemy.com`** - Alchemy RPC services
- **`https://*.quicknode.pro`** - QuickNode RPC services

### Storage & Content
- **`https://swarming.site`** - Swarm Bee node API
- **`https://bzz.link`** - Swarm gateway
- **`https://ethswarm.org`** - Swarm website/images
- **`https://*.githubusercontent.com`** - GitHub raw content

### Other
- **`https://unpkg.com`** - NPM package CDN
- **`blob:`** - Browser-generated blob URLs
- **`data:`** - Data URIs for inline content

## CSP Directives Explained

| Directive | What It Controls | Why Unsafe Flags Needed |
|-----------|------------------|-------------------------|
| `script-src` | JavaScript execution | `'unsafe-eval'` - Web3 libraries (ethers.js, viem)<br>`'unsafe-inline'` - Matomo analytics inline script |
| `style-src` | CSS/Styles | `'unsafe-inline'` - RainbowKit dynamic styling |
| `img-src` | Images | `blob:` `data:` - Dynamically generated images |
| `connect-src` | API calls, WebSockets | All RPC providers and API endpoints |
| `frame-src` | Iframes | Wallet connection modals, feedback widget |
| `object-src` | Plugins (Flash, etc.) | Blocked with `'none'` |
| `frame-ancestors` | Embedding this site | Blocked with `'none'` (prevents clickjacking) |

## Complete Nginx Server Block Example

```nginx
server {
    listen 443 ssl;
    server_name swarming.site www.swarming.site;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/swarming.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/swarming.site/privkey.pem;

    # Serve Static Website
    root /var/www/beeport/out/;
    index index.html;

    # Security Headers - ADD THESE
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://mtm.swarm.foundation https://app.formbricks.com https://unpkg.com https://*.walletconnect.com https://*.walletconnect.org; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://*.walletconnect.com https://*.walletconnect.org https://ethswarm.org https://www.ethswarm.org https://bzz.link https://swarming.site https://*.githubusercontent.com https://avatars.githubusercontent.com https://raw.githubusercontent.com; font-src 'self' data:; connect-src 'self' https://mtm.swarm.foundation https://app.formbricks.com https://api.relay.link https://gateway.thegraph.com https://swarming.site https://bzz.link https://rpc.gnosischain.com https://gnosis-mainnet.public.blastapi.io https://gnosis.drpc.org https://eth.llamarpc.com https://ethereum.publicnode.com https://cloudflare-eth.com https://rpc.ankr.com https://1rpc.io https://*.infura.io https://*.alchemy.com https://*.quicknode.pro https://*.walletconnect.com https://*.walletconnect.org https://relay.walletconnect.com https://relay.walletconnect.org https://*.coinbase.com https://*.web3modal.com wss://relay.walletconnect.com wss://relay.walletconnect.org wss://*.walletconnect.com wss://*.walletconnect.org; frame-src 'self' https://*.walletconnect.com https://*.walletconnect.org https://verify.walletconnect.com https://verify.walletconnect.org https://*.coinbase.com https://app.formbricks.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests;" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    location / {
        try_files $uri /index.html;
    }

    # Your existing /bzz, /stamps, /wallet proxy locations...
}
```

## Troubleshooting

### Issue: Wallet won't connect
- Check browser console for CSP violations
- Look for blocked WalletConnect domains
- Verify `*.walletconnect.com` and `*.walletconnect.org` are in both `script-src`, `connect-src`, and `frame-src`

### Issue: API calls failing
- Check Network tab in browser DevTools
- Add missing API domain to `connect-src`
- Include both `https://` and `wss://` if WebSocket is used

### Issue: Images not loading
- Check console for blocked image URLs
- Add domain to `img-src`

### Issue: Nginx won't reload
- Run `sudo nginx -t` to check syntax
- Common issue: Missing semicolon or unclosed quote
- Make sure CSP is on one line or properly escaped if split

## Adding New Services

When you add a new 3rd party service:

1. Test in browser and check console for CSP violations
2. Note the blocked domain
3. Add to appropriate directive:
   - JavaScript → `script-src`
   - API calls → `connect-src`
   - Images → `img-src`
   - Iframes → `frame-src`
4. Reload Nginx and test again

## Security Notes

- **`'unsafe-eval'`** - Required by Web3 libraries (ethers.js, viem) for dynamic code
- **`'unsafe-inline'`** - Required for Matomo analytics and RainbowKit styling
- All external domains are explicitly whitelisted
- CSP works with static export (`output: 'export'`) - headers added by Nginx

## Testing

```bash
# Check if CSP header exists
curl -I https://swarming.site | grep -i content-security-policy

# Test in browser
# 1. Open https://swarming.site
# 2. Open DevTools (F12) → Console
# 3. Look for CSP violations (should be none)
# 4. Test wallet connection, uploads, swaps
```

