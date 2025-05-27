import React from 'react';
import styles from './css/UploadHistorySection.module.css';
import { BEE_GATEWAY_URL } from './constants';

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

const UploadHistorySection: React.FC<UploadHistoryProps> = ({ address, setShowUploadHistory }) => {
  const [history, setHistory] = React.useState<UploadRecord[]>([]);

  const formatStampId = (stampId: string) => {
    if (!stampId || typeof stampId !== 'string' || stampId.length < 10) {
      return stampId || 'Invalid Stamp ID';
    }
    return `${stampId.slice(0, 6)}...${stampId.slice(-4)}`;
  };

  const formatReference = (reference: string) => {
    if (!reference || typeof reference !== 'string' || reference.length < 10) {
      return reference || 'Invalid Reference';
    }
    return `${reference.slice(0, 6)}...${reference.slice(-4)}`;
  };

  React.useEffect(() => {
    if (address) {
      const savedHistory = localStorage.getItem('uploadHistory');
      if (savedHistory) {
        const parsedHistory: UploadHistory = JSON.parse(savedHistory);
        setHistory(parsedHistory[address] || []);
      }
    }
  }, [address]);

  const formatDate = (timestamp: number) => {
    if (timestamp === undefined) return 'Unknown';
    return new Date(timestamp).toLocaleDateString();
  };

  const formatExpiryDays = (ttl: number) => {
    return `${Math.floor(ttl / 86400)} days`;
  };

  const isArchiveFile = (filename?: string) => {
    if (!filename) return false;
    const archiveExtensions = ['.zip', '.tar', '.gz', '.rar', '.7z', '.bz2'];
    return archiveExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  };

  const getReferenceUrl = (record: UploadRecord) => {
    // For non-archive files with a filename, include the filename in the URL
    if (record.filename && !isArchiveFile(record.filename)) {
      return `${BEE_GATEWAY_URL}${record.reference}/${record.filename}`;
    }
    // Otherwise use the default URL for the reference
    return `${BEE_GATEWAY_URL}${record.reference}/`;
  };

  const downloadCSV = () => {
    if (history.length === 0) return;

    // CSV headers
    const headers = [
      'Reference',
      'Stamp ID',
      'Date Created',
      'Expiry (Days)',
      'Filename',
      'Full Link',
    ];

    // Convert history data to CSV rows
    const csvRows = history.map(record => [
      record.reference,
      record.stampId,
      formatDate(record.timestamp),
      formatExpiryDays(record.expiryDate),
      record.filename || 'Unnamed upload',
      getReferenceUrl(record),
    ]);

    // Combine headers and data
    const csvContent = [headers, ...csvRows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    // Create and download the file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `upload-history-${address?.slice(0, 8)}-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h2 className={styles.title}>Upload History</h2>
        {history.length > 0 && (
          <button className={styles.downloadButton} onClick={downloadCSV} title="Download CSV">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7,10 12,15 17,10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          </button>
        )}
      </div>

      {history.length === 0 ? (
        <div className={styles.emptyState}>No uploads found for this address</div>
      ) : (
        <div className={styles.historyList}>
          {history.map((record, index) => (
            <div key={index} className={styles.historyItem}>
              <div className={styles.itemHeader}>
                <span className={styles.filename}>{record.filename || 'Unnamed upload'}</span>
                <span className={styles.date}>{formatDate(record.timestamp)}</span>
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
                      : ''}
                  </a>
                </div>
                <div className={styles.stampRow}>
                  <span className={styles.label}>Stamps ID:</span>
                  <span
                    className={styles.stampId}
                    title={record.stampId}
                    onClick={() => {
                      navigator.clipboard.writeText(record.stampId);
                      // Show temporary "Copied!" message
                      const element = document.querySelector(`[data-stamp-id="${record.stampId}"]`);
                      if (element) {
                        element.setAttribute('data-copied', 'true');
                        setTimeout(() => {
                          element.setAttribute('data-copied', 'false');
                        }, 2000);
                      }
                    }}
                    data-stamp-id={record.stampId}
                    data-copied="false"
                  >
                    {formatStampId(record.stampId)}
                  </span>
                </div>
                <div className={styles.expiryRow}>
                  <span className={styles.label}>Expires:</span>
                  <span className={styles.expiryDate}>{formatExpiryDays(record.expiryDate)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button className={styles.backButton} onClick={() => setShowUploadHistory(false)}>
        Back
      </button>
    </div>
  );
};

export default UploadHistorySection;
