import JSZip from 'jszip';
import Tar from 'tar-js';
import { SWARM_DEFERRED_UPLOAD } from './constants';

export interface NFTCollectionResult {
  imagesReference: string;
  metadataReference: string;
  totalImages: number;
  totalMetadata: number;
}

export interface NFTCollectionProcessorParams {
  zipFile: File;
  postageBatchId: string;
  walletClient: any;
  publicClient: any;
  address: `0x${string}` | undefined;
  beeApiUrl: string;
  setProgress: (progress: number) => void;
  setStatusMessage: (message: string) => void;
}

/**
 * Process NFT collection ZIP file and upload both images and metadata
 */
export const processNFTCollection = async (
  params: NFTCollectionProcessorParams
): Promise<NFTCollectionResult> => {
  const {
    zipFile,
    postageBatchId,
    walletClient,
    publicClient,
    address,
    beeApiUrl,
    setProgress,
    setStatusMessage,
  } = params;

  setStatusMessage('Extracting NFT collection...');
  setProgress(10);

  // Load and extract ZIP file
  const jszip = new JSZip();
  const zipContents = await jszip.loadAsync(zipFile);

  // Separate images and JSON files
  const imageFiles: { [key: string]: Uint8Array } = {};
  const jsonFiles: { [key: string]: string } = {};

  // Process all files in the ZIP
  for (const [filename, zipEntry] of Object.entries(zipContents.files)) {
    if (zipEntry.dir) continue; // Skip directories

    // Determine if file is in images or json folder
    const pathParts = filename.split('/');
    if (pathParts.length < 2) continue; // Skip files not in folders

    const folderName = pathParts[0].toLowerCase();
    const fileName = pathParts[pathParts.length - 1]; // Get just the filename

    if (folderName === 'images') {
      // Process image files
      const content = await zipEntry.async('arraybuffer');
      imageFiles[fileName] = new Uint8Array(content);
    } else if (folderName === 'json') {
      // Process JSON files
      const content = await zipEntry.async('string');
      jsonFiles[fileName] = content;
    }
  }

  console.log(
    `Found ${Object.keys(imageFiles).length} images and ${Object.keys(jsonFiles).length} JSON files`
  );

  if (Object.keys(imageFiles).length === 0) {
    throw new Error('No images found in the images folder');
  }

  if (Object.keys(jsonFiles).length === 0) {
    throw new Error('No JSON metadata files found in the json folder');
  }

  // Step 1: Create TAR with images (without subfolder)
  setStatusMessage('Creating images archive...');
  setProgress(20);

  const imagesTar = new Tar();
  Object.entries(imageFiles).forEach(([filename, content]) => {
    imagesTar.append(filename, content);
  });

  const imagesTarFile = new File([imagesTar.out], 'images.tar', {
    type: 'application/x-tar',
    lastModified: new Date().getTime(),
  });

  // Step 2: Upload images TAR
  setStatusMessage('Uploading images...');
  setProgress(30);

  const imagesReference = await uploadFile(imagesTarFile, {
    postageBatchId,
    walletClient,
    publicClient,
    address,
    beeApiUrl,
  });

  console.log('Images uploaded with reference:', imagesReference);

  // Step 3: Modify JSON files to use the bzz.link URL format
  setStatusMessage('Processing metadata...');
  setProgress(60);

  const modifiedJsonFiles: { [key: string]: string } = {};

  Object.entries(jsonFiles).forEach(([filename, content]) => {
    try {
      const metadata = JSON.parse(content);

      // Look for image property and update it
      if (metadata.image) {
        // Extract the image filename from the original image path
        const originalImagePath = metadata.image;
        let imageName = originalImagePath;

        // Handle various formats of image references
        if (originalImagePath.includes('/')) {
          imageName = originalImagePath.split('/').pop();
        }

        // Create the new bzz.link URL
        metadata.image = `https://bzz.link/bzz/${imagesReference}/${imageName}`;
      }

      // Handle other common NFT metadata image fields
      if (metadata.image_url) {
        const originalImagePath = metadata.image_url;
        let imageName = originalImagePath;
        if (originalImagePath.includes('/')) {
          imageName = originalImagePath.split('/').pop();
        }
        metadata.image_url = `https://bzz.link/bzz/${imagesReference}/${imageName}`;
      }

      modifiedJsonFiles[filename] = JSON.stringify(metadata, null, 2);
    } catch (error) {
      console.error(`Error processing JSON file ${filename}:`, error);
      // Keep original content if parsing fails
      modifiedJsonFiles[filename] = content;
    }
  });

  // Step 4: Create TAR with modified JSON files (without subfolder)
  setStatusMessage('Creating metadata archive...');
  setProgress(80);

  const metadataTar = new Tar();
  Object.entries(modifiedJsonFiles).forEach(([filename, content]) => {
    metadataTar.append(filename, new TextEncoder().encode(content));
  });

  const metadataTarFile = new File([metadataTar.out], 'metadata.tar', {
    type: 'application/x-tar',
    lastModified: new Date().getTime(),
  });

  // Step 5: Upload metadata TAR
  setStatusMessage('Uploading metadata...');
  setProgress(90);

  const metadataReference = await uploadFile(metadataTarFile, {
    postageBatchId,
    walletClient,
    publicClient,
    address,
    beeApiUrl,
  });

  console.log('Metadata uploaded with reference:', metadataReference);

  setProgress(100);
  setStatusMessage('NFT collection upload complete!');

  return {
    imagesReference,
    metadataReference,
    totalImages: Object.keys(imageFiles).length,
    totalMetadata: Object.keys(jsonFiles).length,
  };
};

/**
 * Upload a file to Swarm
 */
const uploadFile = async (
  file: File,
  params: {
    postageBatchId: string;
    walletClient: any;
    publicClient: any;
    address: `0x${string}` | undefined;
    beeApiUrl: string;
  }
): Promise<string> => {
  const { postageBatchId, walletClient, address, beeApiUrl } = params;

  const isLocalhost = beeApiUrl.includes('localhost') || beeApiUrl.includes('127.0.0.1');

  // Sign message for upload authorization
  const messageToSign = `${file.name}:${postageBatchId}`;

  // Helper function to sign with timeout
  const signWithTimeout = async (message: string, timeoutMs: number = 5000): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WALLET_UNLOCK_REQUIRED'));
      }, timeoutMs);

      try {
        const signature = await walletClient.signMessage({ message });
        clearTimeout(timeout);
        resolve(signature);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  };

  let signedMessage: string;
  try {
    signedMessage = await signWithTimeout(messageToSign);
  } catch (error: any) {
    if (error.message === 'WALLET_UNLOCK_REQUIRED') {
      throw new Error('Wallet unlock required - please unlock your wallet and try again');
    }
    throw error;
  }

  // Setup headers
  const headers: Record<string, string> = {
    'Content-Type': 'application/x-tar',
    'swarm-postage-batch-id': postageBatchId,
    'swarm-pin': 'false',
    'swarm-deferred-upload': SWARM_DEFERRED_UPLOAD,
    'swarm-collection': 'true',
  };

  if (!isLocalhost) {
    headers['x-upload-signed-message'] = signedMessage;
    headers['x-uploader-address'] = address as string;
    headers['x-file-name'] = file.name;
    headers['x-message-content'] = messageToSign;
  }

  // Upload using XMLHttpRequest for better control
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const url = `${beeApiUrl}/bzz?name=${encodeURIComponent(file.name)}`;

    xhr.open('POST', url);
    xhr.timeout = 10 * 60 * 1000; // 10 minute timeout

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response.reference);
        } catch (error) {
          reject(new Error('Invalid response format'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during upload'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Upload timeout'));
    };

    xhr.send(file);
  });
};
