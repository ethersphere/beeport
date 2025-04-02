import pako from "pako";

// Function to process ZIP files (assuming this exists elsewhere in your code)
const processZipFile = async (zipFile: File): Promise<File> => {
  // Your existing ZIP processing logic
  // This is a placeholder - you'll need to replace with your actual implementation
  console.log("Processing ZIP file:", zipFile.name);
  // Process ZIP file...
  return zipFile;
};

/**
 * Processes archive files (ZIP, GZIP) and returns a processed file ready for upload
 */
export const processArchiveFile = async (archiveFile: File): Promise<File> => {
  console.log("Processing archive file:", archiveFile.name);

  // Determine file type based on extension or MIME type
  const isZip =
    archiveFile.type === "application/zip" ||
    archiveFile.name.toLowerCase().endsWith(".zip");
  const isGzip =
    archiveFile.type === "application/gzip" ||
    archiveFile.name.toLowerCase().endsWith(".gz");

  try {
    // Read file as ArrayBuffer
    const fileBuffer = await archiveFile.arrayBuffer();
    const fileData = new Uint8Array(fileBuffer);
    let decompressedData: Uint8Array;
    let baseName: string;

    // Process based on file type
    if (isZip) {
      // Use existing ZIP processing
      return processZipFile(archiveFile);
    } else if (isGzip) {
      // Use pako to decompress gzip
      decompressedData = pako.inflate(fileData);
      baseName = archiveFile.name.replace(/\.t(ar\.)?gz$/i, "");
    } else {
      throw new Error(
        "Unsupported archive format. Currently supporting ZIP and GZIP only."
      );
    }

    // For GZ, we assume they contain TAR data
    // Create a new file with decompressed data
    const tarFile = new File([decompressedData], `${baseName}.tar`, {
      type: "application/x-tar",
      lastModified: new Date().getTime(),
    });

    console.log(`Decompressed file: ${tarFile.name} (${tarFile.size} bytes)`);
    return tarFile;
  } catch (error: unknown) {
    console.error("Error processing archive file:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to process archive: ${errorMessage}`);
  }
};
