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

2. Add Gas on destination chain https://docs.li.fi/li.fi-api/li.fuel

3. Upload folders directly or add more support for non tar uploads

4. Check spending cap on BZZ, if its above, dont ask for approval

5. Check do we really need a signing if we just enforce domain from where uploads can come from, maybe we just check signing but no need to check it through stamp ownership

6. Enforce on server checking of origin of domain, where the upload came from

7. How do we handle downloads of data, do we enforce gitcoin passport or leave it to ENS?

## How to run locally

First install swarm desktop and run it or install and run bee node locally
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

or

```
tar -C out -cf swap_uploader.tar .
```

so you get TAR archive of static files export and there is no subdirectory when its uploaded to Swarm

## Testing large file upload

Use below to create 1GB bin file on linux, to make it 2GB put count to 32 etc

```
dd if=/dev/urandom of=1GB.bin bs=64M count=16 iflag=fullblock
```

## Check LIFI API endpoints

Go to https://apidocs.li.fi/reference

## Design choices

"By default your bee instance will handle uploads in a deferred manner, meaning that the data will be completely uploaded to your node locally before being then being uploaded to the Swarm network.

In contrast, for a direct upload, the data will be completely uploaded to the Swarm network directly."

We are using non deferred upload, because we want to be able to upload to the Swarm network directly.
