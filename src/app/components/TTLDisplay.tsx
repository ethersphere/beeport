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

  const bzzValue = formatStampValue(stampValue);

  return (
    <div className={`${styles.ttlContainer} ${isFlashing ? styles.flashing : ''}`}>
      <div className={styles.mainTTL}>TTL: {formattedTTL}</div>
      <div className={styles.detailsRow}>
        <span className={styles.leftDetail}>Remaining Balance: {bzzValue} BZZ</span>
        <span> • </span>
        <span className={styles.rightDetail}>TTL: {technicalTTL}</span>
      </div>
    </div>
  );
};

export default TTLDisplay;
