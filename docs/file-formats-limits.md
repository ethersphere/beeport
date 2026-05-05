# File formats and size limits

Practical limits come from **`src/app/components/constants.ts`** (`FILE_SIZE_CONFIG` and related). Update this doc when those values change.

## Single-file uploads

| Setting | Typical value | Notes |
| ------- | ------------- | ----- |
| Large-file warning threshold | 2 GB | UI warns that self-custody uploads are heavy on the browser tab |
| Hard maximum file size | 8 GB | Enforced in the upload UI |

There is no fixed list of “allowed” MIME types for raw Swarm storage: **any file type** can be uploaded. Archive flows (ZIP, TAR, folder) add behaviour described in the dedicated guides.

## Postage / capacity

Effective maximum storage per batch depends on **postage depth** and on-chain batch economics, not on this file-size cap. See [Postage stamps](./postage-stamps.md) and stamp options in the app.

## Related guides

- [Single file upload](./single-file-upload.md)
- [Client-side chunk pipeline](./client-side-chunk-pipeline.md) — browser throughput and gateway limits
- [Troubleshooting](./troubleshooting.md)
