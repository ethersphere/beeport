import React, { useState, useEffect } from "react";
import styles from "./css/StampListSection.module.css";
import { formatUnits } from "viem";
import { UploadStep } from "./types";
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS, STORAGE_OPTIONS, REGISTRY_ABI } from "./constants";
import { getGnosisPublicClient } from "./utils";
import { createPublicClient, http, parseAbiItem } from "viem";
import { gnosis } from "viem/chains";

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

  // Helper function to get the size string for a depth value
  const getSizeForDepth = (depth: number): string => {
    const option = STORAGE_OPTIONS.find((option) => option.depth === depth);
    return option ? option.size : `${depth} (unknown size)`;
  };

  useEffect(() => {
    // Move fetchStampInfo inside useEffect since it's only used here
    const fetchStampInfo = async (
      batchId: string
    ): Promise<StampInfo | null> => {
      try {
        const response = await fetch(`${beeApiUrl}/stamps/${batchId.slice(2)}`);
        if (!response.ok) return null;
        const data = await response.json();
        return data;
      } catch (error) {
        console.error(`Error fetching stamps info for ${batchId}:`, error);
        return null;
      }
    };

    const fetchStamps = async () => {
      if (!address) return;

      try {
        const gnosisClient = getGnosisPublicClient();
        
        // Create a client with the registry ABI
        const client = createPublicClient({
          chain: gnosis,
          transport: http()
        });
        
        // Call the getOwnerBatches function from the registry
        const batchesData = await client.readContract({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
          abi: REGISTRY_ABI,
          functionName: 'getOwnerBatches',
          args: [address as `0x${string}`]
        });
        
        // Process the batches data
        const stampPromises = (batchesData as any[]).map(async (batch) => {
          const batchId = batch.batchId.toString();
          const stampInfo = await fetchStampInfo(batchId);

          // Skip this stamps if stampInfo is null (expired or non-existent)
          if (!stampInfo) {
            return null;
          }

          const depth = Number(batch.depth);

          return {
            batchId,
            totalAmount: formatUnits(batch.totalAmount, 16),
            depth,
            size: getSizeForDepth(depth),
            timestamp: Number(batch.timestamp),
            utilization: stampInfo.utilization,
            batchTTL: stampInfo.batchTTL,
          };
        });

        // Resolve all promises and filter out null values (expired stamps)
        const stampEventsWithNull = await Promise.all(stampPromises);
        const stampEvents = stampEventsWithNull.filter(
          (stamp): stamp is NonNullable<typeof stamp> => stamp !== null
        );

        setStamps(
          stampEvents.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        );
      } catch (error) {
        console.error("Error fetching stamps:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStamps();
  }, [address, beeApiUrl]); // Only dependencies that actually need to trigger re-fetching

  const handleStampSelect = (stamp: any) => {
    setPostageBatchId(stamp.batchId.slice(2));
    setShowOverlay(true);
    setUploadStep("ready");
    setShowStampList(false);
  };

  return (
    <div className={styles.stampListContainer}>
      <div className={styles.stampListContent}>
        <div className={styles.stampListHeader}>
          <h2>Your Stamps</h2>
        </div>

        {isLoading ? (
          <div className={styles.stampListLoading}>Loading stamps...</div>
        ) : stamps.length === 0 ? (
          <div className={styles.stampListEmpty}>No stamps found</div>
        ) : (
          <>
            {stamps.map((stamp, index) => (
              <div key={index} className={styles.stampListItem}>
                <div className={styles.stampListId}>ID: {stamp.batchId}</div>
                <div className={styles.stampListDetails}>
                  <span>
                    Amount: {Number(stamp.totalAmount).toFixed(2)} BZZ
                  </span>
                  <span>Size: {stamp.size}</span>
                  {stamp.utilization !== undefined && (
                    <span>Utilization: {stamp.utilization}%</span>
                  )}
                  {stamp.batchTTL !== undefined && (
                    <span>
                      Expires: {Math.floor(stamp.batchTTL / 86400)} days
                    </span>
                  )}
                  {stamp.timestamp && (
                    <span>
                      Created:{" "}
                      {new Date(stamp.timestamp * 1000).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <button
                  className={styles.uploadWithStampButton}
                  onClick={() => {
                    handleStampSelect(stamp);
                  }}
                >
                  Upload to these stamps
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};

export default StampListSection;
