/**
 * Client-side archive extraction + index.html generation, for use with the
 * self-custody upload paths (SWIP §Client-side stamping, mode α).
 *
 * Why this exists separately from {@link ./ArchiveProcessor}: ArchiveProcessor
 * was built for the legacy /bzz upload path, where we needed to re-package
 * everything into a TAR file for Bee to stamp + chunk server-side. The
 * self-custody path stamps + chunks each file ENTRY locally, so re-tarring
 * just to immediately re-extract would be wasted work. Instead we expose:
 *
 *   - {@link extractArchiveToEntries} — flatten ZIP/TAR/.tar.gz into a list of
 *     `{ path, data: Uint8Array }` ready to feed into
 *     {@link ../ClientSideUpload.uploadFilesAsCollectionClientSide}.
 *   - {@link buildSwarmIndexHtml} — generate the same Swarm-styled directory
 *     index page the legacy folder/zip path used to insert when no `index.html`
 *     was present in the archive. Reused by folder uploads (from
 *     `webkitdirectory`) and archive uploads alike.
 *
 * macOS / Windows metadata noise (`.DS_Store`, `__MACOSX/*`, `._*`,
 * `Thumbs.db`, PAX headers) is filtered identically to the legacy path so
 * end users see no behavioural change relative to 1.1.x.
 */

import JSZip from 'jszip';
import pako from 'pako';

export interface ArchiveEntry {
  /** Path within the archive (no leading slash, slash-separated). */
  path: string;
  data: Uint8Array;
}

/**
 * Should this path be silently dropped from the upload? Mirrors the legacy
 * filter set in {@link ./ArchiveProcessor.shouldFilterFile} so users get
 * identical behaviour when re-running an upload after upgrading.
 */
function shouldFilterPath(rawPath: string): boolean {
  const path = rawPath.replace(/^\.\/+/, '').replace(/^\/+/, '');
  if (!path || path.endsWith('/')) return true; // empty or directory marker
  if (path.startsWith('PaxHeader/')) return true;
  if (path.startsWith('__MACOSX/') || path === '__MACOSX') return true;
  if (path === '.DS_Store' || path.includes('/.DS_Store')) return true;
  if (path.startsWith('._') || path.includes('/._')) return true;
  if (path === 'Thumbs.db' || path.includes('/Thumbs.db')) return true;
  return false;
}

function normalisePath(p: string): string {
  return p.replace(/^\.\/+/, '').replace(/^\/+/, '');
}

/**
 * Flatten a ZIP file into archive entries (folders dropped, system metadata
 * filtered).
 */
export async function extractZipToEntries(zipFile: File): Promise<ArchiveEntry[]> {
  const jszip = new JSZip();
  const zipContents = await jszip.loadAsync(zipFile);
  const out: ArchiveEntry[] = [];

  for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
    if (zipEntry.dir) continue;
    if (shouldFilterPath(filename)) continue;
    const arrayBuf = await zipEntry.async('arraybuffer');
    out.push({ path: normalisePath(filename), data: new Uint8Array(arrayBuf) });
  }
  return out;
}

/**
 * Flatten a TAR file (POSIX ustar headers) into archive entries. Lifted from
 * the deleted `FolderUploadUtils.extractTarFiles` so behavioural parity with
 * 1.1.x is preserved (PAX headers etc. handled the same way).
 */
export function extractTarToEntries(tarBytes: Uint8Array): ArchiveEntry[] {
  const out: ArchiveEntry[] = [];
  let offset = 0;

  while (offset + 512 <= tarBytes.length) {
    const block = tarBytes.subarray(offset, offset + 512);

    // Two consecutive zero blocks mark the end of the archive.
    if (block.every(byte => byte === 0)) break;

    const nameBytes = block.subarray(0, 100);
    let nameEnd = nameBytes.indexOf(0);
    if (nameEnd === -1) nameEnd = 100;
    const rawName = new TextDecoder().decode(nameBytes.subarray(0, nameEnd));

    if (!rawName) {
      offset += 512;
      continue;
    }

    // File size: octal string in bytes 124..136.
    const sizeStr = new TextDecoder()
      .decode(block.subarray(124, 136))
      .replace(/\0/g, '')
      .trim();
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;

    // Type flag: byte 156. '5' = directory; trailing slash also signals one.
    const typeFlag = String.fromCharCode(block[156]);
    const isDirectory = typeFlag === '5' || rawName.endsWith('/');

    offset += 512; // past header

    if (!isDirectory && size > 0 && !shouldFilterPath(rawName)) {
      const dataEnd = offset + size;
      if (dataEnd <= tarBytes.length) {
        out.push({ path: normalisePath(rawName), data: tarBytes.subarray(offset, dataEnd) });
      }
    }
    if (size > 0) {
      // Round up to next 512-byte boundary regardless of file vs directory.
      offset += Math.ceil(size / 512) * 512;
    }
  }

  return out;
}

/**
 * Decompress a `.tar.gz` / `.tgz` and extract entries.
 */
export function extractTarGzToEntries(gzBytes: Uint8Array): ArchiveEntry[] {
  const tarBytes = pako.inflate(gzBytes);
  return extractTarToEntries(tarBytes);
}

/**
 * Auto-detect ZIP / TAR / GZ from filename + magic bytes and extract to
 * entries. Returns an empty array if the format isn't recognised.
 */
export async function extractArchiveToEntries(file: File): Promise<ArchiveEntry[]> {
  const lower = file.name.toLowerCase();
  if (
    lower.endsWith('.zip') ||
    file.type === 'application/zip' ||
    file.type === 'application/x-zip-compressed'
  ) {
    return extractZipToEntries(file);
  }

  const buffer = new Uint8Array(await file.arrayBuffer());

  // Gzip magic: 0x1f 0x8b
  if (
    lower.endsWith('.tar.gz') ||
    lower.endsWith('.tgz') ||
    lower.endsWith('.gz') ||
    (buffer.length >= 2 && buffer[0] === 0x1f && buffer[1] === 0x8b)
  ) {
    return extractTarGzToEntries(buffer);
  }

  // Otherwise treat as TAR.
  return extractTarToEntries(buffer);
}

// ─── Index.html generator (Swarm-styled directory listing) ───────────────────

/**
 * Build the same Swarm-branded directory index that the legacy folder upload
 * inserted when an archive didn't already contain `index.html`. Inlined here
 * so a single import covers both folder uploads (from `webkitdirectory`) and
 * archive uploads.
 *
 * Lifted verbatim from `FolderUploadUtils.generateIndexHtml` — the SVG logo
 * and CSS are kept identical so existing upload references rendered against
 * this template look the same.
 */
export function buildSwarmIndexHtml(opts: {
  folderName: string;
  paths: string[];
}): string {
  const { folderName } = opts;
  const sortedPaths = [...opts.paths].sort();

  const fileListHtml = sortedPaths
    .map(
      path => `        <li class="file-item">
          <a href="${path}" class="file-link" target="_blank" rel="noopener noreferrer">
            <span class="file-icon">📄</span>
            <span class="file-name">${path}</span>
          </a>
        </li>`
    )
    .join('\n');

  return `<!-- Swarm Directory Index -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${folderName} - Swarm Distributed Storage</title>
    <style>
        :root {
          --swarm-black: #0e1216;
          --swarm-dark: #161b22;
          --swarm-dark-gray: #1e2328;
          --swarm-border: #30363d;
          --swarm-text-primary: #ffffff;
          --swarm-text-secondary: #8b949e;
          --swarm-accent: #ff7a00;
          --swarm-accent-hover: #e56e00;
          --swarm-success: #3fb950;
        }

        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            background-color: var(--swarm-black);
            color: var(--swarm-text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }

        .container { max-width: 1000px; margin: 0 auto; padding: 2rem; }
        .header { text-align: center; margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--swarm-border); }
        .title { font-size: 2rem; font-weight: 600; color: var(--swarm-text-primary); margin-top: 0.5rem; }
        .subtitle { font-size: 1rem; color: var(--swarm-text-secondary); margin-top: 0.25rem; }
        .files-section { background: var(--swarm-dark); border: 1px solid var(--swarm-border); border-radius: 8px; overflow: hidden; }
        .files-header { background: var(--swarm-dark-gray); padding: 1rem 1.5rem; border-bottom: 1px solid var(--swarm-border); }
        .files-header h3 { color: var(--swarm-text-primary); font-size: 1.1rem; font-weight: 600; }
        .files-count { color: var(--swarm-text-secondary); font-size: 0.9rem; margin-top: 0.25rem; }
        .file-list { list-style: none; padding: 0; margin: 0; }
        .file-item { border-bottom: 1px solid var(--swarm-border); }
        .file-item:last-child { border-bottom: none; }
        .file-link { display: flex; align-items: center; padding: 1rem 1.5rem; text-decoration: none; color: var(--swarm-text-primary); transition: all 0.2s ease; position: relative; }
        .file-link:hover { background: var(--swarm-dark-gray); color: var(--swarm-accent); }
        .file-link:hover::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: var(--swarm-accent); }
        .file-icon { margin-right: 0.75rem; font-size: 1.1rem; opacity: 0.7; }
        .file-name { font-weight: 500; font-size: 0.95rem; }
        .footer { margin-top: 3rem; padding-top: 2rem; border-top: 1px solid var(--swarm-border); text-align: center; }
        .powered-by { display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
        .powered-by a { display: flex; align-items: center; gap: 0.5rem; text-decoration: none; color: var(--swarm-text-secondary); font-size: 0.9rem; transition: all 0.2s ease; }
        .powered-by a:hover { color: var(--swarm-accent); }
        .powered-by .swarm-logo { height: 1.2rem; fill: var(--swarm-accent); transition: all 0.2s ease; }
        .powered-by a:hover .swarm-logo { fill: var(--swarm-accent-hover); }

        @media (max-width: 768px) {
            .container { padding: 1rem; }
            .title { font-size: 1.5rem; }
        }
    </style>
</head>
<body>
    <div class="container">
        <header class="header">
            <h1 class="title">${folderName}</h1>
            <p class="subtitle">Distributed Storage Archive</p>
        </header>

        <div class="files-section">
            <div class="files-header">
                <h3>📁 Archive Contents</h3>
                <p class="files-count">${sortedPaths.length} files available</p>
            </div>
            <ul class="file-list">
${fileListHtml}
            </ul>
        </div>

        <footer class="footer">
            <div class="powered-by">
                <a href="https://ethswarm.org" target="_blank" rel="noopener noreferrer">
                    <span>Powered by</span>
                    <svg class="swarm-logo" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4222.16 1115">
                        <path d="M0 665.01V965l260 150 260-150.01V664.96L260 515 0 665.01zM855 515 595 665v299.99L855 1115l260-150.01V664.95L855 515zM817.32 300.27l-129.91-75.25-.13-149.98L557.5 0 297.68 150.01V450L557.5 600l259.82-150V300.27z"></path>
                        <path d="m817.32 300.27 129.91-75.3V75L817.52 0 687.28 75.04l130.24 74.83-.2 150.4z"></path>
                        <g>
                            <path d="m2415.53 300.74-63.56 442.98c-.1.73-1.16.72-1.25-.01l-55.85-442.95a.63.63 0 0 0-.63-.55h-158.41a.64.64 0 0 0-.63.55l-55.85 442.99c-.09.73-1.15.74-1.25.01l-63.56-443.01a.63.63 0 0 0-.63-.54h-96.57a.63.63 0 0 0-.62.73l80.61 512.59c.05.31.31.53.62.53h158.16c.32 0 .59-.24.63-.55l57.68-442.16c.1-.73 1.16-.73 1.25 0l57.67 442.16c.04.31.31.55.63.55h158.16c.31 0 .58-.23.62-.53l80.61-512.59a.63.63 0 0 0-.62-.73h-96.58a.64.64 0 0 0-.63.54Z"></path>
                        </g>
                    </svg>
                </a>
            </div>
        </footer>
    </div>
</body>
</html>`;
}

/**
 * True if any path in the list looks like a root index document.
 */
export function hasRootIndexHtml(paths: string[]): boolean {
  return paths.some(p => {
    const n = normalisePath(p);
    return n === 'index.html' || n === 'index.htm';
  });
}
