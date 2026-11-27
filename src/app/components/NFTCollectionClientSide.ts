/**
 * NFT collection upload — self-custody (SWIP §Client-side stamping, mode α)
 * port of the deleted `NFTCollectionProcessor.ts`.
 *
 * Input: a single ZIP file laid out as
 *   /images/<id>.png       (or .jpg, .gif, …; subdirectories tolerated)
 *   /json/<id>.json        ({"image": "ipfs://… or ./images/…", …})
 *
 * Nested layouts are supported (e.g. build/images/, build/json/) — see
 * `classifyNftZipPath`.
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
  type ChunkTransportMode,
  type CollectionEntry,
  type CollectionUploadResult,
  type UploadTransportListener,
} from './ClientSideUpload';
import type { DerivedHotKey } from './ClientStamping';

/** Normalize archive entry paths (OS separators, leading junk). */
function normalizeZipPath(filename: string): string {
  return filename
    .replace(/\\/g, '/')
    .replace(/^\.\/+/, '')
    .replace(/^\/+/, '');
}

function shouldSkipZipEntry(normalizedPath: string): boolean {
  const lower = normalizedPath.toLowerCase();
  return (
    lower.includes('__macosx/') ||
    lower.endsWith('.ds_store') ||
    normalizedPath.split('/').some(seg => seg === '.' || seg === '..')
  );
}

/**
 * Find collection files whether the ZIP root is `images/` or nested e.g. `build/images/`.
 * Uses the last path segment named `images` or `json` before the filename (case-insensitive),
 * so e.g. …/images/json/1.json is treated as metadata under json/.
 */
function classifyNftZipPath(
  normalizedPath: string
): { kind: 'images' | 'json'; fileName: string } | null {
  const parts = normalizedPath.split('/').filter(Boolean);
  if (parts.length < 2) return null;

  const fileName = parts[parts.length - 1];
  const dirs = parts.slice(0, -1);

  for (let i = dirs.length - 1; i >= 0; i--) {
    const seg = dirs[i].toLowerCase();
    if (seg === 'images') {
      return { kind: 'images', fileName };
    }
    if (seg === 'json') {
      return { kind: 'json', fileName };
    }
  }
  return null;
}

function sampleZipPaths(zipContents: JSZip): string[] {
  const out: string[] = [];
  for (const name of Object.keys(zipContents.files)) {
    const entry = zipContents.files[name];
    if (entry.dir) continue;
    const norm = normalizeZipPath(name);
    if (shouldSkipZipEntry(norm)) continue;
    out.push(norm);
    if (out.length >= 8) break;
  }
  return out;
}

const NFT_ZIP_EXPECTED_LAYOUT =
  'Put metadata JSON files under a json/ folder and image files under an images/ folder. ' +
  'Example: json/1.json, images/1.png. You may zip a parent folder (e.g. build/ containing build/images and build/json); that layout is supported.';

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
  onUploadTransport?: UploadTransportListener;
  chunkTransport?: ChunkTransportMode;
  streamSocketCount?: number;
  /** Swarm erasure-coding level 0–4 forwarded to collection uploads. */
  redundancyLevel?: number;
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
    onUploadTransport,
    chunkTransport,
    streamSocketCount,
    redundancyLevel = 0,
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

  // Supports images/ and json/ at any depth, e.g. build/images/
  for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
    if (zipEntry.dir) continue;
    if (abortSignal?.aborted) throw new Error('Upload aborted');

    const normalized = normalizeZipPath(filename);
    if (shouldSkipZipEntry(normalized)) continue;

    const classified = classifyNftZipPath(normalized);
    if (!classified) continue;

    const { kind, fileName } = classified;

    if (kind === 'images') {
      const buf = await zipEntry.async('arraybuffer');
      imageEntries.push({ path: fileName, data: new Uint8Array(buf) });
    } else {
      const text = await zipEntry.async('string');
      jsonEntries.push({ filename: fileName, content: text });
    }
  }

  const samples = sampleZipPaths(zipContents);
  const sampleSuffix =
    samples.length > 0 ? ` Paths found in the ZIP (sample): ${samples.join('; ')}.` : '';

  if (imageEntries.length === 0) {
    throw new Error(
      `No image files found under an images/ folder.${sampleSuffix} ${NFT_ZIP_EXPECTED_LAYOUT}`
    );
  }
  if (jsonEntries.length === 0) {
    throw new Error(
      `No JSON metadata files found under a json/ folder.${sampleSuffix} ${NFT_ZIP_EXPECTED_LAYOUT}`
    );
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
    onUploadTransport,
    chunkTransport,
    streamSocketCount,
    redundancyLevel,
    abortSignal,
  });

  const imagesReference = imagesUpload.reference;
  console.log('🖼️ Images uploaded:', imagesReference, {
    transport: imagesUpload.uploadTransport ?? 'http',
  });

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
    onUploadTransport,
    chunkTransport,
    streamSocketCount,
    redundancyLevel,
    abortSignal,
  });

  const metadataReference = metadataUpload.reference;
  console.log('📜 Metadata uploaded:', metadataReference, {
    transport: metadataUpload.uploadTransport ?? 'http',
  });

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
