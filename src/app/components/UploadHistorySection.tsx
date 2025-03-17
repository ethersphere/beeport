import React from "react";
import styles from "./css/UploadHistorySection.module.css";
import { DEFAULT_BEE_API_URL } from "./constants";

interface UploadHistoryProps {
  address: string | undefined;
  setShowUploadHistory: (show: boolean) => void;
}

interface UploadRecord {
  reference: string;
  timestamp: number;
  filename?: string;
  stampId: string;
  expiryDate: number;
}

interface UploadHistory {
  [address: string]: UploadRecord[];
}

const UploadHistorySection: React.FC<UploadHistoryProps> = ({
  address,
  setShowUploadHistory,
}) => {
  const [history, setHistory] = React.useState<UploadRecord[]>([]);

  const formatStampId = (stampId: string) => {
    if (!stampId || typeof stampId !== "string" || stampId.length < 10) {
      return stampId || "Invalid Stamp ID";
    }
    return `${stampId.slice(0, 6)}...${stampId.slice(-4)}`;
  };

  const formatReference = (reference: string) => {
    if (!reference || typeof reference !== "string" || reference.length < 10) {
      return reference || "Invalid Reference";
    }
    return `${reference.slice(0, 6)}...${reference.slice(-4)}`;
  };

  React.useEffect(() => {
    if (address) {
      const savedHistory = localStorage.getItem("uploadHistory");
      if (savedHistory) {
        const parsedHistory: UploadHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory[address] || []);
      }
    }
  }, [address]);

  const formatDate = (timestamp: number) => {
    if (timestamp === undefined) return "Unknown";
    return new Date(timestamp).toLocaleDateString();
  };

  const formatExpiryDays = (ttl: number) => {
    return `${Math.floor(ttl / 86400)} days`;
  };

  const isArchiveFile = (filename?: string) => {
    if (!filename) return false;
    const archiveExtensions = [".zip", ".tar", ".gz", ".rar", ".7z", ".bz2"];
    return archiveExtensions.some((ext) =>
      filename.toLowerCase().endsWith(ext)
    );
  };

  const getReferenceUrl = (record: UploadRecord) => {
    // Check if DEFAULT_BEE_API_URL already contains /bzz/
    const baseUrl = DEFAULT_BEE_API_URL.endsWith("/bzz/")
      ? DEFAULT_BEE_API_URL.slice(0, -5)
      : DEFAULT_BEE_API_URL;

    // For non-archive files with a filename, include the filename in the URL
    if (record.filename && !isArchiveFile(record.filename)) {
      return `${baseUrl}/bzz/${record.reference}/${record.filename}`;
    }
    // Otherwise use the default URL for the reference
    return `${baseUrl}/bzz/${record.reference}/`;
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>Upload History</h2>

      {history.length === 0 ? (
        <div className={styles.emptyState}>
          No uploads found for this address
        </div>
      ) : (
        <div className={styles.historyList}>
          {history.map((record, index) => (
            <div key={index} className={styles.historyItem}>
              <div className={styles.itemHeader}>
                <span className={styles.filename}>
                  {record.filename || "Unnamed upload"}
                </span>
                <span className={styles.date}>
                  {formatDate(record.timestamp)}
                </span>
              </div>
              <div className={styles.itemDetails}>
                <div className={styles.referenceRow}>
                  <span className={styles.label}>Reference:</span>
                  <a
                    href={getReferenceUrl(record)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.link}
                    title={record.reference}
                  >
                    {formatReference(record.reference)}
                    {record.filename && !isArchiveFile(record.filename)
                      ? `/${record.filename}`
                      : ""}
                  </a>
                </div>
                <div className={styles.stampRow}>
                  <span className={styles.label}>Stamp ID:</span>
                  <span className={styles.stampId} title={record.stampId}>
                    {formatStampId(record.stampId)}
                  </span>
                </div>
                <div className={styles.expiryRow}>
                  <span className={styles.label}>Expires:</span>
                  <span className={styles.expiryDate}>
                    {formatExpiryDays(record.expiryDate)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        className={styles.backButton}
        onClick={() => setShowUploadHistory(false)}
      >
        Back
      </button>
    </div>
  );
};

export default UploadHistorySection;
