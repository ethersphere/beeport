/**
 * NFT collection upload — self-custody (SWIP §Client-side stamping, mode α)
 * port of the deleted `NFTCollectionProcessor.ts`.
 *
 * Input: a single ZIP file laid out as
 *   /images/<id>.png       (or .jpg, .gif, …; subdirectories tolerated)
 *   /json/<id>.json        ({"image": "ipfs://… or ./images/…", …})
 *
 * What it does:
 *   1. Extract the ZIP entirely client-side via JSZip.
 *   2. Upload every file in `images/` as ONE Mantaray collection (one root
 *      reference, served as `/bzz/<imagesRef>/<filename>`). Self-custody, so
 *      every chunk + manifest is stamped with the user's hot key.
 *   3. Rewrite each metadata JSON: replace `image` / `image_url` fields with
 *      `https://bzz.link/bzz/<imagesRef>/<filename>` (matches behaviour of
 *      the legacy 1.1.x flow exactly).
 *   4. Upload every rewritten metadata JSON as a SECOND Mantaray collection
 *      (one root reference, served as `/bzz/<metadataRef>/<filename>`).
 *
 * The result is two Swarm references — one for images, one for metadata —
 * matching what the previous custodial flow returned, so existing UI code
 * and downstream NFT-deploy scripts can switch over without changes.
 *
 * Differences from the deleted custodial path:
 *   - No `swarm-collection: true` TAR upload to `/bzz`. We BMT-chunk + stamp
 *     each image locally and weave them into a Mantaray manifest ourselves.
 *   - No wallet `signMessage` for upload auth — the gateway never had to
 *     authenticate us in the first place; the hot key signs every stamp.
 */

import JSZip from 'jszip';
import {
  uploadFilesAsCollectionClientSide,
  type CollectionEntry,
  type CollectionUploadResult,
} from './ClientSideUpload';
import type { DerivedHotKey } from './ClientStamping';

export interface NFTCollectionUploadParams {
  /** ZIP file containing `images/` and `json/` folders. */
  zipFile: File;
  /** 32-byte hex (with or without 0x) batch id, on-chain owner = hot key. */
  batchId: string;
  /** Hot key derived via `deriveHotKey()` in ClientStamping.ts. */
  hotKey: DerivedHotKey;
  /** Postage batch depth used to create the batch on-chain. */
  depth: number;
  /** Bee gateway HTTP base URL. */
  beeApiUrl: string;
  /** Optional concurrency override forwarded to the inner uploader. */
  concurrency?: number;
  /** Optional progress callback (0..100 %, plus a stage string for the UI). */
  onProgress?: (percent: number, stage: string) => void;
  /** Optional status string callback for the UI. */
  onStatus?: (message: string) => void;
  /** Optional abort signal. */
  abortSignal?: AbortSignal;
}

export interface NFTCollectionUploadResult {
  imagesReference: `0x${string}`;
  metadataReference: `0x${string}`;
  totalImages: number;
  totalMetadata: number;
  imagesUpload: CollectionUploadResult;
  metadataUpload: CollectionUploadResult;
}

/**
 * Run the full NFT-collection upload pipeline. Throws if the ZIP is missing
 * `images/` or `json/` content.
 */
export async function processNFTCollectionClientSide(
  params: NFTCollectionUploadParams
): Promise<NFTCollectionUploadResult> {
  const {
    zipFile,
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    concurrency,
    onProgress,
    onStatus,
    abortSignal,
  } = params;

  if (!zipFile) throw new Error('No ZIP file provided');

  // ── Extract the ZIP ────────────────────────────────────────────────────────
  onStatus?.('Extracting NFT collection…');
  onProgress?.(5, 'extracting');
  const jszip = new JSZip();
  const zipContents = await jszip.loadAsync(zipFile);

  const imageEntries: CollectionEntry[] = [];
  const jsonEntries: Array<{ filename: string; content: string }> = [];

  for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
    if (zipEntry.dir) continue;
    if (abortSignal?.aborted) throw new Error('Upload aborted');

    // The legacy processor split on the FIRST path component. We do the same
    // so existing collection ZIPs keep working.
    const parts = filename.split('/');
    if (parts.length < 2) continue;
    const folder = parts[0].toLowerCase();
    const baseName = parts[parts.length - 1]; // bare filename, no folder prefix

    if (folder === 'images') {
      const buf = await zipEntry.async('arraybuffer');
      imageEntries.push({ path: baseName, data: new Uint8Array(buf) });
    } else if (folder === 'json') {
      const text = await zipEntry.async('string');
      jsonEntries.push({ filename: baseName, content: text });
    }
  }

  if (imageEntries.length === 0) {
    throw new Error("No images found in the ZIP's `images/` folder");
  }
  if (jsonEntries.length === 0) {
    throw new Error("No JSON metadata files found in the ZIP's `json/` folder");
  }

  console.log(
    `📦 NFT collection: ${imageEntries.length} images, ${jsonEntries.length} JSON files`
  );

  // ── Upload images as one Mantaray collection ─────────────────────────────
  onStatus?.(`Uploading ${imageEntries.length} images (self-custody)…`);
  onProgress?.(15, 'images');

  const imagesUpload = await uploadFilesAsCollectionClientSide({
    entries: imageEntries,
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    // Not a website — we want `/bzz/<ref>/<filename>` to serve the bytes.
    // Leaving `website` undefined skips the website-index/error-document
    // metadata, matching the legacy `swarm-collection: true` behaviour.
    concurrency,
    onProgress: (processed, total) => {
      const pctWithinStage = Math.min(1, processed / Math.max(1, total));
      // Image upload occupies the 15..55 % band of the overall progress.
      onProgress?.(15 + pctWithinStage * 40, 'images');
    },
    onStatus,
    abortSignal,
  });

  const imagesReference = imagesUpload.reference;
  console.log('🖼️ Images uploaded:', imagesReference);

  // ── Rewrite metadata JSON: image / image_url → bzz.link URLs ──────────────
  onStatus?.('Rewriting metadata to point at uploaded images…');
  onProgress?.(60, 'metadata-rewrite');

  const imagesRefHex = imagesReference.startsWith('0x')
    ? imagesReference.slice(2)
    : imagesReference;

  const rewriteImageField = (originalImagePath: string): string => {
    // Same behaviour as the legacy NFTCollectionProcessor: keep just the
    // basename of whatever URL/path the metadata used and rewrite it to a
    // bzz.link URL pointing at the uploaded images collection.
    const imageName = originalImagePath.includes('/')
      ? originalImagePath.split('/').pop() || originalImagePath
      : originalImagePath;
    return `https://bzz.link/bzz/${imagesRefHex}/${imageName}`;
  };

  const metadataEntries: CollectionEntry[] = [];
  for (const { filename, content } of jsonEntries) {
    let payload = content;
    try {
      const metadata = JSON.parse(content);
      if (typeof metadata.image === 'string') {
        metadata.image = rewriteImageField(metadata.image);
      }
      if (typeof metadata.image_url === 'string') {
        metadata.image_url = rewriteImageField(metadata.image_url);
      }
      payload = JSON.stringify(metadata, null, 2);
    } catch (err) {
      // Same fallback as legacy: keep original text if it wasn't valid JSON.
      console.warn(`⚠️ Could not parse JSON ${filename}; uploading as-is:`, err);
    }
    metadataEntries.push({
      path: filename,
      data: new TextEncoder().encode(payload),
      contentType: 'application/json; charset=utf-8',
    });
  }

  // ── Upload metadata as one Mantaray collection ───────────────────────────
  onStatus?.(`Uploading ${metadataEntries.length} metadata files…`);
  onProgress?.(65, 'metadata-upload');

  const metadataUpload = await uploadFilesAsCollectionClientSide({
    entries: metadataEntries,
    batchId,
    hotKey,
    depth,
    beeApiUrl,
    concurrency,
    onProgress: (processed, total) => {
      const pctWithinStage = Math.min(1, processed / Math.max(1, total));
      // Metadata upload occupies the 65..98 % band.
      onProgress?.(65 + pctWithinStage * 33, 'metadata-upload');
    },
    onStatus,
    abortSignal,
  });

  const metadataReference = metadataUpload.reference;
  console.log('📜 Metadata uploaded:', metadataReference);

  onProgress?.(100, 'complete');
  onStatus?.('NFT collection upload complete!');

  return {
    imagesReference,
    metadataReference,
    totalImages: imageEntries.length,
    totalMetadata: metadataEntries.length,
    imagesUpload,
    metadataUpload,
  };
}
