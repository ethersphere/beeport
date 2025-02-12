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

13. Decide do we have 2 clear modes working separatly for Bee Public node and Custom nodes

## How to run locally

Set the BEE API URL to http://localhost:1633

## How to setup endpoint to serve content remotely

Add the in the scripts/index.js code to the server and run it
That will expose bee node endpoints for upload through proxy

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

## Testing large file upload

Use below to create 1GB bin file on linux, to make it 2GB put count to 32 etc

```
dd if=/dev/urandom of=1GB.bin bs=64M count=16 iflag=fullblock
```

## Using locally

First install swarm desktop and run it or run bee node locally
In the app set the local node config to http://127.0.0.1:1633

## Checkin LIFI API endpoints

Go to https://apidocs.li.fi/reference
