import { type PublicClient } from 'viem';
import { ExecutionStatus, UploadStep } from './types';
import { processArchiveFile } from './ArchiveProcessor';
import { StampInfo } from './types';
import { STORAGE_OPTIONS } from './constants';

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
 * Interface for parameters needed for multi-file upload function
 */
export interface MultiFileUploadParams {
  selectedFiles: File[];
  postageBatchId: string;
  walletClient: any;
  publicClient: PublicClient;
  address: `0x${string}` | undefined;
  beeApiUrl: string;
  serveUncompressed: boolean;
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
  setMultiFileResults: React.Dispatch<React.SetStateAction<MultiFileResult[]>>;
}

/**
 * Interface for multi-file upload results
 */
export interface MultiFileResult {
  filename: string;
  reference: string;
  success: boolean;
  error?: string;
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

/**
 * Handle multiple file uploads to the same stamp
 * @param params Parameters for multi-file upload
 * @returns Promise with array of upload results
 */
export const handleMultiFileUpload = async (
  params: MultiFileUploadParams
): Promise<MultiFileResult[]> => {
  const {
    selectedFiles,
    postageBatchId,
    walletClient,
    publicClient,
    address,
    beeApiUrl,
    serveUncompressed,
    setUploadProgress,
    setStatusMessage,
    setIsDistributing,
    setUploadStep,
    setSelectedDays,
    setShowOverlay,
    setIsLoading,
    setUploadStampInfo,
    saveUploadReference,
    setMultiFileResults,
  } = params;

  if (!selectedFiles.length || !postageBatchId || !walletClient || !publicClient) {
    console.error('Missing files, postage batch ID, or wallet');
    return [];
  }

  const isLocalhost = beeApiUrl.includes('localhost') || beeApiUrl.includes('127.0.0.1');
  const results: MultiFileResult[] = [];

  setUploadStep('uploading');
  setUploadProgress(0);

  // Initialize results array
  const initialResults = selectedFiles.map(file => ({
    filename: file.name,
    reference: '',
    success: false,
  }));
  setMultiFileResults(initialResults);

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
   * Upload a single file within the multi-file batch
   */
  const uploadSingleFile = async (
    file: File,
    fileIndex: number,
    totalFiles: number
  ): Promise<MultiFileResult> => {
    try {
      // Process archive files if needed
      let processedFile = file;
      const isArchive =
        file.type === 'application/zip' ||
        file.name.toLowerCase().endsWith('.zip') ||
        file.type === 'application/gzip' ||
        file.name.toLowerCase().endsWith('.gz');

      if (isArchive && serveUncompressed) {
        console.log(`Processing archive file ${file.name} before upload`);
        processedFile = await processArchiveFile(file);
        console.log('Archive processed, starting upload...');
      }

      const messageToSign = `${processedFile.name}:${postageBatchId}`;
      console.log(`Message to sign for ${processedFile.name}:`, messageToSign);

      const signedMessage = await walletClient.signMessage({
        message: messageToSign,
      });

      const baseHeaders: Record<string, string> = {
        'Content-Type': serveUncompressed && isArchive ? 'application/x-tar' : processedFile.type,
        'swarm-postage-batch-id': postageBatchId,
        'swarm-pin': 'false',
        'swarm-deferred-upload': 'false',
        'swarm-collection': serveUncompressed && isArchive ? 'true' : 'false',
      };

      if (!isLocalhost) {
        baseHeaders['x-upload-signed-message'] = signedMessage;
        baseHeaders['x-uploader-address'] = address as string;
        baseHeaders['x-file-name'] = processedFile.name;
        baseHeaders['x-message-content'] = messageToSign;
      }

      // Upload the file
      console.log(`Starting upload for file ${fileIndex + 1}/${totalFiles}: ${processedFile.name}`);

      const url = `${beeApiUrl}/bzz?name=${encodeURIComponent(processedFile.name)}`;
      const response = await fetch(url, {
        method: 'POST',
        headers: baseHeaders,
        body: processedFile,
      });

      if (!response.ok) {
        throw new Error(`Upload failed with status ${response.status}`);
      }

      const referenceData = await response.text();
      const parsedReference = JSON.parse(referenceData);

      console.log(`Upload successful for ${processedFile.name}, reference:`, parsedReference);

      return {
        filename: processedFile.name,
        reference: parsedReference.reference,
        success: true,
      };
    } catch (error) {
      console.error(`Upload error for ${file.name}:`, error);
      return {
        filename: file.name,
        reference: '',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  };

  try {
    // Wait for batch to be ready (same logic as single file upload)
    const waitForBatch = async (): Promise<void> => {
      const maxRetries404 = 50;
      const maxRetries422 = 50;
      const retryDelay404 = 3000;
      const retryDelay422 = 3000;

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

    // Upload all files
    console.log(`Starting upload of ${selectedFiles.length} files`);
    setStatusMessage({
      step: 'Uploading',
      message: `Uploading ${selectedFiles.length} files...`,
    });

    // Upload files sequentially to avoid overwhelming the API
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      const fileProgress = ((i + 1) / selectedFiles.length) * 100;

      setStatusMessage({
        step: 'Uploading',
        message: `Uploading file ${i + 1}/${selectedFiles.length}: ${file.name}`,
      });

      const result = await uploadSingleFile(file, i, selectedFiles.length);
      results.push(result);

      // Update results
      setMultiFileResults([...results]);

      // Update progress
      setUploadProgress(Math.min(99, fileProgress));

      // Save successful uploads to history immediately
      if (result.success && result.reference) {
        try {
          const stamp = await checkStampStatus(postageBatchId);
          saveUploadReference(result.reference, postageBatchId, stamp.batchTTL, result.filename);
        } catch (error) {
          console.error('Failed to save upload reference:', error);
        }
      }
    }

    setUploadProgress(100);
    setIsDistributing(false);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    // Update stamp info
    try {
      const stamp = await checkStampStatus(postageBatchId);

      const getSizeForDepth = (depth: number): string => {
        const option = STORAGE_OPTIONS.find(option => option.depth === depth);
        return option ? option.size : `${depth} (unknown size)`;
      };

      const totalSizeString = getSizeForDepth(stamp.depth);
      const utilizationPercent = stamp.utilization;

      setUploadStampInfo({
        ...stamp,
        totalSize: totalSizeString,
        usedSize: `${utilizationPercent.toFixed(1)}%`,
        remainingSize: `${(100 - utilizationPercent).toFixed(1)}%`,
        utilizationPercent: utilizationPercent,
      });
    } catch (error) {
      console.error('Failed to get stamp details:', error);
    }

    // Set final status message
    if (failureCount === 0) {
      setStatusMessage({
        step: 'Complete',
        message: `All ${successCount} files uploaded successfully!`,
        isSuccess: true,
      });
    } else if (successCount === 0) {
      setStatusMessage({
        step: 'Error',
        message: `All ${failureCount} files failed to upload`,
        isError: true,
      });
    } else {
      setStatusMessage({
        step: 'Complete',
        message: `${successCount} files uploaded successfully, ${failureCount} failed`,
        isSuccess: true,
      });
    }

    setUploadStep('complete');
    setSelectedDays(null);

    // Auto-close after 15 minutes
    setTimeout(() => {
      setUploadStep('idle');
      setShowOverlay(false);
      setIsLoading(false);
      setUploadProgress(0);
      setIsDistributing(false);
    }, 900000);

    return results;
  } catch (error) {
    console.error('Multi-file upload error:', error);
    setStatusMessage({
      step: 'Error',
      message: 'Multi-file upload failed',
      error: error instanceof Error ? error.message : 'Unknown error',
      isError: true,
    });
    setUploadStep('idle');
    setUploadProgress(0);
    setIsDistributing(false);
    return results;
  }
};
