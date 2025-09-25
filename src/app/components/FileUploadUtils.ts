import { type PublicClient } from 'viem';
import { ExecutionStatus, UploadStep } from './types';
import { processArchiveFile, ArchiveProcessingResult } from './ArchiveProcessor';
import { StampInfo } from './types';
import {
  STORAGE_OPTIONS,
  UPLOAD_RETRY_CONFIG,
  FILE_SIZE_CONFIG,
  UPLOAD_TIMEOUT_CONFIG,
  SWARM_DEFERRED_UPLOAD,
} from './constants';
import { processTarFile, TarProcessingResult } from './FolderUploadUtils';
import { getStampUsage, formatDateEU } from './utils';

/**
 * Convert technical error messages to user-friendly ones
 */
export const getUserFriendlyErrorMessage = (error: Error): string => {
  const errorMessage = error.message.toLowerCase();

  // Check for non-Latin character encoding errors
  if (
    errorMessage.includes('iso-8859-1') ||
    errorMessage.includes('code point') ||
    errorMessage.includes('string contains non')
  ) {
    return 'Upload failed: File names must use only Latin characters (A-Z, 0-9). Please rename your files to remove special characters, emojis, or accented letters.';
  }

  // Check for other common upload errors
  if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
    return 'Upload failed: Network connection issue. Please check your internet connection and try again.';
  }

  if (errorMessage.includes('timeout')) {
    return 'Upload failed: Upload timed out. Please try again with a smaller file or check your connection.';
  }

  if (errorMessage.includes('file too large') || errorMessage.includes('size')) {
    return 'Upload failed: File is too large. Please try a smaller file.';
  }

  // Return original error for unrecognized errors
  return error.message;
};

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
  isFolderUpload?: boolean;
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
    filename?: string,
    isWebpageUpload?: boolean,
    fileSize?: number,
    isFolderUpload?: boolean
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
    filename?: string,
    isWebpageUpload?: boolean,
    fileSize?: number,
    isFolderUpload?: boolean
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
  isWebsite?: boolean; // Flag indicating this upload should be treated as a website
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
    isFolderUpload = false,
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
    return null;
  }

  const isLocalhost = beeApiUrl.includes('localhost') || beeApiUrl.includes('127.0.0.1');
  setUploadStep('uploading');
  setUploadProgress(0);

  /**
   * Check the status of a postage stamp
   */
  const checkStampStatus = async (batchId: string): Promise<StampResponse> => {
    const response = await fetch(`${beeApiUrl}/stamps/${batchId}`);
    return response.json();
  };

  /**
   * Upload a large file with progress monitoring and dynamic timeout handling
   */
  const uploadLargeFile = async (
    file: File,
    headers: Record<string, string>,
    baseUrl: string
  ): Promise<XHRResponse> => {
    // Add the filename as a query parameter
    const url = `${baseUrl}?name=${encodeURIComponent(file.name)}`;

    // Calculate dynamic timeout based on file size using configurable settings
    const fileSizeGB = file.size / (1024 * 1024 * 1024);
    const estimatedTimeMinutes = Math.max(
      UPLOAD_TIMEOUT_CONFIG.minTimeoutMinutes,
      Math.min(
        UPLOAD_TIMEOUT_CONFIG.maxTimeoutMinutes,
        fileSizeGB *
          (8 / UPLOAD_TIMEOUT_CONFIG.assumedUploadSpeedMbps) *
          60 *
          UPLOAD_TIMEOUT_CONFIG.timeoutBufferMultiplier
      )
    );
    const timeoutMs = estimatedTimeMinutes * 60 * 1000;

    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      let lastProgressTime = Date.now();
      let progressStalled = false;

      xhr.open('POST', url);
      xhr.timeout = timeoutMs;

      Object.entries(headers).forEach(([key, value]) => {
        xhr.setRequestHeader(key, value);
      });

      // Enhanced progress tracking with stall detection
      xhr.upload.onprogress = event => {
        if (event.lengthComputable) {
          const percent = (event.loaded / event.total) * 100;
          const currentTime = Date.now();

          // Check for progress stall (no progress for 5 minutes)
          if (percent > 0) {
            lastProgressTime = currentTime;
            progressStalled = false;
          } else if (currentTime - lastProgressTime > 300000) {
            // 5 minutes
            progressStalled = true;
            console.warn('Upload progress appears to be stalled');
          }

          setUploadProgress(Math.min(99, percent));

          if (percent >= 99) {
            setIsDistributing(true);
          }
        }
      };

      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          setUploadProgress(100);
        } else {
          console.error(`Upload failed with status: ${xhr.status}`);
        }
        resolve({
          ok: xhr.status >= 200 && xhr.status < 300,
          status: xhr.status,
          text: () => Promise.resolve(xhr.responseText),
        });
      };

      xhr.onerror = e => {
        console.error('XHR Error:', e);
        if (progressStalled) {
          reject(
            new Error(
              'Upload failed: Connection appears to be stalled. Please check your internet connection and try again.'
            )
          );
        } else {
          reject(
            new Error(
              'Upload failed: Network request failed. Please check your internet connection and try again.'
            )
          );
        }
      };

      xhr.ontimeout = () => {
        console.error(`Upload timed out after ${(timeoutMs / (1000 * 60)).toFixed(1)} minutes`);
        reject(
          new Error(
            `Upload timed out after ${(timeoutMs / (1000 * 60)).toFixed(1)} minutes. Large files may require a stable internet connection. Please try again.`
          )
        );
      };

      // Additional event handlers for better error reporting
      xhr.onabort = () => {
        console.error('Upload was aborted');
        reject(new Error('Upload was cancelled'));
      };

      // For very large files, show additional warnings
      if (fileSizeGB > FILE_SIZE_CONFIG.largeFileThresholdGB) {
        console.warn(
          `Large file detected (${fileSizeGB.toFixed(2)} GB). Upload may take ${estimatedTimeMinutes.toFixed(1)} minutes or more.`
        );
        setStatusMessage({
          step: 'Uploading',
          message: `Uploading large file (${fileSizeGB.toFixed(1)} GB). This may take ${estimatedTimeMinutes.toFixed(0)} minutes or more. Please keep this tab open.`,
        });
      }

      try {
        xhr.send(file);
      } catch (error) {
        console.error('Failed to start upload:', error);
        reject(new Error('Failed to start upload. The file may be too large or corrupted.'));
      }
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

    const isTarArchive =
      selectedFile.type === 'application/x-tar' || selectedFile.name.toLowerCase().endsWith('.tar');

    // Process TAR files - always upload as website with index.html check
    let shouldUploadAsWebsite = isWebpageUpload;
    let hasIndexFile = false;

    if (isTarArchive) {
      setUploadProgress(0);
      const tarResult = await processTarFile({
        tarFile: selectedFile,
        setUploadProgress,
        setStatusMessage,
      });
      processedFile = tarResult.file;
      hasIndexFile = tarResult.hasOrWillHaveIndex;
      shouldUploadAsWebsite = true;
    }
    // Process ZIP/GZ archives when serveUncompressed is enabled
    else if (isArchive && serveUncompressed) {
      setUploadProgress(0);
      const archiveResult = await processArchiveFile(selectedFile);
      processedFile = archiveResult.file;
      hasIndexFile = archiveResult.hasOrWillHaveIndex;
      shouldUploadAsWebsite = true;
    }

    const messageToSign = `${processedFile.name}:${postageBatchId}`;

    const signedMessage = await walletClient.signMessage({
      message: messageToSign, // Just sign the plain string directly
    });

    const baseHeaders: Record<string, string> = {
      'Content-Type':
        serveUncompressed && (isTarFile || isArchive) ? 'application/x-tar' : processedFile.type,
      'swarm-postage-batch-id': postageBatchId,
      'swarm-pin': 'false',
      'swarm-deferred-upload': SWARM_DEFERRED_UPLOAD,
      'swarm-collection': serveUncompressed && (isTarFile || isArchive) ? 'true' : 'false',
    };

    if (!isLocalhost) {
      baseHeaders['x-upload-signed-message'] = signedMessage;
      baseHeaders['x-uploader-address'] = address as string;
      baseHeaders['x-file-name'] = processedFile.name;
      baseHeaders['x-message-content'] = messageToSign; // Send the original message for verification
    }

    if (shouldUploadAsWebsite) {
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
            message: 'Waiting for storage to be usable...',
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

        // Calculate the real used capacity percentage
        const realUtilizationPercent = getStampUsage(
          stamp.utilization,
          stamp.depth,
          stamp.bucketDepth || 16
        );

        // Update state with stamp info
        setUploadStampInfo({
          ...stamp,
          totalSize: totalSizeString,
          usedSize: `${realUtilizationPercent.toFixed(1)}%`,
          remainingSize: `${(100 - realUtilizationPercent).toFixed(1)}%`,
          utilizationPercent: realUtilizationPercent,
          createdDate: formatDateEU(new Date()),
        });

        // Calculate expiry timestamp from batchTTL (which is in seconds)
        const expiryDate = Date.now() + stamp.batchTTL * 1000;

        saveUploadReference(
          parsedReference.reference,
          postageBatchId,
          expiryDate,
          processedFile?.name,
          shouldUploadAsWebsite || hasIndexFile, // Mark as website if it contains or will contain index.html
          selectedFile.size,
          isFolderUpload
        );

        return parsedReference.reference;
      } catch (error) {
        console.error('Failed to get stamp details:', error);
      }
    }

    return parsedReference.reference;
  } catch (error) {
    console.error('Upload error:', error);
    const friendlyError =
      error instanceof Error ? getUserFriendlyErrorMessage(error) : 'Unknown error';
    setStatusMessage({
      step: 'Error',
      message: 'Upload failed',
      error: friendlyError,
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
  let sessionToken: string | null = null; // Track session token for subsequent uploads
  const {
    selectedFiles,
    postageBatchId,
    walletClient,
    publicClient,
    address,
    beeApiUrl,
    serveUncompressed,
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
    setMultiFileResults,
  } = params;

  const isLocalhost = beeApiUrl.includes('localhost') || beeApiUrl.includes('127.0.0.1');

  const checkStampStatus = async (batchId: string): Promise<StampResponse> => {
    const response = await fetch(`${beeApiUrl}/stamps/${batchId}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return response.json();
  };

  const uploadSingleFile = async (
    file: File,
    fileIndex: number,
    totalFiles: number,
    retryCount: number = 0
  ): Promise<MultiFileResult> => {
    const maxRetries = UPLOAD_RETRY_CONFIG.maxRetries;

    // Initialize website flags outside try block so they're available in catch
    let shouldUploadAsWebsite = isWebpageUpload;
    let hasIndexFile = false;

    try {
      // Check if it's an archive file that needs processing
      let processedFile = file;
      const isArchive =
        file.type === 'application/zip' ||
        file.name.toLowerCase().endsWith('.zip') ||
        file.type === 'application/gzip' ||
        file.name.toLowerCase().endsWith('.gz');

      const isTarArchive =
        file.type === 'application/x-tar' || file.name.toLowerCase().endsWith('.tar');

      if (isTarArchive) {
        const tarResult = await processTarFile({
          tarFile: file,
          setUploadProgress: progress => {
            // For multi-file, we need to calculate the overall progress
            const overallProgress = (fileIndex / totalFiles + progress / 100 / totalFiles) * 100;
            setUploadProgress(overallProgress);
          },
          setStatusMessage,
        });
        processedFile = tarResult.file;
        hasIndexFile = tarResult.hasOrWillHaveIndex;
        shouldUploadAsWebsite = true;
      }
      // Process ZIP/GZ archives when serveUncompressed is enabled
      else if (isArchive && serveUncompressed) {
        const archiveResult = await processArchiveFile(file);
        processedFile = archiveResult.file;
        hasIndexFile = archiveResult.hasOrWillHaveIndex;
        shouldUploadAsWebsite = true;
      }

      const messageToSign = `${processedFile.name}:${postageBatchId}`;

      // Only sign message for the very first file
      let signedMessage = '';
      if (fileIndex === 0) {
        signedMessage = await walletClient.signMessage({
          message: messageToSign,
        });
      }

      const baseHeaders: Record<string, string> = {
        'Content-Type': serveUncompressed && isArchive ? 'application/x-tar' : processedFile.type,
        'swarm-postage-batch-id': postageBatchId,
        'swarm-pin': 'false',
        'swarm-deferred-upload': SWARM_DEFERRED_UPLOAD,
        'swarm-collection': serveUncompressed && isArchive ? 'true' : 'false',
      };

      // Add webpage headers if this should be uploaded as a website
      if (shouldUploadAsWebsite) {
        baseHeaders['Swarm-Index-Document'] = 'index.html';
        baseHeaders['Swarm-Error-Document'] = 'error.html';
      }

      if (!isLocalhost) {
        // For multi-file uploads, add session-related headers
        baseHeaders['x-multi-file-upload'] = 'true';
        baseHeaders['x-uploader-address'] = address as string;
        baseHeaders['x-file-name'] = processedFile.name;
        baseHeaders['x-message-content'] = messageToSign;

        if (fileIndex === 0) {
          // First file needs signature to create session
          console.log(`🔐 File ${fileIndex + 1}: Using signature to create session`);
          baseHeaders['x-upload-signed-message'] = signedMessage;
        } else if (sessionToken) {
          // Subsequent files use session token
          console.log(
            `🎫 File ${fileIndex + 1}: Using session token ${sessionToken.substring(0, 8)}...`
          );
          baseHeaders['x-upload-session-token'] = sessionToken;
        } else {
          // This shouldn't happen, but fallback to signature
          console.warn(
            `❌ File ${fileIndex + 1}: No session token available, falling back to signature (this should not happen)`
          );
          signedMessage = await walletClient.signMessage({
            message: messageToSign,
          });
          baseHeaders['x-upload-signed-message'] = signedMessage;
        }
      }

      // Upload the file using the enhanced upload function
      console.log(`Starting upload for file ${fileIndex + 1}/${totalFiles}: ${processedFile.name}`);

      // Create a simplified upload function for individual files in multi-upload
      const uploadResponse = await new Promise<XHRResponse>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const fileSizeGB = processedFile.size / (1024 * 1024 * 1024);

        // Calculate dynamic timeout using configurable settings
        const estimatedTimeMinutes = Math.max(
          UPLOAD_TIMEOUT_CONFIG.minTimeoutMinutes,
          Math.min(
            UPLOAD_TIMEOUT_CONFIG.maxTimeoutMinutes,
            fileSizeGB *
              (8 / UPLOAD_TIMEOUT_CONFIG.assumedUploadSpeedMbps) *
              60 *
              UPLOAD_TIMEOUT_CONFIG.timeoutBufferMultiplier
          )
        );
        const timeoutMs = estimatedTimeMinutes * 60 * 1000;

        const url = `${beeApiUrl}/bzz?name=${encodeURIComponent(processedFile.name)}`;

        xhr.open('POST', url);
        xhr.timeout = timeoutMs;

        Object.entries(baseHeaders).forEach(([key, value]) => {
          xhr.setRequestHeader(key, value);
        });

        let lastProgressTime = Date.now();

        xhr.upload.onprogress = event => {
          if (event.lengthComputable) {
            // For multi-file uploads, we update the overall progress differently
            const fileProgress = (event.loaded / event.total) * 100;
            const overallProgress = ((fileIndex + fileProgress / 100) / totalFiles) * 100;
            setUploadProgress(Math.min(99, overallProgress));

            const currentTime = Date.now();
            if (fileSizeGB > FILE_SIZE_CONFIG.enhancedLoggingThresholdGB) {
              const uploadedMB = (event.loaded / (1024 * 1024)).toFixed(1);
              const totalMB = (event.total / (1024 * 1024)).toFixed(1);
              console.log(
                `File ${fileIndex + 1}/${totalFiles} progress: ${fileProgress.toFixed(1)}% (${uploadedMB}/${totalMB} MB)`
              );
            }
            lastProgressTime = currentTime;
          }
        };

        xhr.onload = () => {
          // Check for session token in response headers (for first file)
          if (fileIndex === 0) {
            const newSessionToken = xhr.getResponseHeader('x-session-token');
            const sessionCreated = xhr.getResponseHeader('x-session-created');
            const sessionValid = xhr.getResponseHeader('x-session-valid');

            console.log('Response headers for first file:', {
              sessionToken: newSessionToken ? `${newSessionToken.substring(0, 8)}...` : 'none',
              sessionCreated,
              sessionValid,
            });

            if (newSessionToken && sessionCreated === 'true') {
              sessionToken = newSessionToken;
              console.log(
                `✅ Session token created for multi-file upload: ${sessionToken.substring(0, 8)}...`
              );
            } else {
              console.warn('❌ No session token received from server for first file');
            }
          } else {
            console.log(
              `File ${fileIndex + 1} uploaded using session token: ${sessionToken ? `${sessionToken.substring(0, 8)}...` : 'none'}`
            );
          }

          resolve({
            ok: xhr.status >= 200 && xhr.status < 300,
            status: xhr.status,
            text: () => Promise.resolve(xhr.responseText),
          });
        };

        xhr.onerror = () => {
          reject(new Error(`Network error uploading ${processedFile.name}`));
        };

        xhr.ontimeout = () => {
          reject(
            new Error(
              `Upload timeout for ${processedFile.name} after ${(timeoutMs / (1000 * 60)).toFixed(1)} minutes`
            )
          );
        };

        console.log(
          `Uploading file ${fileIndex + 1}/${totalFiles}: ${processedFile.name} (${(processedFile.size / (1024 * 1024)).toFixed(1)} MB)`
        );

        if (fileSizeGB > FILE_SIZE_CONFIG.largeFileThresholdGB / 2) {
          console.warn(`Large file in batch: ${processedFile.name} (${fileSizeGB.toFixed(2)} GB)`);
        }

        xhr.send(processedFile);
      });

      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }

      const referenceData = await uploadResponse.text();
      const parsedReference = JSON.parse(referenceData);

      console.log(`Upload successful for ${processedFile.name}, reference:`, parsedReference);

      return {
        filename: processedFile.name,
        reference: parsedReference.reference,
        success: true,
        isWebsite: shouldUploadAsWebsite || hasIndexFile, // Include website flag for saving reference
      };
    } catch (error) {
      console.error(`Upload error for ${file.name} (attempt ${retryCount + 1}):`, error);

      // Retry logic for failed uploads
      if (retryCount < maxRetries && error instanceof Error) {
        const isRetryableError = UPLOAD_RETRY_CONFIG.retryableErrors.some(errorType =>
          error.message.includes(errorType)
        );

        if (isRetryableError) {
          console.log(`Retrying upload for ${file.name} (${retryCount + 1}/${maxRetries})`);
          setStatusMessage({
            step: 'Uploading',
            message: `Retrying ${file.name} (attempt ${retryCount + 2}/${maxRetries + 1})...`,
          });

          // Wait before retrying (configurable delay)
          await new Promise(resolve => setTimeout(resolve, UPLOAD_RETRY_CONFIG.retryDelayMs));

          return uploadSingleFile(file, fileIndex, totalFiles, retryCount + 1);
        }
      }

      return {
        filename: file.name,
        reference: '',
        success: false,
        isWebsite: shouldUploadAsWebsite || hasIndexFile, // Include website flag even for errors
        error: error instanceof Error ? getUserFriendlyErrorMessage(error) : 'Unknown error',
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
            message: 'Waiting for storage to be usable...',
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

    // Validate inputs
    if (!selectedFiles.length || !postageBatchId || !walletClient || !publicClient) {
      console.error('Missing files, postage batch ID, or wallet');
      return [];
    }

    setUploadStep('uploading');
    setUploadProgress(0);

    // Initialize results array
    const initialResults = selectedFiles.map(file => ({
      filename: file.name,
      reference: '',
      success: false,
      isWebsite: false,
    }));
    setMultiFileResults(initialResults);

    // Wait for batch to be ready
    await waitForBatch();

    // Upload all files
    console.log(`Starting upload of ${selectedFiles.length} files`);
    setStatusMessage({
      step: 'Uploading',
      message: `Uploading ${selectedFiles.length} files...`,
    });

    // Upload files sequentially to avoid overwhelming the API
    const results: MultiFileResult[] = [];
    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      console.log(`Processing file ${i + 1}/${selectedFiles.length}: ${file.name}`);

      setStatusMessage({
        step: 'Uploading',
        message: `Uploading file ${i + 1}/${selectedFiles.length}: ${file.name}`,
      });

      const result = await uploadSingleFile(file, i, selectedFiles.length);
      results.push(result);

      // Update results in real-time
      setMultiFileResults([...results]);

      // Save successful uploads to history immediately
      if (result.success && result.reference) {
        // Calculate expiry date using stamp info
        try {
          const stampStatus = await checkStampStatus(postageBatchId);
          if (stampStatus.exists) {
            // Calculate size info
            const getSizeForDepth = (depth: number): string => {
              const sizes = [
                '8MB',
                '16MB',
                '32MB',
                '68MB',
                '137MB',
                '274MB',
                '549MB',
                '1.1GB',
                '2.2GB',
                '4.4GB',
                '8.8GB',
                '17.6GB',
                '35.1GB',
                '70.3GB',
                '140.6GB',
                '281.1GB',
                '562.3GB',
              ];
              return sizes[depth - 17] || `${Math.pow(2, depth - 17)} chunks`;
            };

            const totalSize = getSizeForDepth(stampStatus.depth);
            const realUtilizationPercent = getStampUsage(
              stampStatus.utilization,
              stampStatus.depth,
              stampStatus.bucketDepth || 16
            );
            const usedSizeBytes = (realUtilizationPercent / 100) * Math.pow(2, stampStatus.depth);
            const usedSize =
              usedSizeBytes < 1024
                ? `${usedSizeBytes} bytes`
                : `${(usedSizeBytes / 1024).toFixed(1)} KB`;

            const expiryDate = Date.now() + stampStatus.batchTTL * 1000;

            console.log(`Saving reference for ${result.filename}: ${result.reference}`);
            saveUploadReference(
              result.reference,
              postageBatchId,
              expiryDate,
              result.filename,
              result.isWebsite, // Use the website flag from the result
              file.size
            );

            setUploadStampInfo({
              batchID: stampStatus.batchID,
              utilization: stampStatus.utilization,
              usable: stampStatus.usable,
              depth: stampStatus.depth,
              amount: stampStatus.amount,
              bucketDepth: stampStatus.bucketDepth,
              exists: stampStatus.exists,
              batchTTL: stampStatus.batchTTL,
              totalSize,
              usedSize,
              remainingSize: `${(((100 - realUtilizationPercent) / 100) * Math.pow(2, stampStatus.depth)).toFixed(0)} chunks`,
              utilizationPercent: realUtilizationPercent,
              createdDate: formatDateEU(new Date()),
            });
          }
        } catch (stampError) {
          console.error('Error getting stamp info for history:', stampError);
          // Still save the reference even if we can't get stamp info
          const expiryDate = Date.now() + 30 * 24 * 60 * 60 * 1000; // Default 30 days
          saveUploadReference(
            result.reference,
            postageBatchId,
            expiryDate,
            result.filename,
            result.isWebsite, // Use the website flag from the result
            file.size
          );
        }
      }

      console.log(`File ${i + 1}/${selectedFiles.length} completed:`, result);
    }

    // Final progress and status updates
    setUploadProgress(100);
    setIsDistributing(false);

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.length - successCount;

    if (failureCount === 0) {
      setStatusMessage({
        step: 'Complete',
        message: `All ${results.length} files uploaded successfully!`,
      });
      setUploadStep('complete');
    } else if (successCount === 0) {
      setStatusMessage({
        step: 'Error',
        message: `All ${results.length} files failed to upload`,
        isError: true,
      });
      setUploadStep('idle');
    } else {
      setStatusMessage({
        step: 'Partial',
        message: `${successCount} files uploaded successfully, ${failureCount} failed`,
        isError: true,
      });
      setUploadStep('complete'); // Show results even with some failures
    }

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
    return [];
  }
};
