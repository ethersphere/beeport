# Beeport

**Beeport was built as Web2 rails for Swarm**

Web3 will transform how the world operates, but today it still needs practical bridges for people to access it. Swarm is a leading decentralized storage solution, yet difficult for everyday users to reach. Beeport solves this by making Swarm accessible through familiar Web2 entry points—bringing the power of decentralized storage to anyone, right now.

This is a [Next.js](https://nextjs.org) project that enables users to purchase BZZ tokens from any supported blockchain and upload files to the Swarm network with automatic postage stamp creation.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

to test NEXT JS EXPORT USE, serve to serve OUT directory

npm install serve
npx serve out

## ✨ Key Features

- **🔗 Cross-Chain Swaps**: Buy BZZ tokens from any supported blockchain (Ethereum, Polygon, Arbitrum, etc.) using [Relay API](https://docs.relay.link/)
- **⛽ Smart Gas Management**: Automatically checks destination chain balance and only tops up gas when needed (< 1 xDAI)
- **📁 File Upload**: Upload single files, multiple files, or entire NFT collections to Swarm
- **🏷️ Automatic Stamps**: Creates postage stamps automatically with optimal batch sizes
- **🌐 ENS Integration**: Link your ENS domains to Swarm content for human-readable access
- **📊 Upload History**: Track all your uploads with file sizes and timestamps
- **💰 Cost Optimization**: Infinite approvals and smart gas top-ups minimize transaction costs

## How to run locally

Install Swarm Desktop (or a standalone Bee node) and run it. Point the app
at it by leaving the **Bee node URL** input on the default
`http://localhost:1633`, or set:

```bash
NEXT_PUBLIC_DEFAULT_BEE_API_URL=http://localhost:1633
```

That's it — the browser does the BMT, postage stamping and `POST /chunks`
itself. There is **no application server to run**.

## How to expose your Bee node to the world

Beeport is fully self-custody: every chunk is signed in the browser by a
hot key registered on-chain via `StampsRegistryV2`, and Bee's
`presignedStamper` validates each stamp directly. You only need a way for
browsers to reach a Bee node over HTTPS.

Pick whichever fits your setup:

- **Production**: TLS-terminating reverse proxy (nginx, Caddy, Cloudflare,
  etc.) in front of a Bee node, with permissive CORS for your frontend's
  origin. A drop-in nginx config is in [`backend/README.md`](./backend/README.md).
- **Quick demo / local dev**: a paid NGROK plan to expose `localhost:1633`:

  ```bash
  ngrok http 1633 --request-header-add="ngrok-skip-browser-warning:1"
  ```

The legacy Express signature-checking proxy that used to live in `backend/`
is gone — see `backend/README.md` for the rationale.

## How to EXPORT this app

Export this with

```
npm run build
```

and make and archive from files in /out directory, then upload that to Swarm network and use with accessing
the hash through https resolver.

Sugges to do it in specific way, go to /out directory and then run

```
tar -cf beeport.tar .
```

or

```
tar -C out -cf beeport.tar .
```

so you get TAR archive of static files export and there is no subdirectory when its uploaded to Swarm

The web2 way is to just git clone the repo and then run "build" command to get the static files in the out directory and then point the server to that directory.

## Setting environment variables

```
cp .env.local.example .env.local
```

and set values for the variables in the .env.local file, those will be picked up automatically by the app

## Testing large file upload

Use below to create 1GB bin file on linux, to make it 2GB put count to 32 etc

```
dd if=/dev/urandom of=1GB.bin bs=64M count=16 iflag=fullblock
```

## API Documentation

- **Relay API**: [https://docs.relay.link/](https://docs.relay.link/) - Cross-chain swap and execution
- **LiFi SDK**: [https://apidocs.li.fi/reference](https://apidocs.li.fi/reference) - Chain and token information (metadata only)
- **Swarm API**: [https://docs.ethswarm.org/](https://docs.ethswarm.org/) - File upload and postage stamps

## Architecture

### Cross-Chain Integration

- **Relay API**: Handles all cross-chain swaps and gas forwarding
- **Smart Contracts**: Direct interaction with Swarm postage stamp registry on Gnosis chain
- **Gas Optimization**: Conditional gas top-up based on destination chain balance

### File Upload Strategy

"By default your bee instance will handle uploads in a deferred manner, meaning that the data will be completely uploaded to your node locally before being then being uploaded to the Swarm network.

In contrast, for a direct upload, the data will be completely uploaded to the Swarm network directly."

We are using **non-deferred upload** because we want to upload directly to the Swarm network for better performance and reliability.

## Recent Changes

### v0.2.x - Relay Integration

- ✅ **Replaced LiFi execution** with Relay API for better reliability
- ✅ **Smart gas management** - only top up when destination balance < 1 xDAI
- ✅ **Improved error handling** - user-friendly messages for all failure scenarios
- ✅ **Performance optimization** - reduced timer buffer from 10s to 5s
- ✅ **File size tracking** - display file sizes in upload history
- ✅ **Code cleanup** - removed ~149 lines of unused LiFi execution code

### Configuration

All timing and gas parameters are now configurable via constants:

```typescript
export const GAS_TOPUP_THRESHOLD_XDAI = 1.0; // Minimum balance to skip gas top-up
export const GAS_TOPUP_AMOUNT_USD = '1000000'; // $1 top-up amount
export const RELAY_TIMER_BUFFER_SECONDS = 5; // Timer buffer
```
