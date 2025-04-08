import React, { useState, useEffect, useCallback } from "react";
import styles from "./css/StampListSection.module.css";
import { formatUnits } from "viem";
import { UploadStep } from "./types";
import { GNOSIS_CUSTOM_REGISTRY_ADDRESS, STORAGE_OPTIONS } from "./constants";
import { getGnosisPublicClient } from "./utils";

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
        console.error(`Error fetching stamp info for ${batchId}:`, error);
        return null;
      }
    };

    const fetchStamps = async () => {
      if (!address) return;

      try {
        const gnosisClient = getGnosisPublicClient();
        const logs = await gnosisClient.getLogs({
          address: GNOSIS_CUSTOM_REGISTRY_ADDRESS as `0x${string}`,
          event: {
            anonymous: false,
            inputs: [
              { indexed: true, name: "batchId", type: "bytes32" },
              { indexed: false, name: "totalAmount", type: "uint256" },
              { indexed: false, name: "normalisedBalance", type: "uint256" },
              { indexed: true, name: "owner", type: "address" },
              { indexed: true, name: "payer", type: "address" },
              { indexed: false, name: "depth", type: "uint8" },
              { indexed: false, name: "bucketDepth", type: "uint8" },
              { indexed: false, name: "immutable", type: "bool" },
            ],
            name: "BatchCreated",
            type: "event",
          },
          args: {
            payer: address as `0x${string}`,
          },
          fromBlock: 25780238n, // Contract creation block
          toBlock: "latest",
        });

        const stampPromises = logs.map(async (log) => {
          const batchId = log.args.batchId?.toString() || "";
          const stampInfo = await fetchStampInfo(batchId);

          // Skip this stamp if stampInfo is null (expired or non-existent)
          if (!stampInfo) {
            return null;
          }

          const block = await gnosisClient.getBlock({
            blockNumber: log.blockNumber,
          });

          const depth = Number(log.args.depth || 0);

          return {
            batchId,
            totalAmount: formatUnits(log.args.totalAmount || 0n, 16),
            depth,
            size: getSizeForDepth(depth),
            timestamp: Number(block.timestamp),
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
          <h2>Your Buckets</h2>
        </div>

        {isLoading ? (
          <div className={styles.stampListLoading}>Loading buckets...</div>
        ) : stamps.length === 0 ? (
          <div className={styles.stampListEmpty}>No buckets found</div>
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
                  Upload to this bucket
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
