# Self-hosting a Bee gateway for Beeport

Beeport is a fully **self-custody** dapp: every chunk is BMT-hashed and
postage-stamped in the user's browser before it's POSTed to a Bee node. There
is no application server. The browser talks directly to a Bee node over HTTPS.

The repo used to ship a `backend/` Node/Express proxy that gated `POST /bzz` on a
wallet signature and an on-chain `getBatchPayer(batchId)` lookup. With
[`StampsRegistryV2`](../contracts/StampsRegistryV2.sol) and Bee's
`presignedStamper`, that authn/authz layer is now handled cryptographically by
Bee itself — only the holder of a batch's on-chain `_owner` key can produce a
valid stamp envelope, and Bee rejects everything else with HTTP 400. The
proxy was redundant and has been removed.

## What you actually need to run

For Beeport to talk to your node from a browser you need three things:

1. **A Bee node** with a recent enough version to support `presignedStamper`
   (any 2.x). Standard install: <https://docs.ethswarm.org/docs/bee/installation/>.
2. **TLS termination** — browsers won't let an `https://` page POST chunks
   to plain `http://`.
3. **Permissive CORS** for every **browser origin** that will call this gateway.
   The app’s default Bee URL is **`https://beeport.xyz`** (`DEFAULT_BEE_API_URL` in
   `src/app/components/constants.ts`). If you develop the Next app at
   **`http://localhost:3000`** but POST chunks to **`https://beeport.xyz`**, that
   is **cross-origin**: nginx on **beeport.xyz** must whitelist
   `http://localhost:3000` (and usually `http://127.0.0.1:3000`) in the CORS map
   and return `Access-Control-Allow-*` on **`OPTIONS` preflight** to `/chunks`
   as well as on **`POST /chunks`**. Missing this shows up as
   `net::ERR_FAILED` / “No 'Access-Control-Allow-Origin' header” in the
   browser. The browser hits `/chunks`, `/soc/*`, `/bzz/*`, `/health`,
   `/chainstate`, `/wallet`, `/stamps/*`, and `/tags`. The relevant request
   headers are pure Swarm (`swarm-postage-stamp`, `swarm-postage-batch-id`,
   `swarm-pin`, `swarm-deferred-upload`, `swarm-tag`,
   `swarm-index-document`, `swarm-error-document`,
   `swarm-collection`); no app-specific headers are required anymore.

Nginx + the local Bee node on `127.0.0.1:1633` is the recommended stack. If
your platform already gives you HTTPS + CORS (e.g. Cloudflare in front of a
Bee node), you can skip nginx.

## Minimal nginx config

This is a pure pass-through to Bee. **No extra `location` for “creating”
`/chunks`** — Bee already implements `/chunks`; nginx only **proxies** it and
adds CORS. Adjust **`server_name`**, **`root`**, and **TLS paths** to your
domain (the block below still says `swarming.site` as an illustration).

```nginx
map $http_origin $cors_origin {
    default "";
    "~^https://buzz-mint\.eth\.limo$"      "https://buzz-mint.eth.limo";
    "~^https://beeport\.eth\.limo$"        "https://beeport.eth.limo";
    "~^https://beeport\.ethswarm\.org$"    "https://beeport.ethswarm.org";
    "~^https://beeport\.xyz$"              "https://beeport.xyz";
    "~^https://swarming\.site$"            "https://swarming.site";
    "~^https://www\.swarming\.site$"       "https://www.swarming.site";
    "~^http://localhost:3000$"             "http://localhost:3000";
    "~^http://127\.0\.0\.1:3000$"          "http://127.0.0.1:3000";
}

map $request_method $cors_allow_methods {
    default "GET, POST, OPTIONS, PUT, DELETE";
}

# Headers the browser sends. Everything app-specific is gone — only the
# stock Swarm headers + Content-Type / Range remain.
map $request_method $cors_allow_headers {
    default "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization,swarm-postage-stamp,swarm-postage-batch-id,swarm-pin,swarm-deferred-upload,swarm-collection,swarm-tag,swarm-index-document,swarm-error-document,swarm-act,swarm-encrypt,swarm-redundancy-level,swarm-redundancy-strategy,swarm-redundancy-fallback-mode,swarm-chunk-retrieval-timeout";
}

# Headers the browser is allowed to read from the response.
map $request_method $cors_expose_headers {
    default "Content-Length,Content-Range,Swarm-Tag,Swarm-Act-History-Address";
}

# Redirect HTTP → HTTPS
server {
    listen 80;
    server_name swarming.site www.swarming.site;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name swarming.site www.swarming.site;

    ssl_certificate     /etc/letsencrypt/live/swarming.site/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/swarming.site/privkey.pem;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    # Optional: serve the static Beeport export from /var/www/beeport/out
    root /var/www/beeport/out/;
    index index.html;
    location / {
        try_files $uri /index.html;
    }

    # Single CORS-aware proxy block reused for every Bee endpoint.
    # Use a `location ~ ^/(chunks|soc|bzz|stamps|wallet|tags|health|chainstate|reservestate)`
    # if you'd rather list them explicitly.
    location ~ ^/(chunks|soc|bzz|stamps|wallet|tags|health|chainstate|reservestate)(/|$) {
        add_header 'Access-Control-Allow-Origin'      $cors_origin       always;
        add_header 'Access-Control-Allow-Methods'     $cors_allow_methods always;
        add_header 'Access-Control-Allow-Headers'     $cors_allow_headers always;
        add_header 'Access-Control-Expose-Headers'    $cors_expose_headers always;
        add_header 'Access-Control-Allow-Credentials' 'true'              always;

        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type'   'text/plain; charset=utf-8';
            add_header 'Content-Length' 0;
            return 204;
        }

        proxy_pass         http://127.0.0.1:1633;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # Large uploads + slow chunk POSTs.
        client_max_body_size 0;
        proxy_read_timeout   3600s;
        proxy_send_timeout   3600s;
    }
}
```

Apply with:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

## HTTP/2 (recommended for client-side chunk uploads)

The Beeport tab issues **tens of thousands** of small `POST /chunks` requests per large file. **HTTP/1.1** is limited to a handful of parallel connections per host; **HTTP/2** multiplexes many streams on one TLS connection and usually improves throughput a lot.

1. Enable HTTP/2 on the public TLS listener, e.g. `listen 443 ssl http2;` (see the [nginx `http2` module](http://nginx.org/en/docs/http/ngx_http_v2_module.html)).
2. Optional: raise the concurrent stream limit so the edge allows wide parallelism. Beeport ramps to **256** parallel in-flight chunk tasks on HTTP/2 gateways — nginx’s default `http2_max_concurrent_streams` is often **128**, so you may raise it in `http` or `server`:
   ```nginx
   http2_max_concurrent_streams 256;
   ```
3. Optional: expose **Resource Timing** so the browser reports `nextHopProtocol` on cross-origin `/chunks` (otherwise it is hidden unless the gateway sends `Timing-Allow-Origin`):
   ```nginx
   add_header Timing-Allow-Origin "*" always;
   ```
   Narrow `*` to specific origins if you prefer.

## Verify CORS (localhost dev → public gateway)

From any machine, check that preflight for `POST /chunks` allows your dev
origin:

```bash
curl -i -X OPTIONS 'https://beeport.xyz/chunks' \
  -H 'Origin: http://localhost:3000' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type,swarm-postage-stamp'
```

You should see **`Access-Control-Allow-Origin: http://localhost:3000`** (and
typically **204**). If that header is missing, the browser will block uploads.
Replace the URL host if you use a different gateway hostname.

## Pointing Beeport at your node

In the frontend, the Bee gateway URL is read from
`NEXT_PUBLIC_DEFAULT_BEE_API_URL` (see `src/app/components/constants.ts`):

```bash
# default in repo is https://beeport.xyz; point at your own Bee:
NEXT_PUBLIC_DEFAULT_BEE_API_URL=http://localhost:1633
```

The user can also override it from the in-app **Bee node URL** input at
runtime, so the env var is just a default.

## Why the old proxy is gone

For reference, the previous flow shipped each upload with these custom
headers: `x-upload-signed-message`, `x-uploader-address`, `x-file-name`,
`x-message-content`, `x-upload-session-token`, `x-multi-file-upload`. The
proxy verified the wallet signature with viem's `verifyMessage` and called
`StampsRegistry.getBatchPayer(batchId)` on Gnosis to confirm the wallet had
paid for the batch. That was the only thing standing between random wallets
and your local Bee node's bandwidth.

Under self-custody both checks become redundant:

- The user signs **once**, derives a deterministic hot key, registers it
  on-chain via `StampsRegistryV2` as the batch's `_owner`, and stamps every
  chunk locally with that key (`src/app/components/ClientStamping.ts` +
  `src/app/components/ClientSideUpload.ts`).
- Bee's `presignedStamper` validates each stamp envelope against the
  on-chain `_owner` directly — wrong owner ⇒ HTTP 400. There is nothing
  for an application proxy to add on top.

If you still want to gate your Bee node to specific frontends (the proxy's
side-effect of "only my customers' bandwidth"), use:

- **An nginx Origin allowlist** (the `map $http_origin $cors_origin` block
  above already does this for browsers — non-browser clients can fake
  Origin, but they'd need a valid stamp anyway).
- **A simple per-IP rate limit** (`limit_req_zone` in nginx).
- **An API-key layer** (e.g. Cloudflare Workers in front), if you really
  need a hard gate. None of this is needed for correctness — only for
  policing your own bandwidth.

## Smart-contract registry

The on-chain side of self-custody lives in:

- [`contracts/StampsRegistryV2.sol`](../contracts/StampsRegistryV2.sol) —
  sole registry the Beeport app uses (`createSelfCustodyBatch`, wallet index).
  Bee's `presignedStamper` validates stamp envelopes against the on-chain
  batch owner (the hot key).

A legacy V1 `StampsRegistry` and `SushiSwapStampsRouter` may still exist on
Gnosis for older same-chain swap flows; their sources were removed from this
repo (see `docs/TODO.md` §3.1).

Deployments live under `deployments/gnosis/` and can be redeployed with
`npm run deploy:registry-v2`.
