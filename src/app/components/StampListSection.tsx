import React, { useState, useEffect } from 'react';
import styles from './css/StampListSection.module.css';
import { formatUnits } from 'viem';
import { UploadStep } from './types';
import {
  GNOSIS_CUSTOM_REGISTRY_ADDRESS,
  STORAGE_OPTIONS,
  REGISTRY_ABI,
  STAMP_API_BATCH_SIZE,
  STAMP_API_BATCH_DELAY_MS,
  STAMP_API_TIMEOUT_MS,
} from './constants';
import { createPublicClient, http } from 'viem';
import { gnosis } from 'viem/chains';
import { formatExpiryTime, isExpiringSoon, getStampUsage, formatDateEU } from './utils';

// Cache for expired stamps to avoid repeated API calls
const EXPIRED_STAMPS_CACHE_KEY = 'beeport_expired_stamps';

// Minimum age before considering a stamp for permanent expiry caching (24 hours)
const MIN_STAMP_AGE_FOR_EXPIRY_CACHE = 24 * 60 * 60 * 1000;

// Maximum age for showing propagation message on 404 (1 hour)
const MAX_PROPAGATION_AGE = 60 * 60 * 1000;

interface ExpiredStampCache {
  [batchId: string]: {
    expiredAt: number; // When the stamp was first detected as expired
    lastChecked: number; // Last time we confirmed it was expired
    failureCount: number; // Number of consecutive failures
    stampAge?: number; // Age of the stamp when first marked as expired
  };
}

interface StampListSectionProps {
  setShowStampList: (show: boolean) => void;
  address: string | undefined;
  beeApiUrl: string;
  setPostageBatchId: (id: string) => void;
  setShowOverlay: (show: boolean) => void;
  setUploadStep: (step: UploadStep) => void;
}

interface BatchEvent {
  batchId: string;
  totalAmount: string;
  depth: number;
  size: string;
  timestamp?: number;
  utilization?: number;
  batchTTL?: number;
  bucketDepth?: number;
  isPropagating?: boolean; // Flag to indicate stamp is still propagating on network
}

interface StampInfo {
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

const StampListSection: React.FC<StampListSectionProps> = ({
  setShowStampList,
  address,
  beeApiUrl,
  setPostageBatchId,
  setShowOverlay,
  setUploadStep,
}) => {
  const [stamps, setStamps] = useState<BatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Utility functions for cache management (can be called from dev tools)
  const clearExpiredStampsCache = () => {
    try {
      const cached = localStorage.getItem(EXPIRED_STAMPS_CACHE_KEY);
      if (cached) {
        const cache = JSON.parse(cached) as ExpiredStampCache;
        const count = Object.keys(cache).length;
        localStorage.removeItem(EXPIRED_STAMPS_CACHE_KEY);
        console.log(`🧹 Cleared ${count} expired stamps from cache`);
      } else {
        console.log('🧹 No expired stamps cache to clear');
      }
    } catch (error) {
      console.warn('Error clearing expired stamps cache:', error);
    }
  };

  const showExpiredStampsStats = () => {
    try {
      const cached = localStorage.getItem(EXPIRED_STAMPS_CACHE_KEY);
      if (!cached) {
        console.log('📊 No expired stamps cached');
        return;
      }

      const cache = JSON.parse(cached) as ExpiredStampCache;
      const stamps = Object.entries(cache);
      const now = Date.now();

      console.log(`📊 Expired Stamps Cache Stats:`);
      console.log(`   Total expired stamps: ${stamps.length}`);

      if (stamps.length > 0) {
        const oldestExpiry = Math.min(...stamps.map(([, entry]) => entry.expiredAt));
        const newestExpiry = Math.max(...stamps.map(([, entry]) => entry.expiredAt));

        console.log(`   Oldest expiry: ${new Date(oldestExpiry).toLocaleString()}`);
        console.log(`   Newest expiry: ${new Date(newestExpiry).toLocaleString()}`);
        console.log(
          `   Sample stamps:`,
          stamps.slice(0, 3).map(([id]) => id.slice(0, 8) + '...')
        );
      }
    } catch (error) {
      console.warn('Error reading expired stamps stats:', error);
    }
  };

  // Make functions available globally for debugging
  if (typeof window !== 'undefined') {
    (window as any).clearExpiredStampsCache = clearExpiredStampsCache;
    (window as any).showExpiredStampsStats = showExpiredStampsStats;
  }

  // Helper function to get the size string for a depth value
  const getSizeForDepth = (depth: number): string => {
    const option = STORAGE_OPTIONS.find(option => option.depth === depth);
    return option ? option.size : `${depth} (unknown size)`;
  };

  useEffect(() => {
    // Helper functions for caching
    const getExpiredStampsCache = (): ExpiredStampCache => {
      try {
        const cached = localStorage.getItem(EXPIRED_STAMPS_CACHE_KEY);
        if (!cached) return {};

        const cache = JSON.parse(cached) as ExpiredStampCache;
        const now = Date.now();

        // Clean up very old cache entries (older than 7 days)
        let cleaned = false;
        Object.keys(cache).forEach(batchId => {
          const entry = cache[batchId];
          const ageInCache = now - entry.expiredAt;

          // Remove entries that have been in cache for > 7 days with high failure count
          if (ageInCache > 7 * 24 * 60 * 60 * 1000 && entry.failureCount >= 5) {
            delete cache[batchId];
            cleaned = true;
          }
        });

        // Save cleaned cache
        if (cleaned) {
          localStorage.setItem(EXPIRED_STAMPS_CACHE_KEY, JSON.stringify(cache));
        }

        return cache;
      } catch (error) {
        console.warn('Error reading expired stamps cache:', error);
        return {};
      }
    };

    const markStampAsExpired = (batchId: string, stampTimestamp?: number) => {
      try {
        const cache = getExpiredStampsCache();
        const now = Date.now();

        // Calculate stamp age if we have the timestamp
        const stampAge = stampTimestamp ? now - stampTimestamp * 1000 : undefined;

        // If it's already in cache, increment failure count
        if (cache[batchId]) {
          cache[batchId].lastChecked = now;
          cache[batchId].failureCount += 1;

          // Only keep in cache if stamp is old enough OR we've had many failures
          if (
            stampAge &&
            stampAge < MIN_STAMP_AGE_FOR_EXPIRY_CACHE &&
            cache[batchId].failureCount < 5
          ) {
            delete cache[batchId];
          }
        } else {
          // Don't cache young stamps as expired - they might just be propagating
          if (stampAge && stampAge < MIN_STAMP_AGE_FOR_EXPIRY_CACHE) {
            return;
          }

          // New expired stamp (old enough to cache)
          cache[batchId] = {
            expiredAt: now,
            lastChecked: now,
            failureCount: 1,
            stampAge,
          };
        }

        localStorage.setItem(EXPIRED_STAMPS_CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.warn('Error updating expired stamps cache:', error);
      }
    };

    const isStampKnownExpired = (batchId: string): boolean => {
      const cache = getExpiredStampsCache();
      const cachedEntry = cache[batchId];

      if (!cachedEntry) return false;

      // For recently cached stamps with low failure count, allow retry after some time
      const timeSinceLastCheck = Date.now() - cachedEntry.lastChecked;
      const retryInterval = cachedEntry.failureCount < 3 ? 5 * 60 * 1000 : 60 * 60 * 1000; // 5 min or 1 hour

      if (timeSinceLastCheck > retryInterval && cachedEntry.failureCount < 5) {
        return false; // Allow retry
      }

      return true; // Keep it cached
    };

    // Enhanced fetchStampInfo with intelligent caching
    const fetchStampInfo = async (
      batchId: string,
      stampTimestamp?: number
    ): Promise<StampInfo | null> => {
      // Check if we already know this stamp is expired (with retry logic)
      if (isStampKnownExpired(batchId)) {
        console.log(`⚡ Skipping known expired stamp: ${batchId.slice(0, 8)}... (cached)`);
        return null;
      }

      try {
        const response = await fetch(`${beeApiUrl}/stamps/${batchId.slice(2)}`, {
          signal: AbortSignal.timeout(STAMP_API_TIMEOUT_MS),
        });

        if (!response.ok) {
          if (response.status === 404) {
            markStampAsExpired(batchId, stampTimestamp);
          }
          return null;
        }

        const data = await response.json();

        // If we successfully got data, remove from expired cache if it was there
        const cache = getExpiredStampsCache();
        if (cache[batchId]) {
          delete cache[batchId];
          localStorage.setItem(EXPIRED_STAMPS_CACHE_KEY, JSON.stringify(cache));
        }

        return data;
      } catch (error) {
        console.error(`Error fetching stamps info for ${batchId.slice(0, 8)}...:`, error);
        // Don't cache network errors as expired - they might be temporary
        return null;
      }
    };

    const fetchStamps = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }

      try {
        // Create a client with the registry ABI
        const client = createPublicClient({
          chain: gnosis,
          transport: http(),
        });

        // Call the getOwnerBatches function from the registry
        const batchesData = await client.readContract({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
          abi: REGISTRY_ABI,
          functionName: 'getOwnerBatches',
          args: [address as `0x${string}`],
        });

        // Process the batches data with optimized batching
        console.log(`📊 Processing ${(batchesData as any[]).length} stamps from contract...`);

        // Filter out known expired stamps before making API calls
        const batchesToCheck = (batchesData as any[]).filter(batch => {
          const batchId = batch.batchId.toString();
          const isExpired = isStampKnownExpired(batchId);
          if (isExpired) {
            console.log(`⚡ Skipping permanently cached expired stamp: ${batchId.slice(0, 8)}...`);
          }
          return !isExpired;
        });

        console.log(
          `🔍 Making API calls for ${batchesToCheck.length} stamps (${(batchesData as any[]).length - batchesToCheck.length} skipped from cache)`
        );

        // Process stamps in smaller batches to avoid overwhelming the API
        const stampEvents: BatchEvent[] = [];

        for (let i = 0; i < batchesToCheck.length; i += STAMP_API_BATCH_SIZE) {
          const batch = batchesToCheck.slice(i, i + STAMP_API_BATCH_SIZE);

          const batchPromises = batch.map(async contractBatch => {
            const batchId = contractBatch.batchId.toString();
            const stampTimestamp = Number(contractBatch.timestamp);
            const stampInfo = await fetchStampInfo(batchId, stampTimestamp);

            const depth = Number(contractBatch.depth);

            // If no stamp info, determine if it's propagating or expired
            if (!stampInfo) {
              const now = Date.now();
              const stampAge = now - stampTimestamp * 1000;

              // Only show propagation message for very recent stamps (< 1 hour)
              // Older stamps returning 404 are likely expired
              if (stampAge < MAX_PROPAGATION_AGE) {
                return {
                  batchId,
                  totalAmount: formatUnits(contractBatch.totalAmount, 16),
                  depth,
                  size: getSizeForDepth(depth),
                  timestamp: stampTimestamp,
                  utilization: 0, // Default values for propagating stamp
                  batchTTL: 30 * 24 * 60 * 60, // Assume 30 days default
                  bucketDepth: 16, // Standard bucket depth
                  isPropagating: true, // Flag to show propagation message
                };
              }

              // Skip older stamps that failed API calls (likely expired)
              return null;
            }

            return {
              batchId,
              totalAmount: formatUnits(contractBatch.totalAmount, 16),
              depth,
              size: getSizeForDepth(depth),
              timestamp: stampTimestamp,
              utilization: stampInfo.utilization,
              batchTTL: stampInfo.batchTTL,
              bucketDepth: stampInfo.bucketDepth,
              isPropagating: false, // Not propagating, we have real data
            };
          });

          // Process this batch and add valid stamps
          const batchResults = await Promise.all(batchPromises);
          const validStamps = batchResults.filter(
            (stamp): stamp is NonNullable<typeof stamp> => stamp !== null
          );

          stampEvents.push(...validStamps);

          // Add a small delay between batches to be respectful to the API
          if (i + STAMP_API_BATCH_SIZE < batchesToCheck.length) {
            await new Promise(resolve => setTimeout(resolve, STAMP_API_BATCH_DELAY_MS));
          }
        }

        setStamps(stampEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      } catch (error) {
        console.error('Error fetching stamps:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStamps();
  }, [address, beeApiUrl]); // Only dependencies that actually need to trigger re-fetching

  const handleStampSelect = (stamp: any) => {
    setPostageBatchId(stamp.batchId.slice(2));
    setShowOverlay(true);
    setUploadStep('ready');
    setShowStampList(false);
  };

  return (
    <div className={styles.stampListContainer}>
      <div className={styles.stampListContent}>
        <div className={styles.stampListHeader}>
          <h2>Your Stamps</h2>
        </div>

        {!address ? (
          <div className={styles.stampListLoading}>Connect wallet to check stamps</div>
        ) : isLoading ? (
          <div className={styles.stampListLoading}>Loading stamps...</div>
        ) : stamps.length === 0 ? (
          <div className={styles.stampListEmpty}>No stamps found</div>
        ) : (
          <>
            {stamps.map((stamp, index) => (
              <div key={index} className={styles.stampListItem}>
                <div
                  className={styles.stampListId}
                  onClick={() => {
                    const idToCopy = stamp.batchId.startsWith('0x')
                      ? stamp.batchId.slice(2)
                      : stamp.batchId;
                    navigator.clipboard.writeText(idToCopy);
                    // Show temporary "Copied!" message
                    const element = document.querySelector(`[data-stamp-id="${stamp.batchId}"]`);
                    if (element) {
                      element.setAttribute('data-copied', 'true');
                      setTimeout(() => {
                        element.setAttribute('data-copied', 'false');
                      }, 2000);
                    }
                  }}
                  data-stamp-id={stamp.batchId}
                  data-copied="false"
                  title="Click to copy stamp ID"
                >
                  ID: {stamp.batchId.startsWith('0x') ? stamp.batchId.slice(2) : stamp.batchId}
                </div>
                <div className={styles.stampListDetails}>
                  <span>Paid: {Number(stamp.totalAmount).toFixed(2)} BZZ</span>
                  <span>Size: {stamp.size}</span>

                  {stamp.isPropagating ? (
                    <div className={styles.propagatingMessage}>
                      <span className={styles.propagatingText}>
                        🕐 Stamp is propagating on network - will be ready in up to 2 minutes
                      </span>
                    </div>
                  ) : (
                    <>
                      {stamp.utilization !== undefined && stamp.depth !== undefined && (
                        <span>
                          Utilization:{' '}
                          {getStampUsage(
                            stamp.utilization,
                            stamp.depth,
                            stamp.bucketDepth || 16
                          ).toFixed(2)}
                          %
                        </span>
                      )}
                      {stamp.batchTTL !== undefined && (
                        <span
                          className={isExpiringSoon(stamp.batchTTL) ? styles.expiryWarning : ''}
                        >
                          Expires: {formatExpiryTime(stamp.batchTTL)}
                          {isExpiringSoon(stamp.batchTTL) && ' ⚠️ TOP UP'}
                        </span>
                      )}
                    </>
                  )}

                  {stamp.timestamp && <span>Created: {formatDateEU(stamp.timestamp * 1000)}</span>}
                </div>
                <div className={styles.stampActions}>
                  <button
                    className={styles.uploadWithStampButton}
                    onClick={() => {
                      if (!stamp.isPropagating) {
                        handleStampSelect(stamp);
                      }
                    }}
                    disabled={stamp.isPropagating}
                    title={
                      stamp.isPropagating
                        ? 'Please wait for stamp to finish propagating'
                        : 'Upload with these stamps'
                    }
                  >
                    {stamp.isPropagating ? 'Propagating...' : 'Upload with these stamps'}
                  </button>

                  <button
                    className={styles.topUpButton}
                    title={
                      stamp.isPropagating
                        ? 'Please wait for stamp to finish propagating'
                        : 'Top up this stamp'
                    }
                    disabled={stamp.isPropagating}
                    onClick={() => {
                      if (!stamp.isPropagating) {
                        try {
                          console.log('Top-up button clicked');
                          // Format the batch ID (ensure no 0x prefix for URL)
                          const formattedId = stamp.batchId.startsWith('0x')
                            ? stamp.batchId.slice(2)
                            : stamp.batchId;

                          // Create the topup URL
                          const topupUrl = `${window.location.origin}/?topup=${formattedId}`;
                          console.log('Opening new page:', topupUrl);

                          // Use window.open which forces a completely new page load
                          // The "_self" ensures it replaces the current page
                          window.open(topupUrl, '_self');
                        } catch (error) {
                          console.error('Error during top-up navigation:', error);
                          // Emergency fallback if all else fails
                          alert('Navigation failed. Please copy the stamp ID and use it manually.');
                        }
                      }
                    }}
                  >
                    {/* Plus/Add icon in SVG format */}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                    <span style={{ marginLeft: '4px' }}>Top Up</span>
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Hard reset button - discrete at bottom */}
        <div className={styles.resetButtonContainer}>
          <button
            className={styles.resetButton}
            onClick={() => {
              try {
                localStorage.removeItem(EXPIRED_STAMPS_CACHE_KEY);
                // Trigger a refresh of the stamp list
                window.location.reload();
              } catch (error) {
                console.error('Error clearing expired stamps cache:', error);
              }
            }}
            title="Hard reset data"
          >
            ⚙️
          </button>
        </div>
      </div>
    </div>
  );
};

export default StampListSection;
