import { processArchiveFile } from "./ArchiveProcessor";
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS } from "./constants";
import { ExecutionStatus, UploadStep } from "./types";

export interface XHRResponse {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
}

export interface StampResponse {
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

export interface FileUploadContext {
  selectedFile: File | null;
  postageBatchId: string;
  beeApiUrl: string;
  address: string | undefined;
  isWebpageUpload: boolean;
  isTarFile: boolean;
  serveUncompressed: boolean;
  walletClient: any;
  publicClient: any;
  setUploadStep: (step: UploadStep) => void;
  setUploadProgress: (progress: number) => void;
  setIsDistributing: (isDistributing: boolean) => void;
  setStatusMessage: (message: ExecutionStatus) => void;
  setIsLoading: (isLoading: boolean) => void;
  setShowOverlay: (showOverlay: boolean) => void;
  setSelectedDays: (days: number | null) => void;
}

/**
 * Checks if a filename has an archive extension
 */
export const isArchiveFile = (filename?: string): boolean => {
  if (!filename) return false;
  const archiveExtensions = [".zip", ".tar", ".gz", ".rar", ".7z", ".bz2"];
  return archiveExtensions.some((ext) =>
    filename.toLowerCase().endsWith(ext)
  );
};

/**
 * Checks the status of a postage stamp
 */
export const checkStampStatus = async (
  batchId: string,
  beeApiUrl: string
): Promise<StampResponse> => {
  console.log(`Checking stamps status for batch ${batchId}`);
  const response = await fetch(`${beeApiUrl}/stamps/${batchId}`);
  const data = await response.json();
  console.log("Stamp status response:", data);
  return data;
};

/**
 * Uploads a large file using XMLHttpRequest with progress tracking
 */
export const uploadLargeFile = async (
  file: File,
  headers: Record<string, string>,
  baseUrl: string,
  setUploadProgress: (progress: number) => void,
  setIsDistributing: (isDistributing: boolean) => void
): Promise<XHRResponse> => {
  console.log("Starting file upload...");

  // Add the filename as a query parameter
  const url = `${baseUrl}?name=${encodeURIComponent(file.name)}`;
  console.log("Upload URL with filename:", url);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    xhr.open("POST", url);
    xhr.timeout = 3600000; // 1 hour timeout

    Object.entries(headers).forEach(([key, value]) => {
      xhr.setRequestHeader(key, value);
    });

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        const percent = (event.loaded / event.total) * 100;
        setUploadProgress(Math.min(99, percent));
        console.log("Upload progress:", percent);
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

    xhr.onerror = (e) => {
      console.error("XHR Error:", e);
      reject(new Error("Network request failed"));
    };

    xhr.ontimeout = () => {
      console.error("Upload timed out");
      reject(new Error("Upload timed out"));
    };

    console.log("Sending file:", file.name, file.size);
    xhr.send(file);
  });
};

/**
 * Saves upload reference to local storage
 */
export const saveUploadReference = (
  reference: string,
  postageBatchId: string,
  expiryDate: number,
  filename?: string,
  address?: string
) => {
  if (!address) return;

  const savedHistory = localStorage.getItem("uploadHistory");
  const history = savedHistory ? JSON.parse(savedHistory) : {};

  const addressHistory = history[address] || [];
  addressHistory.unshift({
    reference,
    timestamp: Date.now(),
    filename,
    stampId: postageBatchId,
    expiryDate,
  });

  history[address] = addressHistory;
  localStorage.setItem("uploadHistory", JSON.stringify(history));
};

/**
 * Waits for a batch to be ready before upload
 */
export const waitForBatch = async (
  postageBatchId: string,
  beeApiUrl: string,
  maxRetries404 = 50,
  maxRetries422 = 50,
  retryDelay404 = 3000,
  retryDelay422 = 500
): Promise<void> => {
  let retries404 = 0;
  let retries422 = 0;

  while (retries404 < maxRetries404 && retries422 < maxRetries422) {
    try {
      console.log(`Checking stamp ${postageBatchId}, attempt ${retries404 + 1}`);
      const stampStatus = await checkStampStatus(postageBatchId, beeApiUrl);
      
      if (stampStatus && stampStatus.usable) {
        console.log("Stamp is usable, proceeding with upload");
        return;
      }
      
      // Check why stamp is not usable
      if (!stampStatus.exists) {
        console.log("Stamp doesn't exist, retrying...");
        retries404++;
        await new Promise(resolve => setTimeout(resolve, retryDelay404));
      } else if (stampStatus.utilization >= 1) {
        throw new Error("Stamp is full, cannot use for upload");
      } else {
        console.log("Stamp not ready, retrying...");
        retries422++;
        await new Promise(resolve => setTimeout(resolve, retryDelay422));
      }
    } catch (error) {
      console.error("Error waiting for batch:", error);
      throw error;
    }
  }

  throw new Error("Maximum retries reached waiting for stamp to be ready");
};

/**
 * Main file upload handler that manages the entire upload process
 */
export const handleFileUpload = async (context: FileUploadContext): Promise<void> => {
  const {
    selectedFile,
    postageBatchId,
    beeApiUrl,
    address,
    isWebpageUpload,
    isTarFile,
    serveUncompressed,
    walletClient,
    publicClient,
    setUploadStep,
    setUploadProgress,
    setIsDistributing,
    setStatusMessage,
    setIsLoading,
    setShowOverlay,
    setSelectedDays
  } = context;

  if (!selectedFile || !postageBatchId || !walletClient || !publicClient) {
    console.error("Missing file, postage batch ID, or wallet");
    console.log("selectedFile", selectedFile);
    console.log("postageBatchId", postageBatchId);
    console.log("walletClient", walletClient);
    console.log("publicClient", publicClient);
    return;
  }

  const isLocalhost =
    beeApiUrl.includes("localhost") || beeApiUrl.includes("127.0.0.1");
  setUploadStep("uploading");
  setUploadProgress(0);

  try {
    // Check if it's an archive file that needs processing
    let processedFile = selectedFile;
    const isArchive =
      selectedFile.type === "application/zip" ||
      selectedFile.name.toLowerCase().endsWith(".zip") ||
      selectedFile.type === "application/gzip" ||
      selectedFile.name.toLowerCase().endsWith(".gz");

    // Only process if it's an archive AND serveUncompressed is checked
    if (isArchive && serveUncompressed) {
      setUploadProgress(0);
      console.log("Processing archive file before upload");
      processedFile = await processArchiveFile(selectedFile);
      console.log("Archive processed, starting upload...");
    }

    const messageToSign = `${processedFile.name}:${postageBatchId}`;
    console.log("Message to sign:", messageToSign);

    const signedMessage = await walletClient.signMessage({
      message: messageToSign, // Just sign the plain string directly
    });

    const baseHeaders: Record<string, string> = {
      "Content-Type":
        serveUncompressed && (isTarFile || isArchive)
          ? "application/x-tar"
          : processedFile.type,
      "swarm-postage-batch-id": postageBatchId,
      "swarm-pin": "false",
      "swarm-deferred-upload": "false",
      "registry-address": GNOSIS_CUSTOM_REGISTRY_ADDRESS,
      "swarm-collection":
        serveUncompressed && (isTarFile || isArchive) ? "true" : "false",
    };

    if (!isLocalhost) {
      baseHeaders["x-upload-signed-message"] = signedMessage;
      baseHeaders["x-uploader-address"] = address as string;
      baseHeaders["x-file-name"] = processedFile.name;
      baseHeaders["x-message-content"] = messageToSign; // Send the original message for verification
    }

    if (isWebpageUpload && isTarFile) {
      baseHeaders["Swarm-Index-Document"] = "index.html";
      baseHeaders["Swarm-Error-Document"] = "error.html";
    }

    // Wait for batch to be ready
    await waitForBatch(postageBatchId, beeApiUrl);

    // Once batch is ready, proceed with upload
    console.log("Starting actual file upload");
    setStatusMessage({
      step: "Uploading",
      message: "Uploading file...",
    });

    const uploadResponse = await uploadLargeFile(
      processedFile,
      baseHeaders,
      `${beeApiUrl}/bzz`,
      setUploadProgress,
      setIsDistributing
    );

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed with status ${uploadResponse.status}`);
    }

    const reference = await uploadResponse.text();
    const parsedReference = JSON.parse(reference);

    console.log("Upload successful, reference:", parsedReference);

    setStatusMessage({
      step: "Complete",
      message: `Upload Successful. Reference: ${parsedReference.reference.slice(
        0,
        6
      )}...${parsedReference.reference.slice(-4)}`,
      isSuccess: true,
      reference: parsedReference.reference,
      filename: processedFile?.name,
    });

    setUploadStep("complete");
    setSelectedDays(null);
    setTimeout(() => {
      setUploadStep("idle");
      setShowOverlay(false);
      setIsLoading(false);
      setUploadProgress(0);
      setIsDistributing(false);
    }, 900000);

    if (parsedReference.reference) {
      const stamp = await checkStampStatus(postageBatchId, beeApiUrl);
      saveUploadReference(
        parsedReference.reference,
        postageBatchId,
        stamp.batchTTL,
        processedFile?.name,
        address
      );
    }
  } catch (error) {
    console.error("Upload error:", error);
    setStatusMessage({
      step: "Error",
      message: "Upload failed",
      error: error instanceof Error ? error.message : "Unknown error",
      isError: true,
    });
    setUploadStep("idle");
    setUploadProgress(0);
    setIsDistributing(false);
  }
};

export default {
  isArchiveFile,
  checkStampStatus,
  uploadLargeFile,
  saveUploadReference,
  waitForBatch,
  handleFileUpload
};
