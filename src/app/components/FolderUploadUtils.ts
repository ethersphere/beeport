import JSZip from 'jszip';
import Tar from 'tar-js';

/**
 * Interface for folder upload parameters
 */
export interface FolderUploadParams {
  files: FileList;
  folderName: string;
  setUploadProgress: (progress: number) => void;
  setStatusMessage: (status: { step: string; message: string }) => void;
}

/**
 * Check if the folder contains an index.html or index.htm file
 * @param files FileList from folder selection
 * @param folderName The name of the folder
 * @returns boolean indicating if an index file exists
 */
const hasIndexFile = (files: FileList, folderName: string): boolean => {
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = file.webkitRelativePath.replace(`${folderName}/`, '');

    // Check if there's an index.html or index.htm at the root level
    if (relativePath === 'index.html' || relativePath === 'index.htm') {
      return true;
    }
  }
  return false;
};

/**
 * Generate a Swarm-branded index.html file that lists all files with relative paths
 * @param files FileList from folder selection
 * @param folderName The name of the folder
 * @returns string containing the HTML content
 */
const generateIndexHtml = (files: FileList, folderName: string): string => {
  const fileList: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = file.webkitRelativePath.replace(`${folderName}/`, '');

    // Skip empty directories and the index file itself
    if (file.size === 0 && relativePath.endsWith('/')) {
      continue;
    }

    // Use the same TAR-compatible path that we use when adding files to the archive
    const tarCompatiblePath = ensureTarCompatiblePath(relativePath);
    fileList.push(tarCompatiblePath);
  }

  // Sort files alphabetically
  fileList.sort();

  const fileListHtml = fileList
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
          /* Swarm color palette */
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

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            background-color: var(--swarm-black);
            color: var(--swarm-text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--swarm-border);
        }

        .title {
            font-size: 2rem;
            font-weight: 600;
            color: var(--swarm-text-primary);
            margin-top: 0.5rem;
        }

        .subtitle {
            font-size: 1rem;
            color: var(--swarm-text-secondary);
            margin-top: 0.25rem;
        }


        .files-section {
            background: var(--swarm-dark);
            border: 1px solid var(--swarm-border);
            border-radius: 8px;
            overflow: hidden;
        }

        .files-header {
            background: var(--swarm-dark-gray);
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--swarm-border);
        }

        .files-header h3 {
            color: var(--swarm-text-primary);
            font-size: 1.1rem;
            font-weight: 600;
        }

        .files-count {
            color: var(--swarm-text-secondary);
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }

        .file-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .file-item {
            border-bottom: 1px solid var(--swarm-border);
        }

        .file-item:last-child {
            border-bottom: none;
        }

        .file-link {
            display: flex;
            align-items: center;
            padding: 1rem 1.5rem;
            text-decoration: none;
            color: var(--swarm-text-primary);
            transition: all 0.2s ease;
            position: relative;
        }

        .file-link:hover {
            background: var(--swarm-dark-gray);
            color: var(--swarm-accent);
        }

        .file-link:hover::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: var(--swarm-accent);
        }

        .file-icon {
            margin-right: 0.75rem;
            font-size: 1.1rem;
            opacity: 0.7;
        }

        .file-name {
            font-weight: 500;
            font-size: 0.95rem;
        }

        .footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid var(--swarm-border);
            text-align: center;
        }

        .powered-by {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .powered-by a {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            text-decoration: none;
            color: var(--swarm-text-secondary);
            font-size: 0.9rem;
            transition: all 0.2s ease;
        }

        .powered-by a:hover {
            color: var(--swarm-accent);
        }

        .powered-by .swarm-logo {
            height: 1.2rem;
            fill: var(--swarm-accent);
            transition: all 0.2s ease;
        }

        .powered-by a:hover .swarm-logo {
            fill: var(--swarm-accent-hover);
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .title {
                font-size: 1.5rem;
            }
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
                <p class="files-count">${fileList.length} files available</p>
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
                            <path d="m2415.53 300.74-63.56 442.98c-.1.73-1.16.72-1.25-.01l-55.85-442.95a.63.63 0 0 0-.63-.55h-158.41a.64.64 0 0 0-.63.55l-55.85 442.99c-.09.73-1.15.74-1.25.01l-63.56-443.01a.63.63 0 0 0-.63-.54h-96.57a.63.63 0 0 0-.62.73l80.61 512.59c.05.31.31.53.62.53h158.16c.32 0 .59-.24.63-.55l57.68-442.16c.1-.73 1.16-.73 1.25 0l57.67 442.16c.04.31.31.55.63.55h158.16c.31 0 .58-.23.62-.53l80.61-512.59a.63.63 0 0 0-.62-.73h-96.58a.64.64 0 0 0-.63.54ZM4189.53 324.76c-22.01-25.59-53.37-38.57-93.2-38.57-50.94 0-89.06 22.89-113.39 68.06h-.38c-6.8-18.86-18-34.68-33.35-47.1-17.22-13.9-39.1-20.95-65.04-20.95-24.32 0-45.81 6.04-63.86 17.96-15.22 10.05-27.46 24.82-36.48 44.02v-47.33a.63.63 0 0 0-.63-.63h-94.28a.63.63 0 0 0-.63.63v512.58c0 .35.28.63.63.63h94.28c.35 0 .63-.28.63-.63V463.06c0-25.95 5.98-47.08 17.77-62.81 11.37-15.15 27.25-22.51 48.55-22.51 17.46 0 30.98 6.01 41.33 18.38 10.75 12.85 15.98 28.86 15.98 48.93v368.38c0 .35.28.63.63.63h94.28c.35 0 .63-.28.63-.63V469.06c0-31.75 6.22-55.29 18.48-69.94 12.04-14.39 27.36-21.39 46.83-21.39 20.53 0 34.89 6.16 43.91 18.83 9.55 13.45 14.39 31.1 14.39 52.48v364.37c0 .35.28.63.63.63h94.92V423.03c0-39.98-10.98-73.04-32.64-98.27ZM3084.49 758.16l-59.73 66.7a.64.64 0 0 1-.9.06l-105.21-91.18a.65.65 0 0 0-.75-.07l-125.83 73.49c-21.21 12.12-43.43 18.18-67.66 18.18-35.35 0-67.66-13.12-95.94-38.37-27.27-26.26-41.41-58.58-41.41-97.96 0-47.46 25.25-93.92 68.67-118.16l254.16-146.24c.2-.11.32-.33.32-.56v-32.32a.64.64 0 0 0-.64-.64h-296.62a.64.64 0 0 1-.64-.64v-89.59c0-.36.29-.64.64-.64h387.51c.36 0 .64.29.64.64v383.82c0 .19.08.36.22.49l83.1 72.09c.27.24.3.65.06.92Zm-337.87-29.78 163.27-94.74c.2-.12.32-.33.32-.56V530.54c0-.5-.54-.8-.96-.56L2701.17 649.6c-15.15 9.09-23.23 22.22-23.23 39.39 0 25.24 22.22 45.45 45.45 45.45 9.09 0 16.15-2.02 23.23-6.07ZM3538.58 336.12c-32.96-32.95-72.9-49.93-119.84-49.93-55.69 0-100.48 21.79-134.38 65.37a.61.61 0 0 1-.91.08l-59.94-55.04a.63.63 0 0 0-.9.04l-59.07 65.96a.64.64 0 0 0 .05.9l85.2 77.28c.13.12.21.29.21.47V723.3c0 .35-.29.64-.64.64h-84.66a.64.64 0 0 0-.64.64v88.59c0 .35.29.64.64.64h305.1c.35 0 .64-.29.64-.64v-88.59a.64.64 0 0 0-.64-.64h-129.29a.64.64 0 0 1-.64-.64V460.25c0-41.97 30.45-79.89 72.23-83.83 47.34-4.47 87.54 33.06 87.54 79.52v29.32c0 .35.29.64.64.64h88.6c.35 0 .64-.29.64-.64v-29.32c0-46.93-16.98-86.88-49.93-119.83ZM1823.98 600.5c-6.22-14.51-15.66-27.21-26.99-36.45-10.58-10.57-24.11-18.85-42.32-25.91-18.6-8.75-35.87-13.85-48.84-17.31-16.85-4.49-35.01-9.21-55.39-13.09-39.83-7.96-69.35-17.88-87.71-29.47-17.93-11.33-27.02-26.26-27.02-44.41 0-21.06 7.64-35.8 24.2-46.53 23.29-15.09 52.03-19.17 79.01-13.62 26.1 5.37 49.63 20.56 69.41 37.92 4.02 3.53 45.13 41.31 44.37 42.17l59.09-66.95s-28.44-28.8-41.92-40.54c-32.14-27.98-70.36-51.61-113.41-58.4-42.77-6.75-91.43-.29-129.98 19.65a172.67 172.67 0 0 0-29.97 19.71c-34.32 28.08-51.71 64.95-51.71 109.61s14.69 79.88 44.84 101.71c28.29 21.22 68.98 37.67 120.97 48.89 45.94 9.77 79.31 19.77 99.4 29.8 19.12 8.19 28.41 21.3 28.41 40.07 0 24.19-9.75 42.5-29.07 54.46-43.51 26.94-103.96 25.74-147.95.48-18.97-10.9-34.68-26.71-51.3-40.74-12.75-10.88-24.81-22.56-37.09-33.97-.14-.13-.28-.26-.48-.52l-57.52 69.28c-.17.21 28.12 26.19 30.59 28.44 38.88 35.44 80.79 64.78 133.12 75.62a280.5 280.5 0 0 0 56.85 5.65c56.29 0 103.73-14.81 140.95-43.99 39.04-29.79 58.84-71.09 58.84-122.73 0-17.07-3.97-34.03-11.37-48.82Z"></path>
                        </g>
                    </svg>
                </a>
            </div>
        </footer>
    </div>
</body>
</html>`;
};

/**
 * Create a TAR archive from a folder using tar-js
 * @param params Folder upload parameters
 * @returns Promise<File> The created archive file
 */
export const createFolderArchive = async (params: FolderUploadParams): Promise<File> => {
  const { files, folderName, setUploadProgress, setStatusMessage } = params;

  setStatusMessage({ step: 'creating_archive', message: 'Creating TAR archive from folder...' });
  setUploadProgress(0);

  const tarball = new Tar();
  const totalFiles = files.length;
  let processedFiles = 0;

  // Check if index file exists, if not, we'll add one
  const needsIndexFile = !hasIndexFile(files, folderName);

  // Add index.html file first if it doesn't exist
  if (needsIndexFile) {
    setStatusMessage({
      step: 'creating_archive',
      message: 'Generating index.html file...',
    });

    const indexHtml = generateIndexHtml(files, folderName);
    const indexBuffer = new TextEncoder().encode(indexHtml);
    tarball.append('index.html', indexBuffer);
  }

  // Add all files to the TAR archive, preserving folder structure
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Get the relative path from the folder root
    const relativePath = file.webkitRelativePath.replace(`${folderName}/`, '');

    // Skip empty directories (they don't have content)
    if (file.size === 0 && relativePath.endsWith('/')) {
      continue;
    }

    // Skip files with problematic paths
    if (
      !relativePath ||
      relativePath.trim() === '' ||
      relativePath.includes('//') ||
      relativePath.startsWith('/') ||
      relativePath.includes('..')
    ) {
      console.warn(`Skipping file with problematic path: ${relativePath}`);
      continue;
    }

    try {
      const fileData = await file.arrayBuffer();
      const tarCompatiblePath = ensureTarCompatiblePath(relativePath);
      tarball.append(tarCompatiblePath, new Uint8Array(fileData));

      processedFiles++;
      const progress = Math.round((processedFiles / totalFiles) * (needsIndexFile ? 90 : 95));
      setUploadProgress(progress);

      setStatusMessage({
        step: 'creating_archive',
        message: `Processing files... ${processedFiles}/${totalFiles}`,
      });
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      throw new Error(`Failed to process file: ${file.name}`);
    }
  }

  setStatusMessage({ step: 'generating_archive', message: 'Generating TAR archive...' });

  try {
    // Generate the TAR file
    const tarBuffer = tarball.out;

    if (!tarBuffer || tarBuffer.length === 0) {
      throw new Error('TAR buffer is empty or invalid');
    }

    const archiveFile = new File([tarBuffer], `${folderName}.tar`, {
      type: 'application/x-tar',
      lastModified: Date.now(),
    });

    if (archiveFile.size === 0) {
      throw new Error('Created TAR file is empty');
    }

    setUploadProgress(100);
    setStatusMessage({ step: 'archive_ready', message: 'TAR archive created successfully!' });

    return archiveFile;
  } catch (error) {
    console.error('Error generating TAR archive:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setStatusMessage({ step: 'error', message: `Failed to create TAR archive: ${errorMessage}` });
    throw new Error(`Failed to create TAR archive: ${errorMessage}`);
  }
};

/**
 * Handle folder selection and archive creation
 * @param inputElement The file input element with webkitdirectory
 * @param params Folder upload parameters
 * @returns Promise<File> The created archive file
 */
export const handleFolderSelection = async (
  inputElement: HTMLInputElement,
  params: Omit<FolderUploadParams, 'files' | 'folderName'>
): Promise<File | null> => {
  const { setUploadProgress, setStatusMessage } = params;

  if (!inputElement.files || inputElement.files.length === 0) {
    return null;
  }

  const files = inputElement.files;
  const firstFile = files[0];

  if (!firstFile.webkitRelativePath) {
    throw new Error('No folder structure detected. Please select a folder.');
  }

  // Extract folder name from the first file's webkitRelativePath
  const folderName = firstFile.webkitRelativePath.split('/')[0];

  try {
    const archiveFile = await createFolderArchive({
      files,
      folderName,
      setUploadProgress,
      setStatusMessage,
    });

    return archiveFile;
  } catch (error) {
    console.error('Error creating folder archive:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setStatusMessage({ step: 'error', message: `Failed to create archive: ${errorMessage}` });
    throw error;
  }
};

/**
 * Interface for TAR file processing parameters
 */
export interface TarProcessingParams {
  tarFile: File;
  setUploadProgress: (progress: number) => void;
  setStatusMessage: (status: { step: string; message: string }) => void;
}

/**
 * Extract files from TAR buffer using a simple TAR parser
 * @param tarBuffer The TAR file buffer
 * @returns Array of extracted files with names and data
 */
const extractTarFiles = (
  tarBuffer: ArrayBuffer
): Array<{ name: string; data: Uint8Array; isDirectory: boolean }> => {
  const view = new Uint8Array(tarBuffer);
  const files: Array<{ name: string; data: Uint8Array; isDirectory: boolean }> = [];
  let offset = 0;

  while (offset < view.length) {
    // Check if we've reached the end (two consecutive zero blocks)
    if (offset + 1024 > view.length) break;

    const block = view.slice(offset, offset + 512);

    // Check if this is a zero block (end of archive)
    if (block.every(byte => byte === 0)) {
      break;
    }

    // Extract filename (first 100 bytes, null-terminated)
    const nameBytes = block.slice(0, 100);
    let nameEnd = nameBytes.indexOf(0);
    if (nameEnd === -1) nameEnd = 100;
    const name = new TextDecoder().decode(nameBytes.slice(0, nameEnd));

    if (!name) {
      offset += 512;
      continue;
    }

    // Extract file size (bytes 124-135, octal string)
    const sizeBytes = block.slice(124, 136);
    const sizeStr = new TextDecoder().decode(sizeBytes).replace(/\0/g, '').trim();
    const size = sizeStr ? parseInt(sizeStr, 8) : 0;

    // Extract file type (byte 156)
    const typeFlag = String.fromCharCode(block[156]);
    const isDirectory = typeFlag === '5' || name.endsWith('/');

    offset += 512; // Move past header

    // Extract file data if it's a regular file
    let data = new Uint8Array(0);
    if (!isDirectory && size > 0) {
      const dataEnd = offset + size;
      if (dataEnd <= view.length) {
        data = view.slice(offset, dataEnd);
      }
      // Round up to next 512-byte boundary
      offset += Math.ceil(size / 512) * 512;
    }

    files.push({ name, data, isDirectory });
  }

  return files;
};

/**
 * Normalize a file path by removing ./ prefixes and cleaning up the path
 * @param path The file path to normalize
 * @returns Normalized path
 */
const normalizePath = (path: string): string => {
  // Remove leading ./ and ./
  let normalized = path.replace(/^\.\/+/, '');

  // Remove any remaining leading slashes
  normalized = normalized.replace(/^\/+/, '');

  return normalized;
};

/**
 * Truncate filename if it's too long for TAR format (100 char limit)
 * @param path The file path
 * @returns Truncated path if necessary
 */
const ensureTarCompatiblePath = (path: string): string => {
  const TAR_FILENAME_LIMIT = 100;

  if (path.length <= TAR_FILENAME_LIMIT) {
    return path;
  }

  // Split path into directory and filename
  const lastSlashIndex = path.lastIndexOf('/');
  const directory = lastSlashIndex > 0 ? path.substring(0, lastSlashIndex + 1) : '';
  const filename = lastSlashIndex > 0 ? path.substring(lastSlashIndex + 1) : path;

  // Split filename into name and extension
  const lastDotIndex = filename.lastIndexOf('.');
  const name = lastDotIndex >= 0 ? filename.substring(0, lastDotIndex) : filename;
  const extension = lastDotIndex >= 0 ? filename.substring(lastDotIndex) : '';

  // Ensure we always have an extension if the original had one
  const hasExtension = lastDotIndex >= 0 && extension.length > 1; // .ext must be at least 2 chars

  // Calculate available space for name (accounting for directory and extension)
  const availableSpace = TAR_FILENAME_LIMIT - directory.length - extension.length;

  if (availableSpace <= 0) {
    // If directory path itself is too long, just use a hash of the original name
    const shortHash = Math.abs(
      path.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
    ).toString(36);
    // Always preserve extension if it exists
    const finalExtension = hasExtension ? extension : '';
    return `file_${shortHash}${finalExtension}`;
  }

  // Truncate the name part and add a hash to maintain uniqueness
  const shortHash = Math.abs(
    name.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)
  ).toString(36);
  const maxNameLength = availableSpace - shortHash.length - 1; // -1 for underscore

  if (maxNameLength > 0) {
    const truncatedName = name.substring(0, maxNameLength);
    const finalExtension = hasExtension ? extension : '';
    return `${directory}${truncatedName}_${shortHash}${finalExtension}`;
  } else {
    // Fallback: just use hash with extension
    const finalExtension = hasExtension ? extension : '';
    return `${directory}${shortHash}${finalExtension}`;
  }
};

/**
 * Check if a file is a macOS PAX header or other metadata file that should be filtered out
 * @param path The file path to check
 * @returns boolean indicating if the file should be filtered out
 */
const shouldFilterFile = (path: string): boolean => {
  const normalizedPath = normalizePath(path);

  // Filter out macOS PAX headers
  if (normalizedPath.startsWith('PaxHeader/')) {
    return true;
  }

  // Filter out __MACOSX metadata folders and their contents
  if (normalizedPath.startsWith('__MACOSX/') || normalizedPath === '__MACOSX') {
    return true;
  }

  // Filter out other common macOS metadata files
  if (normalizedPath === '.DS_Store' || normalizedPath.includes('/.DS_Store')) {
    return true;
  }

  // Filter out macOS resource forks (._filename)
  if (normalizedPath.startsWith('._') || normalizedPath.includes('/._')) {
    return true;
  }

  // Filter out Thumbs.db (Windows) and other system files
  if (normalizedPath === 'Thumbs.db' || normalizedPath.includes('/Thumbs.db')) {
    return true;
  }

  return false;
};

/**
 * Check if extracted TAR files contain an index.html or index.htm file
 * @param files Array of extracted files
 * @returns boolean indicating if an index file exists
 */
const tarHasIndexFile = (
  files: Array<{ name: string; data: Uint8Array; isDirectory: boolean }>
): boolean => {
  return files.some(file => {
    // Skip PAX headers and metadata files
    if (shouldFilterFile(file.name)) {
      return false;
    }

    const normalizedName = normalizePath(file.name);
    return (
      !file.isDirectory &&
      (normalizedName === 'index.html' ||
        normalizedName === 'index.htm' ||
        normalizedName.endsWith('/index.html') ||
        normalizedName.endsWith('/index.htm'))
    );
  });
};

/**
 * Generate index.html content for TAR file contents
 * @param files Array of extracted files
 * @param filename The original TAR filename
 * @returns string containing the HTML content
 */
const generateIndexHtmlForTar = (
  files: Array<{ name: string; data: Uint8Array; isDirectory: boolean }>,
  filename: string
): string => {
  // Filter out directories, PAX headers, and get file list with normalized and TAR-compatible paths
  const fileList = files
    .filter(file => {
      // Skip PAX headers and metadata files
      if (shouldFilterFile(file.name)) {
        return false;
      }

      const normalizedName = normalizePath(file.name);
      return !file.isDirectory && normalizedName !== 'index.html' && normalizedName !== 'index.htm';
    })
    .map(file => {
      const normalizedPath = normalizePath(file.name);
      return ensureTarCompatiblePath(normalizedPath);
    })
    .sort();

  const folderName = filename.replace(/\.(tar|zip|gz)$/i, '');

  const fileListHtml = fileList
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
          /* Swarm color palette */
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

        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
            background-color: var(--swarm-black);
            color: var(--swarm-text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }

        .container {
            max-width: 1000px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            text-align: center;
            margin-bottom: 2rem;
            padding-bottom: 1.5rem;
            border-bottom: 1px solid var(--swarm-border);
        }

        .title {
            font-size: 2rem;
            font-weight: 600;
            color: var(--swarm-text-primary);
            margin-top: 0.5rem;
        }

        .subtitle {
            font-size: 1rem;
            color: var(--swarm-text-secondary);
            margin-top: 0.25rem;
        }

        .files-section {
            background: var(--swarm-dark);
            border: 1px solid var(--swarm-border);
            border-radius: 8px;
            overflow: hidden;
        }

        .files-header {
            background: var(--swarm-dark-gray);
            padding: 1rem 1.5rem;
            border-bottom: 1px solid var(--swarm-border);
        }

        .files-header h3 {
            color: var(--swarm-text-primary);
            font-size: 1.1rem;
            font-weight: 600;
        }

        .files-count {
            color: var(--swarm-text-secondary);
            font-size: 0.9rem;
            margin-top: 0.25rem;
        }

        .file-list {
            list-style: none;
            padding: 0;
            margin: 0;
        }

        .file-item {
            border-bottom: 1px solid var(--swarm-border);
        }

        .file-item:last-child {
            border-bottom: none;
        }

        .file-link {
            display: flex;
            align-items: center;
            padding: 1rem 1.5rem;
            text-decoration: none;
            color: var(--swarm-text-primary);
            transition: all 0.2s ease;
            position: relative;
        }

        .file-link:hover {
            background: var(--swarm-dark-gray);
            color: var(--swarm-accent);
        }

        .file-link:hover::before {
            content: '';
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: var(--swarm-accent);
        }

        .file-icon {
            margin-right: 0.75rem;
            font-size: 1.1rem;
            opacity: 0.7;
        }

        .file-name {
            font-weight: 500;
            font-size: 0.95rem;
        }

        .footer {
            margin-top: 3rem;
            padding-top: 2rem;
            border-top: 1px solid var(--swarm-border);
            text-align: center;
        }

        .powered-by {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
        }

        .powered-by a {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            text-decoration: none;
            color: var(--swarm-text-secondary);
            font-size: 0.9rem;
            transition: all 0.2s ease;
        }

        .powered-by a:hover {
            color: var(--swarm-accent);
        }

        .powered-by .swarm-logo {
            height: 1.2rem;
            fill: var(--swarm-accent);
            transition: all 0.2s ease;
        }

        .powered-by a:hover .swarm-logo {
            fill: var(--swarm-accent-hover);
        }

        /* Mobile responsiveness */
        @media (max-width: 768px) {
            .container {
                padding: 1rem;
            }
            
            .title {
                font-size: 1.5rem;
            }
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
                <p class="files-count">TAR archive ready for extraction</p>
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
                            <path d="m2415.53 300.74-63.56 442.98c-.1.73-1.16.72-1.25-.01l-55.85-442.95a.63.63 0 0 0-.63-.55h-158.41a.64.64 0 0 0-.63.55l-55.85 442.99c-.09.73-1.15.74-1.25.01l-63.56-443.01a.63.63 0 0 0-.63-.54h-96.57a.63.63 0 0 0-.62.73l80.61 512.59c.05.31.31.53.62.53h158.16c.32 0 .59-.24.63-.55l57.68-442.16c.1-.73 1.16-.73 1.25 0l57.67 442.16c.04.31.31.55.63.55h158.16c.31 0 .58-.23.62-.53l80.61-512.59a.63.63 0 0 0-.62-.73h-96.58a.64.64 0 0 0-.63.54ZM4189.53 324.76c-22.01-25.59-53.37-38.57-93.2-38.57-50.94 0-89.06 22.89-113.39 68.06h-.38c-6.8-18.86-18-34.68-33.35-47.1-17.22-13.9-39.1-20.95-65.04-20.95-24.32 0-45.81 6.04-63.86 17.96-15.22 10.05-27.46 24.82-36.48 44.02v-47.33a.63.63 0 0 0-.63-.63h-94.28a.63.63 0 0 0-.63.63v512.58c0 .35.28.63.63.63h94.28c.35 0 .63-.28.63-.63V463.06c0-25.95 5.98-47.08 17.77-62.81 11.37-15.15 27.25-22.51 48.55-22.51 17.46 0 30.98 6.01 41.33 18.38 10.75 12.85 15.98 28.86 15.98 48.93v368.38c0 .35.28.63.63.63h94.28c.35 0 .63-.28.63-.63V469.06c0-31.75 6.22-55.29 18.48-69.94 12.04-14.39 27.36-21.39 46.83-21.39 20.53 0 34.89 6.16 43.91 18.83 9.55 13.45 14.39 31.1 14.39 52.48v364.37c0 .35.28.63.63.63h94.92V423.03c0-39.98-10.98-73.04-32.64-98.27ZM3084.49 758.16l-59.73 66.7a.64.64 0 0 1-.9.06l-105.21-91.18a.65.65 0 0 0-.75-.07l-125.83 73.49c-21.21 12.12-43.43 18.18-67.66 18.18-35.35 0-67.66-13.12-95.94-38.37-27.27-26.26-41.41-58.58-41.41-97.96 0-47.46 25.25-93.92 68.67-118.16l254.16-146.24c.2-.11.32-.33.32-.56v-32.32a.64.64 0 0 0-.64-.64h-296.62a.64.64 0 0 1-.64-.64v-89.59c0-.36.29-.64.64-.64h387.51c.36 0 .64.29.64.64v383.82c0 .19.08.36.22.49l83.1 72.09c.27.24.3.65.06.92Zm-337.87-29.78 163.27-94.74c.2-.12.32-.33.32-.56V530.54c0-.5-.54-.8-.96-.56L2701.17 649.6c-15.15 9.09-23.23 22.22-23.23 39.39 0 25.24 22.22 45.45 45.45 45.45 9.09 0 16.15-2.02 23.23-6.07ZM3538.58 336.12c-32.96-32.95-72.9-49.93-119.84-49.93-55.69 0-100.48 21.79-134.38 65.37a.61.61 0 0 1-.91.08l-59.94-55.04a.63.63 0 0 0-.9.04l-59.07 65.96a.64.64 0 0 0 .05.9l85.2 77.28c.13.12.21.29.21.47V723.3c0 .35-.29.64-.64.64h-84.66a.64.64 0 0 0-.64.64v88.59c0 .35.29.64.64.64h305.1c.35 0 .64-.29.64-.64v-88.59a.64.64 0 0 0-.64-.64h-129.29a.64.64 0 0 1-.64-.64V460.25c0-41.97 30.45-79.89 72.23-83.83 47.34-4.47 87.54 33.06 87.54 79.52v29.32c0 .35.29.64.64.64h88.6c.35 0 .64-.29.64-.64v-29.32c0-46.93-16.98-86.88-49.93-119.83ZM1823.98 600.5c-6.22-14.51-15.66-27.21-26.99-36.45-10.58-10.57-24.11-18.85-42.32-25.91-18.6-8.75-35.87-13.85-48.84-17.31-16.85-4.49-35.01-9.21-55.39-13.09-39.83-7.96-69.35-17.88-87.71-29.47-17.93-11.33-27.02-26.26-27.02-44.41 0-21.06 7.64-35.8 24.2-46.53 23.29-15.09 52.03-19.17 79.01-13.62 26.1 5.37 49.63 20.56 69.41 37.92 4.02 3.53 45.13 41.31 44.37 42.17l59.09-66.95s-28.44-28.8-41.92-40.54c-32.14-27.98-70.36-51.61-113.41-58.4-42.77-6.75-91.43-.29-129.98 19.65a172.67 172.67 0 0 0-29.97 19.71c-34.32 28.08-51.71 64.95-51.71 109.61s14.69 79.88 44.84 101.71c28.29 21.22 68.98 37.67 120.97 48.89 45.94 9.77 79.31 19.77 99.4 29.8 19.12 8.19 28.41 21.3 28.41 40.07 0 24.19-9.75 42.5-29.07 54.46-43.51 26.94-103.96 25.74-147.95.48-18.97-10.9-34.68-26.71-51.3-40.74-12.75-10.88-24.81-22.56-37.09-33.97-.14-.13-.28-.26-.48-.52l-57.52 69.28c-.17.21 28.12 26.19 30.59 28.44 38.88 35.44 80.79 64.78 133.12 75.62a280.5 280.5 0 0 0 56.85 5.65c56.29 0 103.73-14.81 140.95-43.99 39.04-29.79 58.84-71.09 58.84-122.73 0-17.07-3.97-34.03-11.37-48.82Z"></path>
                        </g>
                    </svg>
                </a>
            </div>
        </footer>
    </div>
</body>
</html>`;
};

/**
 * Process a TAR file to add index.html if missing
 * @param params TAR processing parameters
 * @returns Promise<File> The processed TAR file (original or modified)
 */
export const processTarFile = async (params: TarProcessingParams): Promise<File> => {
  const { tarFile, setUploadProgress, setStatusMessage } = params;

  setStatusMessage({ step: 'analyzing_tar', message: 'Analyzing TAR archive...' });
  setUploadProgress(0);

  try {
    setStatusMessage({ step: 'extracting_tar', message: 'Extracting TAR archive...' });
    setUploadProgress(10);

    // Extract files from TAR
    const tarBuffer = await tarFile.arrayBuffer();
    const extractedFiles = extractTarFiles(tarBuffer);

    setUploadProgress(25);

    // Check if index.html already exists
    const hasIndex = tarHasIndexFile(extractedFiles);

    if (hasIndex) {
      setStatusMessage({ step: 'tar_ready', message: 'TAR archive ready for upload' });
      setUploadProgress(100);
      return tarFile;
    }

    setStatusMessage({
      step: 'generating_index',
      message: 'Generating index.html for TAR archive...',
    });
    setUploadProgress(40);

    // Create new TAR with all original files plus index.html
    const newTar = new Tar();

    // Generate and add index.html first
    const indexHtml = generateIndexHtmlForTar(extractedFiles, tarFile.name);
    const indexBuffer = new TextEncoder().encode(indexHtml);
    newTar.append('index.html', indexBuffer);

    setUploadProgress(60);
    setStatusMessage({
      step: 'repackaging_tar',
      message: 'Re-packaging TAR with original files...',
    });

    // Add all original files back to the TAR with normalized and TAR-compatible paths, excluding PAX headers
    let processedFiles = 0;
    for (const file of extractedFiles) {
      if (!file.isDirectory && !shouldFilterFile(file.name)) {
        const normalizedPath = normalizePath(file.name);
        const tarCompatiblePath = ensureTarCompatiblePath(normalizedPath);
        newTar.append(tarCompatiblePath, file.data);
      }
      processedFiles++;
      const progress = 60 + Math.round((processedFiles / extractedFiles.length) * 30);
      setUploadProgress(progress);
    }

    setUploadProgress(90);
    setStatusMessage({ step: 'finalizing_tar', message: 'Finalizing enhanced TAR archive...' });

    // Generate the new TAR file
    const newTarBuffer = newTar.out;

    if (!newTarBuffer || newTarBuffer.length === 0) {
      throw new Error('Failed to generate TAR buffer');
    }

    const processedFile = new File([newTarBuffer], tarFile.name, {
      type: 'application/x-tar',
      lastModified: Date.now(),
    });

    setUploadProgress(100);
    setStatusMessage({ step: 'tar_enhanced', message: 'TAR archive enhanced with index.html!' });

    return processedFile;
  } catch (error) {
    console.error('Error processing TAR file:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    setStatusMessage({ step: 'error', message: `Failed to process TAR: ${errorMessage}` });
    throw new Error(`Failed to process TAR file: ${errorMessage}`);
  }
};
