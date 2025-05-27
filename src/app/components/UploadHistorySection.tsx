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

  const uploadCSV = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !address) return;

    const reader = new FileReader();
    reader.onload = e => {
      try {
        const csvContent = e.target?.result as string;
        const lines = csvContent.split('\n');

        // Skip header row and filter out empty lines
        const dataLines = lines.slice(1).filter(line => line.trim());

        const newRecords: UploadRecord[] = [];
        const existingReferences = new Set(history.map(record => record.reference));

        dataLines.forEach(line => {
          // Parse CSV line (handle quoted fields)
          const fields = line.split(',').map(field => field.replace(/^"|"$/g, '').trim());

          if (fields.length >= 6) {
            const [reference, stampId, dateCreated, expiryDays, filename, fullLink] = fields;

            // Skip if reference already exists (prevent duplicates)
            if (existingReferences.has(reference)) {
              console.log(`Skipping duplicate reference: ${reference}`);
              return;
            }

            // Parse date and expiry
            const timestamp = new Date(dateCreated).getTime();
            const expiryInSeconds = parseInt(expiryDays.replace(' days', '')) * 86400;

            if (!isNaN(timestamp) && !isNaN(expiryInSeconds)) {
              newRecords.push({
                reference,
                stampId,
                timestamp,
                filename: filename === 'Unnamed upload' ? undefined : filename,
                expiryDate: expiryInSeconds,
              });

              // Add to existing references set to prevent duplicates within the same upload
              existingReferences.add(reference);
            }
          }
        });

        if (newRecords.length > 0) {
          // Merge with existing history
          const updatedHistory = [...newRecords, ...history];
          setHistory(updatedHistory);

          // Save to localStorage
          const savedHistory = localStorage.getItem('uploadHistory');
          const allHistory: UploadHistory = savedHistory ? JSON.parse(savedHistory) : {};
          allHistory[address] = updatedHistory;
          localStorage.setItem('uploadHistory', JSON.stringify(allHistory));

          alert(
            `Successfully imported ${newRecords.length} new records. Skipped duplicates if any.`
          );
        } else {
          alert('No new records found or all records were duplicates.');
        }
      } catch (error) {
        console.error('Error parsing CSV:', error);
        alert('Error parsing CSV file. Please check the format.');
      }
    };

    reader.readAsText(file);
    // Reset the input value so the same file can be selected again
    event.target.value = '';
  };

  const clearHistory = () => {
    if (!address) return;

    const confirmed = window.confirm(
      'Are you sure you want to clear all upload history? This action cannot be undone.'
    );
    if (confirmed) {
      setHistory([]);

      // Remove from localStorage
      const savedHistory = localStorage.getItem('uploadHistory');
      if (savedHistory) {
        const allHistory: UploadHistory = JSON.parse(savedHistory);
        delete allHistory[address];
        localStorage.setItem('uploadHistory', JSON.stringify(allHistory));
      }
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.titleContainer}>
        <h2 className={styles.title}>Upload History</h2>
        <div className={styles.buttonGroup}>
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
          <label className={styles.uploadButton} title="Upload CSV">
            <input type="file" accept=".csv" onChange={uploadCSV} className={styles.hiddenInput} />
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
              <polyline points="17,8 12,3 7,8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          </label>
          {history.length > 0 && (
            <button className={styles.clearButton} onClick={clearHistory} title="Clear History">
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
                <polyline points="3,6 5,6 21,6" />
                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          )}
        </div>
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
