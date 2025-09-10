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

// Cache for expired stamps to avoid repeated API calls
const EXPIRED_STAMPS_CACHE_KEY = 'beeport_expired_stamps';

interface ExpiredStampCache {
  [batchId: string]: {
    expiredAt: number; // When the stamp was first detected as expired
    lastChecked: number; // Last time we confirmed it was expired
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

        // No expiry needed - once expired, stamps never come back
        // Just update lastChecked timestamp for any existing entries
        const now = Date.now();
        Object.values(cache).forEach(entry => {
          entry.lastChecked = now;
        });

        return cache;
      } catch (error) {
        console.warn('Error reading expired stamps cache:', error);
        return {};
      }
    };

    const markStampAsExpired = (batchId: string) => {
      try {
        const cache = getExpiredStampsCache();
        const now = Date.now();

        // If it's already in cache, just update lastChecked
        if (cache[batchId]) {
          cache[batchId].lastChecked = now;
        } else {
          // New expired stamp
          cache[batchId] = {
            expiredAt: now,
            lastChecked: now,
          };
        }

        localStorage.setItem(EXPIRED_STAMPS_CACHE_KEY, JSON.stringify(cache));
      } catch (error) {
        console.warn('Error updating expired stamps cache:', error);
      }
    };

    const isStampKnownExpired = (batchId: string): boolean => {
      const cache = getExpiredStampsCache();
      return batchId in cache;
    };

    // Enhanced fetchStampInfo with caching
    const fetchStampInfo = async (batchId: string): Promise<StampInfo | null> => {
      // Check if we already know this stamp is expired (permanent cache)
      if (isStampKnownExpired(batchId)) {
        console.log(
          `⚡ Skipping known expired stamp: ${batchId.slice(0, 8)}... (cached permanently)`
        );
        return null;
      }

      try {
        const response = await fetch(`${beeApiUrl}/stamps/${batchId.slice(2)}`, {
          signal: AbortSignal.timeout(STAMP_API_TIMEOUT_MS),
        });

        if (!response.ok) {
          if (response.status === 404) {
            console.log(`📝 Permanently caching expired stamp: ${batchId.slice(0, 8)}...`);
            markStampAsExpired(batchId);
          }
          return null;
        }

        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`Error fetching stamps info for ${batchId.slice(0, 8)}...:`, error);
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
            const stampInfo = await fetchStampInfo(batchId);

            // Skip this stamp if stampInfo is null (expired or non-existent)
            if (!stampInfo) {
              return null;
            }

            const depth = Number(contractBatch.depth);

            return {
              batchId,
              totalAmount: formatUnits(contractBatch.totalAmount, 16),
              depth,
              size: getSizeForDepth(depth),
              timestamp: Number(contractBatch.timestamp),
              utilization: stampInfo.utilization,
              batchTTL: stampInfo.batchTTL,
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

        console.log(`✅ Successfully loaded ${stampEvents.length} active stamps`);
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
                  {stamp.utilization !== undefined && (
                    <span>Utilization: {stamp.utilization}%</span>
                  )}
                  {stamp.batchTTL !== undefined && (
                    <span>Expires: {Math.floor(stamp.batchTTL / 86400)} days</span>
                  )}
                  {stamp.timestamp && (
                    <span>Created: {new Date(stamp.timestamp * 1000).toLocaleDateString()}</span>
                  )}
                </div>
                <div className={styles.stampActions}>
                  <button
                    className={styles.uploadWithStampButton}
                    onClick={() => {
                      handleStampSelect(stamp);
                    }}
                  >
                    Upload with these stamps
                  </button>

                  <button
                    className={styles.topUpButton}
                    title="Top up this stamp"
                    onClick={() => {
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
      </div>
    </div>
  );
};

export default StampListSection;
