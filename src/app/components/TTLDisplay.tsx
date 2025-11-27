import React from 'react';
import { formatDetailedTTL } from './utils';
import styles from './css/TTLDisplay.module.css';

interface TTLDisplayProps {
  ttlSeconds: number;
  stampValue: string; // The amount/balance of the stamp
  isFlashing?: boolean;
}

const TTLDisplay: React.FC<TTLDisplayProps> = ({ ttlSeconds, stampValue, isFlashing = false }) => {
  // Format TTL for detailed display
  const formattedTTL = formatDetailedTTL(ttlSeconds);

  // Format TTL for technical display (seconds or minutes)
  const formatTechnicalTTL = (seconds: number): string => {
    if (seconds > 100000) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes.toLocaleString()} minutes`;
    }
    return `${seconds.toLocaleString()} seconds`;
  };

  const technicalTTL = formatTechnicalTTL(ttlSeconds);

  // Format stamp value in BZZ (convert from PLUR to BZZ)
  const formatStampValue = (amount: string): string => {
    try {
      const amountBigInt = BigInt(amount);
      const bzz = Number(amountBigInt) / 1e16; // Convert PLUR to BZZ
      return bzz.toFixed(4);
    } catch (error) {
      return '0.0000';
    }
  };

  const bzzValue = formatStampValue(stampValue);

  return (
    <div className={`${styles.ttlContainer} ${isFlashing ? styles.flashing : ''}`}>
      {/* Label */}
      <div className={styles.label}>TTL</div>

      {/* Main TTL Display - prominent in the middle */}
      <div className={styles.mainTTL}>{formattedTTL}</div>

      {/* Details Row */}
      <div className={styles.detailsRow}>
        <div className={styles.leftDetail}>SVL: {bzzValue} BZZ</div>
        <div className={styles.rightDetail}>TTL: {technicalTTL}</div>
      </div>
    </div>
  );
};

export default TTLDisplay;
