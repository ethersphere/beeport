import React, { useState, useEffect } from "react";
import styles from "./StampListSection.module.css";
import { createPublicClient, http, formatUnits } from "viem";
import { gnosis } from "viem/chains";

import { BATCH_REGISTRY_ADDRESS, GNOSIS_STAMP_ADDRESS } from "./constants";

interface StampListSectionProps {
  setShowStampList: (show: boolean) => void;
  address: string | undefined;
}

interface BatchEvent {
  batchId: string;
  totalAmount: string;
  depth: number;
  timestamp?: number;
}

const StampListSection: React.FC<StampListSectionProps> = ({
  setShowStampList,
  address,
}) => {
  const [stamps, setStamps] = useState<BatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const gnosisClient = createPublicClient({
    chain: gnosis,
    transport: http(),
  });

  useEffect(() => {
    const fetchStamps = async () => {
      if (!address) return;

      try {
        const logs = await gnosisClient.getLogs({
          address: BATCH_REGISTRY_ADDRESS,
          event: {
            anonymous: false,
            inputs: [
              { indexed: true, name: "batchId", type: "uint256" },
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
          fromBlock: 25780238n, // Deployment block
          toBlock: "latest",
        });

        const filteredLogs = logs.filter(
          (log) => log.args.payer?.toLowerCase() === address.toLowerCase()
        );

        const stampEvents = await Promise.all(
          filteredLogs.map(async (log) => {
            const block = await gnosisClient.getBlock({
              blockNumber: log.blockNumber,
            });
            return {
              batchId: log.args.batchId?.toString() || "",
              totalAmount: formatUnits(log.args.totalAmount || 0n, 16),
              depth: Number(log.args.depth || 0),
              timestamp: Number(block.timestamp),
            };
          })
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
  }, [address]);

  return (
    <div className={styles.stampListContainer}>
      <div className={styles.stampListContent}>
        <div className={styles.stampListHeader}>
          <h2>Your Stamps</h2>
          <button
            onClick={() => setShowStampList(false)}
            className={styles.stampListCloseButton}
          >
            Back
          </button>
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
                  <span>Depth: {stamp.depth}</span>
                  {stamp.timestamp && (
                    <span>
                      Date:{" "}
                      {new Date(stamp.timestamp * 1000).toLocaleDateString()}
                    </span>
                  )}
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
