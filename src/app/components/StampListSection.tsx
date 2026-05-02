/**
 * Self-custody-only stamps list. Source of truth for batch metadata is:
 *
 *   1. localStorage   — what THIS browser created or imported (fast, offline).
 *   2. PostageStamp   — direct on-chain reads for fresh `batchTTL` etc.
 *   3. Issuer-state   — encrypted Single Owner Chunk on Swarm; used to restore
 *      SOCs            the bucket-counter state when local data is missing.
 *
 * The Bee `/stamps` endpoint is intentionally not consulted: for self-custody
 * batches the issuer is our hot key, not the Bee node, so `/stamps/<id>`
 * always returns 404 — chain reads are simpler and authoritative.
 */

import React, { useEffect, useState } from 'react';
import { Bee } from '@ethersphere/bee-js';
import { useWalletClient } from 'wagmi';
import { formatUnits } from 'viem';

import {
  getSelfCustodyBatches,
  removeSelfCustodyBatch,
  StoredSelfCustodyBatch,
  type ChainBatchInfo,
} from './SelfCustodyBatch';
import { STORAGE_OPTIONS } from './constants';
import { UploadStep } from './types';
import {
  formatDateEU,
  formatExpiryTime,
  getGnosisPublicClient,
  isExpiringSoon,
  isExpiryWarning,
} from './utils';
import {
  fetchBatchFromContract,
  fetchOnChainPricing,
  refreshBatchesFromContract,
  toChainBatchInfo,
} from './PostageContract';
import { deriveHotKey } from './ClientStamping';
import {
  loadStamperState,
  saveStamperState,
} from './ClientStamping';
import { loadIssuerStateFromSOC } from './IssuerStateSOC';
import styles from './css/StampListSection.module.css';

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
  bucketDepth?: number;
  /** Live remaining seconds, computed from on-chain pricing. */
  batchTTL?: number;
  /**
   * Set when the chain didn't return a row for this batchId. Either the batch
   * never made it on-chain (failed tx) or it was reaped after expiry.
   */
  missingOnChain?: boolean;
  /** Hot-key address that owns this batch on-chain. */
  hotKeyAddress?: string;
  hasBeenToppedUp?: boolean;
  /** True when this browser has stamper state for the batch in localStorage. */
  hasLocalIssuerState?: boolean;
}

const StampListSection: React.FC<StampListSectionProps> = ({
  setShowStampList,
  address,
  beeApiUrl,
  setPostageBatchId,
  setShowOverlay,
  setUploadStep,
}) => {
  const { data: walletClient } = useWalletClient();

  const [stamps, setStamps] = useState<BatchEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingStamps, setRefreshingStamps] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const getSizeForDepth = (depth: number): string => {
    const option = STORAGE_OPTIONS.find(o => o.depth === depth);
    return option ? option.size : `${depth} (unknown size)`;
  };

  /**
   * Render a list of locally-stored batches, enriched with fresh on-chain
   * status for each (TTL, depth, owner). Pure read — no signing prompt.
   */
  const buildStampList = async (
    stored: StoredSelfCustodyBatch[]
  ): Promise<BatchEvent[]> => {
    if (stored.length === 0) return [];

    const { client: publicClient } = getGnosisPublicClient();
    const onChainMap = await refreshBatchesFromContract(
      publicClient,
      stored.map(b => b.batchId)
    );

    return stored.map(s => {
      const id = s.batchId.toLowerCase().startsWith('0x')
        ? s.batchId.toLowerCase()
        : `0x${s.batchId.toLowerCase()}`;
      const onChain: ChainBatchInfo | undefined = onChainMap.get(id);
      const hasLocalIssuerState = !!loadStamperState(s.batchId);
      const base: BatchEvent = {
        batchId: s.batchId,
        totalAmount: formatUnits(BigInt(s.totalAmount), 16),
        depth: s.depth,
        size: getSizeForDepth(s.depth),
        timestamp: s.timestamp,
        bucketDepth: s.bucketDepth,
        hotKeyAddress: s.hotKeyAddress,
        hasBeenToppedUp: s.hasBeenToppedUp,
        hasLocalIssuerState,
      };
      if (!onChain) {
        return { ...base, missingOnChain: true };
      }
      return {
        ...base,
        batchTTL: onChain.batchTTL,
        bucketDepth: onChain.bucketDepth,
      };
    });
  };

  // Initial load: pull from localStorage + chain. No wallet signing needed.
  useEffect(() => {
    const fetchStamps = async () => {
      if (!address) {
        setIsLoading(false);
        return;
      }
      try {
        const stored = getSelfCustodyBatches(address);
        console.log(`📊 Found ${stored.length} self-custody batches for wallet`);
        const events = await buildStampList(stored);
        setStamps(events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));
      } catch (err) {
        console.error('Error fetching stamps:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStamps();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address]);

  /**
   * Re-read on-chain state for a single batch from the Postage Stamp contract.
   * Cheap (one RPC); used as the per-row Refresh button.
   */
  const refreshSingleStamp = async (stampToRefresh: BatchEvent) => {
    if (!address) return;
    const batchId = stampToRefresh.batchId;
    setRefreshingStamps(prev => new Set(prev).add(batchId));

    try {
      const { client: publicClient } = getGnosisPublicClient();
      const [batch, pricing] = await Promise.all([
        fetchBatchFromContract(publicClient, batchId),
        fetchOnChainPricing(publicClient),
      ]);
      if (!batch.exists) {
        setStamps(prev =>
          prev.map(s =>
            s.batchId === batchId
              ? { ...s, missingOnChain: true, batchTTL: undefined }
              : s
          )
        );
        return;
      }
      const info = toChainBatchInfo(batch, pricing);
      setStamps(prev =>
        prev.map(s =>
          s.batchId === batchId
            ? {
                ...s,
                batchTTL: info.batchTTL,
                bucketDepth: info.bucketDepth,
                missingOnChain: false,
              }
            : s
        )
      );
    } catch (err) {
      console.warn(`Error refreshing stamp ${batchId}:`, err);
    } finally {
      setRefreshingStamps(prev => {
        const next = new Set(prev);
        next.delete(batchId);
        return next;
      });
    }
  };

  /**
   * Full refresh: re-read every batch on-chain and (if a wallet client is
   * available) attempt to restore the stamper state from SOCs for batches
   * that have no local state yet. Restoration NEVER overwrites a non-empty
   * local state — local is always assumed to be the most up-to-date snapshot
   * of THIS browser's stamper.
   *
   * This is what the gear ⚙️ button at the bottom of the list invokes.
   */
  const handleFullRefresh = async () => {
    if (!address || isRefreshing) return;
    setIsRefreshing(true);
    setStatusMessage('Reading batch state from the Postage Stamp contract…');
    try {
      const stored = getSelfCustodyBatches(address);
      const events = await buildStampList(stored);
      setStamps(events.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));

      const needsSocRestore = events.filter(
        e => !e.hasLocalIssuerState && !e.missingOnChain
      );
      if (needsSocRestore.length === 0) {
        setStatusMessage(
          `Refreshed ${events.length} batch${events.length === 1 ? '' : 'es'} from chain.`
        );
        return;
      }
      if (!walletClient) {
        setStatusMessage(
          `Refreshed ${events.length} from chain. Connect a wallet to restore issuer state from Swarm for ${needsSocRestore.length} batch(es) missing local data.`
        );
        return;
      }

      // We have batches without local state but with on-chain entries → ask
      // the wallet to derive the hot key and try the SOC fallback. ONE
      // signature unlocks decryption for every batch (same hot key for all).
      setStatusMessage(
        `Restoring issuer state from Swarm for ${needsSocRestore.length} batch(es)…`
      );
      const hotKey = await deriveHotKey(walletClient, address as `0x${string}`);
      const bee = new Bee(beeApiUrl);

      let restored = 0;
      let failed = 0;
      for (const ev of needsSocRestore) {
        try {
          const result = await loadIssuerStateFromSOC({
            bee,
            hotKey,
            batchId: ev.batchId,
          });
          if (!result) {
            failed++;
            continue;
          }
          // Only restore if we still have nothing locally — prevents a slow
          // SOC read from clobbering a fresh save written by another tab
          // while we were waiting.
          if (!loadStamperState(ev.batchId)) {
            saveStamperState(ev.batchId, result.state);
            restored++;
          }
        } catch (err) {
          console.warn(`SOC restore failed for ${ev.batchId}:`, err);
          failed++;
        }
      }

      // Re-render with the new hasLocalIssuerState flags.
      const updated = await buildStampList(stored);
      setStamps(updated.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0)));

      if (restored > 0 && failed === 0) {
        setStatusMessage(`Restored issuer state for ${restored} batch(es) from Swarm.`);
      } else if (restored > 0 && failed > 0) {
        setStatusMessage(
          `Restored ${restored}; could not restore ${failed} (no SOC found yet — re-upload once to seed it).`
        );
      } else {
        setStatusMessage(
          `No SOC issuer state available yet for ${failed} batch(es). They will be seeded after the next upload.`
        );
      }
    } catch (err) {
      console.error('Refresh failed:', err);
      setStatusMessage(`Refresh failed: ${(err as Error).message}`);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleStampSelect = (stamp: BatchEvent) => {
    setPostageBatchId(stamp.batchId.startsWith('0x') ? stamp.batchId.slice(2) : stamp.batchId);
    setShowOverlay(true);
    setUploadStep('ready');
    setShowStampList(false);
  };

  const handleForget = (batchId: string) => {
    if (!address) return;
    const ok = window.confirm(
      'Forget this self-custody batch from this browser?\n\nThe batch is still on-chain and you can re-import it later if you remember the wallet + nonce that created it. Uploads will fail until then.'
    );
    if (!ok) return;
    removeSelfCustodyBatch(address, batchId);
    setStamps(prev => prev.filter(s => s.batchId !== batchId));
  };

  return (
    <div className={styles.stampListContainer}>
      <div className={styles.stampListContent}>
        <div className={styles.stampListHeader}>
          <h2>Your Self-Custody Stamps</h2>
        </div>

        {!address ? (
          <div className={styles.stampListLoading}>Connect wallet to check stamps</div>
        ) : isLoading ? (
          <div className={styles.stampListLoading}>Loading stamps…</div>
        ) : stamps.length === 0 ? (
          <div className={styles.stampListEmpty}>
            No self-custody stamps yet. Buy storage to create your first batch — it will appear
            here automatically.
          </div>
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
                    const element = document.querySelector(`[data-stamp-id="${stamp.batchId}"]`);
                    if (element) {
                      element.setAttribute('data-copied', 'true');
                      setTimeout(() => element.setAttribute('data-copied', 'false'), 2000);
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
                  {stamp.hotKeyAddress && (
                    <span title="On-chain owner of this batch (only this hot key can sign valid stamps)">
                      🔑 {stamp.hotKeyAddress.slice(0, 6)}…{stamp.hotKeyAddress.slice(-4)}
                    </span>
                  )}

                  {stamp.missingOnChain ? (
                    <span
                      title="The Postage Stamp contract has no entry for this batch — it likely hasn't been mined yet, or the batch was fully expired and reaped."
                      className={styles.selfCustodyBadge}
                    >
                      ⏳ Not on chain
                    </span>
                  ) : (
                    <>
                      {stamp.batchTTL !== undefined && (
                        <span
                          className={
                            isExpiringSoon(stamp.batchTTL)
                              ? styles.expiryWarning
                              : isExpiryWarning(stamp.batchTTL)
                                ? styles.expiryKhaki
                                : ''
                          }
                        >
                          Expires: {formatExpiryTime(stamp.batchTTL)}
                          {isExpiringSoon(stamp.batchTTL) && ' - TOP UP'}
                        </span>
                      )}
                      <span
                        title="Self-custody batch: owned on-chain by your hot key. Utilisation is tracked locally in your browser."
                        className={styles.selfCustodyBadge}
                      >
                        🔒 Self-custody
                      </span>
                      {!stamp.hasLocalIssuerState && (
                        <span
                          title="No issuer state for this batch in this browser. Click the gear button to restore it from Swarm (requires a one-time wallet signature)."
                          className={styles.selfCustodyBadge}
                        >
                          ⚠ No local issuer state
                        </span>
                      )}
                    </>
                  )}

                  {stamp.timestamp && <span>Created: {formatDateEU(stamp.timestamp * 1000)}</span>}
                </div>
                <div className={styles.stampActions}>
                  <button
                    className={styles.uploadWithStampButton}
                    onClick={() => handleStampSelect(stamp)}
                    title="Upload with these stamps"
                  >
                    Upload with these stamps
                  </button>
                  <button
                    className={styles.refreshButton}
                    onClick={() => refreshSingleStamp(stamp)}
                    disabled={refreshingStamps.has(stamp.batchId)}
                    title={
                      refreshingStamps.has(stamp.batchId)
                        ? 'Reading batch state from contract…'
                        : 'Re-read this batch from the Postage Stamp contract'
                    }
                  >
                    {refreshingStamps.has(stamp.batchId) ? '⏳ Checking…' : 'Refresh'}
                  </button>

                  <button
                    className={styles.topUpButton}
                    title="Top up this stamp"
                    onClick={() => {
                      try {
                        const formattedId = stamp.batchId.startsWith('0x')
                          ? stamp.batchId.slice(2)
                          : stamp.batchId;
                        const topupUrl = `${window.location.origin}/?topup=${formattedId}`;
                        window.open(topupUrl, '_self');
                      } catch (error) {
                        console.error('Error during top-up navigation:', error);
                        alert('Navigation failed. Please copy the stamp ID and use it manually.');
                      }
                    }}
                  >
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

                  <button
                    className={styles.refreshButton}
                    onClick={() => handleForget(stamp.batchId)}
                    title="Remove this batch from this browser's local list (does not affect on-chain state)"
                  >
                    Forget
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {statusMessage && (
          <div className={styles.stampListLoading} style={{ marginTop: 12 }}>
            {statusMessage}
          </div>
        )}

        <div className={styles.resetButtonContainer}>
          <button
            className={styles.resetButton}
            onClick={handleFullRefresh}
            disabled={isRefreshing}
            title="Refresh batch list from the Postage Stamp contract and restore any missing issuer state from Swarm SOCs"
          >
            {isRefreshing ? '⏳' : '🔄'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StampListSection;
