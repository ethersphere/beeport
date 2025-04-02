import pako from "pako";
import JSZip from "jszip";
import Tar from "tar-js";

const processZipFile = async (zipFile: File): Promise<File> => {
  console.log("Processing ZIP file:", zipFile.name);

  try {
    // Read and extract the ZIP file
    const jszip = new JSZip();
    const zipContents = await jszip.loadAsync(zipFile);

    // Create a TAR archive
    const tarball = new Tar();

    // Process each file in the ZIP
    const filePromises = Object.keys(zipContents.files).map(
      async (filename) => {
        const zipEntry = zipContents.files[filename];

        // Skip directories
        if (zipEntry.dir) return;

        // Get file content as ArrayBuffer
        const content = await zipEntry.async("arraybuffer");

        // Add to TAR
        tarball.append(filename, new Uint8Array(content));
        console.log(`Added to TAR: ${filename} (${content.byteLength} bytes)`);
      }
    );

    // Wait for all files to be processed
    await Promise.all(filePromises);

    // Generate the TAR file
    const tarBuffer = tarball.out;
    const baseName = zipFile.name.replace(/\.zip$/i, "");
    const tarFile = new File([tarBuffer], `${baseName}.tar`, {
      type: "application/x-tar",
      lastModified: new Date().getTime(),
    });

    console.log(`Created TAR file: ${tarFile.name} (${tarFile.size} bytes)`);
    return tarFile;
  } catch (error: unknown) {
    console.error("Error processing ZIP file:", error);
    // Handle unknown error type safely
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";
    throw new Error(`Failed to process ZIP file: ${errorMessage}`);
  }
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
