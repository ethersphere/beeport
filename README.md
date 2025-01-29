This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

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

## What needs to be done for this project or TODOs list

1. Remove config that skips typescript errors and lint errors, fix problems

2. Get signature from wallet to confirm the ownership

3. Use the signature when uploading data, send the sig to backend, check in backend that SIG correnspondes to the wallet that created batch (msg sender or we will have additional contract that connects bought and created stamps)

4. Bookkeeper of bought stamps (smart contracts), add who paid for the stamp as we are putting all of them to the same node which will be uploading data for users

5. Make an upload form that sends data to backend, where backend checks if this can be uploaded to the given stamp or given wallet

6. Show for this wallet what stamps it has, maybe somehow show how much more space is there?

7. Add Gas on destination chain https://docs.li.fi/li.fi-api/li.fuel

8. Upload folders directly or add more support for non tar uploads

9. Check spending cap on BZZ, if its above, dont ask for approval

10. Check do we really need a signing if we just enforce domain from where uploads can come from, maybe we just check signing but no need to check it through stamp ownership

11. Can we have update to smart contract that we add actual owner of stamp and node through which it came?

12. Enforce on server checking of origin of domain, where the upload came from

## How to run locally

Set the BEE API URL to http://localhost:1633

## How to setup endpoint to serve content remotely

Add this code to the server, which will expose server endpoints

npm install express http-proxy-middleware ethers viem

```javascript
const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const {
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  getAddress,
  createPublicClient,
  http,
  verifyMessage,
} = require("viem");
const { gnosis } = require("viem/chains");

const POSTAGE_STAMP_ABI = [
  {
    name: "batchOwner",
    type: "function",
    stateMutability: "view",
    inputs: [{ type: "bytes32", name: "batchId" }],
    outputs: [{ type: "address" }],
  },
];

const POSTAGE_STAMP_ADDRESS = "0x45a1502382541Cd610CC9068e88727426b696293";

const app = express();

app.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,PUT,POST,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "*");
  res.sendStatus(200);
});

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  next();
});

const gnosisPublicClient = createPublicClient({
  chain: gnosis,
  transport: http(),
});

const verifySignature = async (req, res, next) => {
  if (req.path === "/bzz") {
    const signature = req.headers["x-upload-signature"];
    const uploaderAddress = req.headers["x-uploader-address"];
    const fileName = req.headers["x-file-name"];
    const batchId = req.headers["swarm-postage-batch-id"];

    if (!signature || !uploaderAddress || !fileName || !batchId) {
      return res.status(401).json({
        error: "Missing required headers",
        missing: { signature, uploaderAddress, fileName, batchId },
      });
    }

    try {
      const messageHash = keccak256(
        encodeAbiParameters(parseAbiParameters(["string", "bytes32"]), [
          fileName,
          `0x${batchId}`,
        ])
      );

      const recoveredAddress = await gnosisPublicClient.verifyMessage({
        address: uploaderAddress,
        message: { raw: messageHash },
        signature,
      });

      if (!recoveredAddress) {
        return res.status(401).json({
          error: "Invalid signature",
          recovered: recoveredAddress,
          provided: uploaderAddress,
        });
      }

      next();
    } catch (error) {
      console.error("\x1b[31m%s\x1b[0m", "Verification Error:", error);
      return res.status(401).json({
        error: "Verification failed",
        details: error.message,
        stack: error.stack,
      });
    }
  } else {
    next();
  }
};

app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  console.log("Headers:", JSON.stringify(req.headers, null, 2));
  next();
});

const proxy = createProxyMiddleware({
  target: "http://localhost:1633",
  changeOrigin: true,
  pathRewrite: null,
  secure: false,
});

app.use("/", verifySignature, proxy);

app.listen(3333, () => console.log("Proxy server running on port 3333"));
```

or you need a PAID plan for NGROK to run your local Node and expose it to world and then start it with this command

```CLI
ngrok http 1633 --request-header-add="ngrok-skip-browser-warning:1"
```

## How to EXPORT this app

Export this with

```
npm run build
```

and make and archive from files in /out directory, then upload that to Swarm network and use with accessing
the hash through https resolver.

Sugges to do it in specific way, go to /out directory and then run

```
tar -cf swap_uploader.tar .
```

so you get TAR archive of static files export and there is no subdirectory when its uploaded to Swarm
