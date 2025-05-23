'use client';

import { useState, useEffect, useRef } from 'react';
import styles from './css/PriceTracker.module.css';
import { getGnosisPublicClient } from './utils';
import { V3_POOL_ABI, GNOSIS_BZZ_ADDRESS as BZZ_ADDRESS, BZZ_USDC_POOL_ADDRESS } from './constants';

interface PriceInfo {
  token: string;
  price: string;
  previousPrice?: string;
  change?: 'up' | 'down' | 'same';
}

const USDC_DECIMALS = 6; // USDC has 6 decimals
const BZZ_DECIMALS = 16; // BZZ has 16 decimals

const PriceTracker = () => {
  const [prices, setPrices] = useState<PriceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasUpdated, setHasUpdated] = useState(false);
  const previousPrices = useRef<{ [key: string]: string }>({});

  useEffect(() => {
    const fetchPrices = async () => {
      setLoading(true);
      try {
        // Get Gnosis client
        const publicClient = getGnosisPublicClient();

        // First, determine the token order in the pool (token0 vs token1)
        // This is important for calculating the price correctly
        const token0 = (await publicClient.readContract({
          address: BZZ_USDC_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: 'token0',
        })) as `0x${string}`;

        console.log('token0', token0);

        const isBzzToken0 = token0.toLowerCase() === BZZ_ADDRESS.toLowerCase();

        // Get the current price from slot0
        const slot0Data = (await publicClient.readContract({
          address: BZZ_USDC_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: 'slot0',
        })) as [bigint, number, number, number, number, number, boolean];

        const sqrtPriceX96 = slot0Data[0];

        // Convert sqrtPriceX96 to price
        // Price = (sqrtPriceX96 / 2^96)^2
        const price = calculatePriceFromSqrtX96(sqrtPriceX96, isBzzToken0);

        // Format price with 5 decimal places
        const formattedPrice = price.toFixed(5);

        // Determine price change
        const newPrices = [
          {
            token: 'BZZ',
            price: `$${formattedPrice}`,
            change: determineChange('BZZ', formattedPrice),
          },
        ];

        // Update previous prices for next comparison
        previousPrices.current = {
          BZZ: formattedPrice,
        };

        setPrices(newPrices);
        setError(null);
        setHasUpdated(true);

        // Reset update animation after 2 seconds
        setTimeout(() => setHasUpdated(false), 2000);
      } catch (error) {
        console.error('Error fetching BZZ price from V3 pool:', error);
        setError('Unable to fetch BZZ price from SushiSwap V3 pool');
      } finally {
        setLoading(false);
      }
    };

    // Calculate price from sqrtPriceX96
    const calculatePriceFromSqrtX96 = (sqrtPriceX96: bigint, isBzzToken0: boolean): number => {
      // Price = (sqrtPriceX96 / 2^96)^2
      const Q96 = 2n ** 96n;

      // Calculate the price with maximum precision
      const priceX192 = sqrtPriceX96 * sqrtPriceX96;
      const price = Number(priceX192) / Number(Q96 * Q96);

      // Account for token decimals: BZZ has 16 decimals, USDC has 6 decimals
      if (isBzzToken0) {
        // If BZZ is token0, price is in USDC/BZZ
        // Raw price = USDC_units / BZZ_units
        // To get USDC per BZZ: price * (10^BZZ_DECIMALS) / (10^USDC_DECIMALS)
        return price * 10 ** (BZZ_DECIMALS - USDC_DECIMALS);
      } else {
        // If BZZ is token1, price is in BZZ/USDC
        // Raw price = BZZ_units / USDC_units
        // To get USDC per BZZ: (1/price) * (10^USDC_DECIMALS) / (10^BZZ_DECIMALS)
        return (1 / price) * 10 ** (USDC_DECIMALS - BZZ_DECIMALS);
      }
    };

    const determineChange = (token: string, currentPrice: string): 'up' | 'down' | 'same' => {
      const previous = previousPrices.current[token];
      if (!previous) return 'same';

      const current = parseFloat(currentPrice);
      const prev = parseFloat(previous);

      if (current > prev) return 'up';
      if (current < prev) return 'down';
      return 'same';
    };

    fetchPrices();

    // Refresh every 60 seconds
    const intervalId = setInterval(fetchPrices, 60000);

    return () => clearInterval(intervalId);
  }, []);

  if ((loading && prices.length === 0) || error) return null;

  return (
    <div className={`${styles.priceTrackerContainer} ${hasUpdated ? styles.updated : ''}`}>
      {loading ? (
        <div className={styles.loading}>Updating...</div>
      ) : (
        <div className={styles.priceData}>
          {prices.map((item, index) => (
            <span
              key={item.token}
              className={`${styles.priceItem} ${
                item.change === 'up'
                  ? styles.priceUp
                  : item.change === 'down'
                    ? styles.priceDown
                    : ''
              }`}
              title="Price from SushiSwap V3 (WXDAI/BZZ)"
            >
              {item.token}: {item.price}
              {item.change === 'up' && <span className={styles.arrow}>↑</span>}
              {item.change === 'down' && <span className={styles.arrow}>↓</span>}
              {index < prices.length - 1 && ' • '}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriceTracker;
