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

  // Add all files to the TAR archive, preserving folder structure
  for (let i = 0; i < files.length; i++) {
    const file = files[i];

    // Get the relative path from the folder root
    // webkitRelativePath includes the folder name, so we need to remove it
    const relativePath = file.webkitRelativePath.replace(`${folderName}/`, '');

    // Skip empty directories (they don't have content)
    if (file.size === 0 && relativePath.endsWith('/')) {
      continue;
    }

    try {
      const fileData = await file.arrayBuffer();
      tarball.append(relativePath, new Uint8Array(fileData));

      processedFiles++;
      const progress = Math.round((processedFiles / totalFiles) * 100);
      setUploadProgress(progress);

      setStatusMessage({
        step: 'creating_archive',
        message: `Processing files... ${processedFiles}/${totalFiles}`,
      });

      console.log(`Added to TAR: ${relativePath} (${fileData.byteLength} bytes)`);
    } catch (error) {
      console.error(`Error processing file ${file.name}:`, error);
      throw new Error(`Failed to process file: ${file.name}`);
    }
  }

  setStatusMessage({ step: 'generating_archive', message: 'Generating TAR archive...' });

  try {
    // Generate the TAR file
    const tarBuffer = tarball.out;
    const archiveFile = new File([tarBuffer], `${folderName}.tar`, {
      type: 'application/x-tar',
      lastModified: Date.now(),
    });

    setUploadProgress(100);
    setStatusMessage({ step: 'archive_ready', message: 'TAR archive created successfully!' });

    console.log(`Created TAR file: ${archiveFile.name} (${archiveFile.size} bytes)`);
    return archiveFile;
  } catch (error) {
    console.error('Error generating TAR archive:', error);
    throw new Error('Failed to create TAR archive');
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
    setStatusMessage({ step: 'error', message: `Failed to create archive: ${error.message}` });
    throw error;
  }
};
