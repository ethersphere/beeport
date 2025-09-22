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
 * Generate a simple index.html file that lists all files with relative paths
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

    fileList.push(relativePath);
  }

  // Sort files alphabetically
  fileList.sort();

  const fileListHtml = fileList
    .map(path => `      <li><a href="${path}">${path}</a></li>`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>File Index - ${folderName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            line-height: 1.6;
        }
        h1 {
            color: #333;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        ul {
            list-style-type: none;
            padding: 0;
        }
        li {
            padding: 8px 0;
            border-bottom: 1px solid #f0f0f0;
        }
        a {
            color: #0066cc;
            text-decoration: none;
            font-weight: 500;
        }
        a:hover {
            text-decoration: underline;
        }
        .info {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 5px;
            margin-bottom: 20px;
            color: #666;
        }
    </style>
</head>
<body>
    <h1>Files in ${folderName}</h1>
    <div class="info">
        This is an automatically generated index page. Click on any file below to view it.
    </div>
    <ul>
${fileListHtml}
    </ul>
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

    console.log('Added generated index.html file to TAR archive');
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
      tarball.append(relativePath, new Uint8Array(fileData));

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

    console.log(`Created TAR file: ${archiveFile.name} (${archiveFile.size} bytes)`);
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

  console.log(`Selected folder: ${folderName} with ${files.length} files`);

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
