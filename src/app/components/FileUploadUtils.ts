import { type PublicClient } from 'viem';
import { ExecutionStatus, UploadStep } from './types';
import { processArchiveFile } from './ArchiveProcessor';
import { StampInfo } from './types';
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS, STORAGE_OPTIONS } from './constants';

/**
 * Interface for parameters needed for file upload function
 */
export interface FileUploadParams {
  selectedFile: File;
  postageBatchId: string;
  walletClient: any; // Using any for WalletClient type to avoid import issues
  publicClient: PublicClient;
  address: `0x${string}` | undefined;
  beeApiUrl: string;
  serveUncompressed: boolean;
  isTarFile: boolean;
  isWebpageUpload: boolean;
  setUploadProgress: (progress: number) => void;
  setStatusMessage: (status: ExecutionStatus) => void;
  setIsDistributing: (isDistributing: boolean) => void;
  setUploadStep: React.Dispatch<React.SetStateAction<UploadStep>>;
  setSelectedDays: React.Dispatch<React.SetStateAction<number | null>>;
  setShowOverlay: React.Dispatch<React.SetStateAction<boolean>>;
  setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
  setUploadStampInfo: React.Dispatch<React.SetStateAction<StampInfo | null>>;
  saveUploadReference: (
    reference: string,
    postageBatchId: string,
    expiryDate: number,
    filename?: string
  ) => void;
}

/**
 * Check if a file is an archive based on its extension
 */
export const isArchiveFile = (filename?: string): boolean => {
  if (!filename) return false;
  const archiveExtensions = ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'];
  return archiveExtensions.some(ext => filename.toLowerCase().endsWith(ext));
};

/**
 * Interface for XHR upload response
 */
interface XHRResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

/**
 * Interface for Postage Stamp response
 */
interface StampResponse {
  batchID: string;
  utilization: number;
  usable: boolean;
  label: string;
  depth: number;
  amount: string;
  bucketDepth: number;
  blockNumber: number;
  immutableFlag: boolean;
  exists: boolean;
  batchTTL: number;
}

/**
 * Handle the file upload process
 * @param params Parameters for file upload
 * @returns Promise with the upload reference if successful
 */
export const handleFileUpload = async (params: FileUploadParams): Promise<string | null> => {
  const {
    selectedFile,
    postageBatchId,
    walletClient,
    publicClient,
    address,
    beeApiUrl,
    serveUncompressed,
    isTarFile,
    isWebpageUpload,
    setUploadProgress,
    setStatusMessage,
    setIsDistributing,
    setUploadStep,
    setSelectedDays,
    setShowOverlay,
    setIsLoading,
    setUploadStampInfo,
    saveUploadReference,
  } = params;

  if (!selectedFile || !postageBatchId || !walletClient || !publicClient) {
    console.error('Missing file, postage batch ID, or wallet');
    console.log('selectedFile', selectedFile);
    console.log('postageBatchId', postageBatchId);
    console.log('walletClient', walletClient);
    console.log('publicClient', publicClient);
    return null;
  }

  const isLocalhost = beeApiUrl.includes('localhost') || beeApiUrl.includes('127.0.0.1');
  setUploadStep('uploading');
  setUploadProgress(0);

  /**
   * Check the status of a postage stamp
   */
  const checkStampStatus = async (batchId: string): Promise<StampResponse> => {
    console.log(`Checking stamps status for batch ${batchId}`);
    const response = await fetch(`${beeApiUrl}/stamps/${batchId}`);
    const data = await response.json();
    console.log('Stamp status response:', data);
    return data;
  };

  /**
   * Upload a large file with progress monitoring
   */
  const uploadLargeFile = async (
    file: File,
    headers: Record<string, string>,
    baseUrl: string
  ): Promise<XHRResponse> => {
    console.log('Starting file upload...');

    // Add the filename as a query parameter
    const url = `${baseUrl}?name=${encodeURIComponent(file.name)}`;
    console.log('Upload URL with filename:', url);

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();

      xhr.open('POST', url);
      xhr.timeout = 3600000; // 1 hour timeout

      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          setUploadProgress(Math.min(99, percent));
          console.log('Upload progress:', percent);
          console.log(`Upload progress: ${percent.toFixed(1)}%`);

          if (percent === 100) {
            setIsDistributing(true);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
        }
        console.log(`Upload completed with status: ${xhr.status}`);
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          text: () => Promise.resolve(xhr.responseText),
        });
      };

      xhr.onerror = e => {
        console.error('XHR Error:', e);
        reject(new Error('Network request failed'));
      };

      xhr.ontimeout = () => {
        console.error('Upload timed out');
        reject(new Error('Upload timed out'));
      };

      console.log('Sending file:', file.name, file.size);
      xhr.send(file);
    });
  };

  try {
    // Check if it's an archive file that needs processing
    let processedFile = selectedFile;
    const isArchive =
      selectedFile.type === 'application/zip' ||
      selectedFile.name.toLowerCase().endsWith('.zip') ||
      selectedFile.type === 'application/gzip' ||
      selectedFile.name.toLowerCase().endsWith('.gz');

    // Only process if it's an archive AND serveUncompressed is checked
    if (isArchive && serveUncompressed) {
      setUploadProgress(0);
      console.log('Processing archive file before upload');
      processedFile = await processArchiveFile(selectedFile);
      console.log('Archive processed, starting upload...');
    }

    const messageToSign = `${processedFile.name}:${postageBatchId}`;
    console.log('Message to sign:', messageToSign);

    const signedMessage = await walletClient.signMessage({
      message: messageToSign, // Just sign the plain string directly
    });

    const baseHeaders: Record<string, string> = {
      'Content-Type':
        serveUncompressed && (isTarFile || isArchive) ? 'application/x-tar' : processedFile.type,
      'swarm-postage-batch-id': postageBatchId,
      'swarm-pin': 'false',
      'swarm-deferred-upload': 'false',
      'registry-address': GNOSIS_CUSTOM_REGISTRY_ADDRESS,
      'swarm-collection': serveUncompressed && (isTarFile || isArchive) ? 'true' : 'false',
    };

    if (!isLocalhost) {
      baseHeaders['x-upload-signed-message'] = signedMessage;
      baseHeaders['x-uploader-address'] = address as string;
      baseHeaders['x-file-name'] = processedFile.name;
      baseHeaders['x-message-content'] = messageToSign; // Send the original message for verification
    }

    if (isWebpageUpload && isTarFile) {
      baseHeaders['Swarm-Index-Document'] = 'index.html';
      baseHeaders['Swarm-Error-Document'] = 'error.html';
    }

    const waitForBatch = async (
      maxRetries404 = 50,
      maxRetries422 = 50,
      retryDelay404 = 3000,
      retryDelay422 = 3000
    ): Promise<void> => {
      // First wait for batch to exist
      for (let attempt404 = 1; attempt404 <= maxRetries404; attempt404++) {
        try {
          console.log(`Checking batch existence, attempt ${attempt404}/${maxRetries404}`);
          setStatusMessage({
            step: '404',
            message: 'Searching for storage ID...',
          });

          const stampStatus = await checkStampStatus(postageBatchId);

          if (stampStatus.exists) {
            console.log('Batch exists, checking usability');

            // Now wait for batch to become usable
            for (let attempt422 = 1; attempt422 <= maxRetries422; attempt422++) {
              console.log(`Checking batch usability, attempt ${attempt422}/${maxRetries422}`);
              setStatusMessage({
                step: '422',
                message: 'Waiting for storage to be usable...',
              });

              const usabilityStatus = await checkStampStatus(postageBatchId);

              if (usabilityStatus.usable) {
                console.log('Batch is usable, ready for upload');
                return;
              }

              console.log(`Batch not usable yet, waiting ${retryDelay422}ms before next attempt`);
              await new Promise(resolve => setTimeout(resolve, retryDelay422));
            }
            throw new Error('Batch never became usable after maximum retries');
          }

          console.log(`Batch not found, waiting ${retryDelay404}ms before next attempt`);
          await new Promise(resolve => setTimeout(resolve, retryDelay404));
        } catch (error) {
          console.error(`Error checking stamps status:`, error);
          if (attempt404 === maxRetries404) {
            throw new Error('Batch never found after maximum retries');
          }
          await new Promise(resolve => setTimeout(resolve, retryDelay404));
        }
      }
      throw new Error('Maximum retry attempts reached');
    };

    // Wait for batch to be ready
    await waitForBatch();

    // Once batch is ready, proceed with upload
    console.log('Starting actual file upload');
    setStatusMessage({
      step: 'Uploading',
      message: 'Uploading file...',
    });

    const uploadResponse = await uploadLargeFile(processedFile, baseHeaders, `${beeApiUrl}/bzz`);

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }

    const reference = await uploadResponse.text();
    const parsedReference = JSON.parse(reference);

    console.log('Upload successful, reference:', parsedReference);

    setStatusMessage({
      step: 'Complete',
      message: `Upload Successful. Reference: ${parsedReference.reference.slice(
        0,
        6
      )}...${parsedReference.reference.slice(-4)}`,
      isSuccess: true,
      reference: parsedReference.reference,
      filename: processedFile?.name,
    });

    setUploadStep('complete');
    setSelectedDays(null);
    setTimeout(() => {
      setUploadStep('idle');
      setShowOverlay(false);
      setIsLoading(false);
      setUploadProgress(0);
      setIsDistributing(false);
    }, 900000);

    if (parsedReference.reference) {
      try {
        const stamp = await checkStampStatus(postageBatchId);

        // Get the size string directly from STORAGE_OPTIONS mapping
        const getSizeForDepth = (depth: number): string => {
          const option = STORAGE_OPTIONS.find(option => option.depth === depth);
          return option ? option.size : `${depth} (unknown size)`;
        };

        // Get the human-readable total size from the options
        const totalSizeString = getSizeForDepth(stamp.depth);

        // Calculate the used and remaining sizes as percentages for display
        const utilizationPercent = stamp.utilization;

        // Update state with stamp info
        setUploadStampInfo({
          ...stamp,
          totalSize: totalSizeString,
          usedSize: `${utilizationPercent.toFixed(1)}%`,
          remainingSize: `${(100 - utilizationPercent).toFixed(1)}%`,
          utilizationPercent: utilizationPercent,
        });

        saveUploadReference(
          parsedReference.reference,
          postageBatchId,
          stamp.batchTTL,
          processedFile?.name
        );

        return parsedReference.reference;
      } catch (error) {
        console.error('Failed to get stamp details:', error);
      }
    }

    return parsedReference.reference;
  } catch (error) {
    console.error('Upload error:', error);
    setStatusMessage({
      step: 'Error',
      message: 'Upload failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      isError: true,
    });
    setUploadStep('idle');
    setUploadProgress(0);
    setIsDistributing(false);
    return null;
  }
};
