import React, { useState, useEffect, useRef } from 'react';
import { formatDetailedTTL, fetchBatchInfoFromContract } from './utils';
import styles from './css/TTLDisplay.module.css';

interface TTLDisplayProps {
  ttlSeconds: number;
  stampValue: string; // The amount/balance of the stamp
  stampId?: string; // The stamp/batch ID
  owner?: string; // The owner of the stamp
  payer?: string; // The payer (actual buyer if bought through proxy)
  isFlashing?: boolean;
  onTTLUpdate?: (newTTL: number, newBalance: string) => void; // Callback when TTL is updated from blockchain
}

const TTLDisplay: React.FC<TTLDisplayProps> = ({
  ttlSeconds: initialTTLSeconds,
  stampValue: initialStampValue,
  stampId,
  owner,
  payer,
  isFlashing = false,
  onTTLUpdate
}) => {
  // State for live countdown
  const [currentTTL, setCurrentTTL] = useState(initialTTLSeconds);
  const [currentBalance, setCurrentBalance] = useState(initialStampValue);
  const lastBlockchainSyncRef = useRef<number>(Date.now());
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Constants for character width calculation
  // Using font-size: 1.2rem with letter-spacing: 0.06rem from CSS
  // For the countdown string, we need to estimate conservatively
  // Font: 1.2rem with letter-spacing 0.06rem
  // Average character width including spacing: ~0.65rem (conservative)
  // Container typically 600-800px wide, minus padding
  // "remaining..." text adds ~12 characters worth of space
  const APPROX_CHAR_WIDTH = 0.65; // in rem (conservative for proportional font)
  const BASE_FONT_SIZE = 16; // Default browser font size in pixels
  const CONTAINER_PADDING_REM = 1.5; // 12px * 2 = 24px = ~1.5rem in padding
  const ESTIMATED_WIDTH_REM = 45; // ~720px container width in rem
  const REMAINING_TEXT_WIDTH_REM = 8; // "remaining..." takes about 8rem
  const AVAILABLE_WIDTH_REM = ESTIMATED_WIDTH_REM - CONTAINER_PADDING_REM - REMAINING_TEXT_WIDTH_REM;
  const MAX_CHARS = Math.floor(AVAILABLE_WIDTH_REM / APPROX_CHAR_WIDTH);

  // Update local state when props change
  useEffect(() => {
    setCurrentTTL(initialTTLSeconds);
    setCurrentBalance(initialStampValue);
  }, [initialTTLSeconds, initialStampValue]);

  // Client-side countdown - updates every second
  useEffect(() => {
    if (currentTTL <= 0) return;

    countdownIntervalRef.current = setInterval(() => {
      setCurrentTTL(prev => {
        const newTTL = prev - 1;
        return newTTL > 0 ? newTTL : 0;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [currentTTL]);

  // Periodic blockchain sync - every 1 minute
  useEffect(() => {
    if (!stampId) return;

    const syncWithBlockchain = async () => {
      try {
        const batchInfo = await fetchBatchInfoFromContract(stampId);

        if (batchInfo) {
          setCurrentTTL(batchInfo.ttlSeconds);
          setCurrentBalance(batchInfo.remainingBalance);
          lastBlockchainSyncRef.current = Date.now();

          // Notify parent component of the update
          if (onTTLUpdate) {
            onTTLUpdate(batchInfo.ttlSeconds, batchInfo.remainingBalance);
          }
        }
      } catch (error) {
        console.error('Error syncing TTL with blockchain:', error);
      }
    };

    // Initial sync after component mount
    syncWithBlockchain();

    // Set up periodic sync every 60 seconds
    syncIntervalRef.current = setInterval(syncWithBlockchain, 60000);

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [stampId, onTTLUpdate]);

  // Format TTL for detailed display with character limit
  const formattedTTL = formatDetailedTTL(currentTTL, MAX_CHARS);

  // Calculate estimated expiry time
  const formatExpiryDateTime = (seconds: number): string => {
    if (seconds <= 0) {
      return 'Expired';
    }
    const expiryDate = new Date(Date.now() + seconds * 1000);
    return expiryDate.toLocaleString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  const estimatedExpiry = formatExpiryDateTime(currentTTL);

  // Format stamp value in BZZ (BZZ has 16 decimal places: 1 BZZ = 10^16 PLUR)
  const formatStampValue = (amount: string): string => {
    try {
      const amountBigInt = BigInt(amount);
      // Convert PLUR to BZZ by dividing by 10^16
      const bzz = Number(amountBigInt) / 1e16;

      // Format with appropriate decimal places, removing trailing zeros
      const formatted = bzz.toFixed(6);
      return formatted.replace(/\.?0+$/, '') || '0';
    } catch (error) {
      return '0';
    }
  };

  const bzzValue = formatStampValue(currentBalance);

  // Handle copy to clipboard for balance
  const handleCopyBalance = () => {
    navigator.clipboard.writeText(`${bzzValue} BZZ`);

    const element = document.querySelector('[data-balance]');
    if (element) {
      element.setAttribute('data-copied', 'true');
      setTimeout(() => {
        element.setAttribute('data-copied', 'false');
      }, 2000);
    }
  };

  // Handle copy to clipboard for expiration date
  const handleCopyExpiration = () => {
    navigator.clipboard.writeText(estimatedExpiry);

    const element = document.querySelector('[data-expiration]');
    if (element) {
      element.setAttribute('data-copied', 'true');
      setTimeout(() => {
        element.setAttribute('data-copied', 'false');
      }, 2000);
    }
  };

  // Handle copy to clipboard for countdown
  const handleCopyCountdown = () => {
    navigator.clipboard.writeText(formattedTTL);

    const element = document.querySelector('[data-countdown]');
    if (element) {
      element.setAttribute('data-copied', 'true');
      setTimeout(() => {
        element.setAttribute('data-copied', 'false');
      }, 2000);
    }
  };

  // Handle copy to clipboard for stamp ID
  const handleCopyStampId = () => {
    if (!stampId) return;
    const idToCopy = stampId.startsWith('0x') ? stampId.slice(2) : stampId;
    navigator.clipboard.writeText(idToCopy);

    // Show temporary "Copied!" message
    const element = document.querySelector(`[data-stamp-id="${stampId}"]`);
    if (element) {
      element.setAttribute('data-copied', 'true');
      setTimeout(() => {
        element.setAttribute('data-copied', 'false');
      }, 2000);
    }
  };

  // Handle copy to clipboard for share link
  const handleCopyShareLink = () => {
    if (typeof window === 'undefined') return;
    const currentUrl = window.location.href;
    navigator.clipboard.writeText(currentUrl);

    // Show temporary "Copied!" message
    const element = document.querySelector('[data-share-link]');
    if (element) {
      element.setAttribute('data-copied', 'true');
      setTimeout(() => {
        element.setAttribute('data-copied', 'false');
      }, 2000);
    }
  };

  // Format stamp ID with truncation (first6...last4)
  const formatStampId = (id: string): string => {
    const cleanId = id.startsWith('0x') ? id.slice(2) : id;
    if (cleanId.length <= 10) return cleanId;
    return `${cleanId.slice(0, 6)}...${cleanId.slice(-4)}`;
  };

  // Format address with truncation (first6...last4)
  const formatAddress = (address: string): string => {
    const cleanAddress = address.startsWith('0x') ? address.slice(2) : address;
    if (cleanAddress.length <= 10) return cleanAddress;
    return `${cleanAddress.slice(0, 6)}...${cleanAddress.slice(-4)}`;
  };

  // Handle copy to clipboard for owner address
  const handleCopyOwner = () => {
    const addressToCopy = getOwnerToCopy();
    if (!addressToCopy) return;
    const cleanAddress = addressToCopy.startsWith('0x') ? addressToCopy : `0x${addressToCopy}`;
    navigator.clipboard.writeText(cleanAddress);

    // Show temporary "Copied!" message
    const element = document.querySelector('[data-owner-address]');
    if (element) {
      element.setAttribute('data-copied', 'true');
      setTimeout(() => {
        element.setAttribute('data-copied', 'false');
      }, 2000);
    }
  };

  // Determine which address to show (payer if bought through proxy, otherwise owner)
  const getOwnerToDisplay = (): string | null => {
    if (!owner && !payer) return null;
    // If owner and payer are different, it was bought through proxy - show payer
    if (owner && payer && owner.toLowerCase() !== payer.toLowerCase()) {
      return payer;
    }
    // Otherwise show owner (or payer if owner is not available)
    return owner || payer || null;
  };

  // Get the address to copy (with 0x prefix)
  const getOwnerToCopy = (): string | null => {
    const displayAddress = getOwnerToDisplay();
    if (!displayAddress) return null;
    return displayAddress.startsWith('0x') ? displayAddress : `0x${displayAddress}`;
  };

  // Determine the label for the owner field
  const getOwnerLabel = (): string => {
    if (!owner || !payer) return 'Owner';
    // If they're different, it was bought through proxy
    if (owner.toLowerCase() !== payer.toLowerCase()) {
      return 'Buyer';
    }
    return 'Owner';
  };

  const ownerToDisplay = getOwnerToDisplay();

  return (
    <div className={`${styles.ttlContainer} ${isFlashing ? styles.flashing : ''}`}>
      {(stampId || ownerToDisplay) && (
        <div className={styles.infoRow}>
          {stampId && (
            <div
              className={styles.stampId}
              onClick={handleCopyStampId}
              data-stamp-id={stampId}
              data-copied="false"
              title="Click to copy stamp ID"
            >
              Stamp: {formatStampId(stampId)}
            </div>
          )}
          {stampId && (
            <div
              className={styles.shareButton}
              onClick={handleCopyShareLink}
              data-share-link
              data-copied="false"
              title="Click to copy share link"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="18" cy="5" r="3"></circle>
                <circle cx="6" cy="12" r="3"></circle>
                <circle cx="18" cy="19" r="3"></circle>
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
              </svg>
            </div>
          )}
          {ownerToDisplay && (
            <div
              className={styles.ownerAddress}
              onClick={handleCopyOwner}
              data-owner-address
              data-copied="false"
              title="Click to copy owner address"
            >
              {getOwnerLabel()}: {formatAddress(ownerToDisplay)}
            </div>
          )}
        </div>
      )}
      <div
        className={styles.mainTTL}
        onClick={handleCopyCountdown}
        data-countdown
        data-copied="false"
        title="Click to copy countdown"
      >
        {formattedTTL}
      </div>
      <div className={styles.detailsRow}>
        <span
          className={styles.leftDetail}
          onClick={handleCopyBalance}
          data-balance
          data-copied="false"
          title="Click to copy balance"
        >
          Balance: {bzzValue} BZZ
        </span>
        <span> • </span>
        <span
          className={styles.rightDetail}
          onClick={handleCopyExpiration}
          data-expiration
          data-copied="false"
          title="Click to copy expiration"
        >
          Expires: {estimatedExpiry}
        </span>
      </div>
    </div>
  );
};

export default TTLDisplay;
