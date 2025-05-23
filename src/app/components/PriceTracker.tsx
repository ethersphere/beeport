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
  liquidity?: string;
  priceImpact?: string;
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

        const isBzzToken0 = token0.toLowerCase() === BZZ_ADDRESS.toLowerCase();

        // Get token1 address for USDC
        const token1Address = (await publicClient.readContract({
          address: BZZ_USDC_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: 'token1',
        })) as `0x${string}`;

        // Get the current price from slot0
        const slot0Data = (await publicClient.readContract({
          address: BZZ_USDC_POOL_ADDRESS as `0x${string}`,
          abi: V3_POOL_ABI,
          functionName: 'slot0',
        })) as [bigint, number, number, number, number, number, boolean];

        const sqrtPriceX96 = slot0Data[0];

        // Get the current liquidity
        const liquidity = (await publicClient.readContract({
          address: BZZ_USDC_POOL_ADDRESS as `0x${string}`,
          abi: [
            ...V3_POOL_ABI,
            {
              name: 'liquidity',
              type: 'function',
              stateMutability: 'view',
              inputs: [],
              outputs: [{ type: 'uint128', name: '' }],
            },
          ],
          functionName: 'liquidity',
        })) as bigint;

        // Get token balances in the pool for better liquidity estimation
        const [bzzBalance, usdcBalance] = await Promise.all([
          publicClient.readContract({
            address: BZZ_ADDRESS as `0x${string}`,
            abi: [
              {
                constant: true,
                inputs: [{ name: '_owner', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: 'balance', type: 'uint256' }],
                type: 'function',
              },
            ],
            functionName: 'balanceOf',
            args: [BZZ_USDC_POOL_ADDRESS as `0x${string}`],
          }) as Promise<bigint>,
          publicClient.readContract({
            address: isBzzToken0 ? token1Address : token0,
            abi: [
              {
                constant: true,
                inputs: [{ name: '_owner', type: 'address' }],
                name: 'balanceOf',
                outputs: [{ name: 'balance', type: 'uint256' }],
                type: 'function',
              },
            ],
            functionName: 'balanceOf',
            args: [BZZ_USDC_POOL_ADDRESS as `0x${string}`],
          }) as Promise<bigint>,
        ]);

        // Convert sqrtPriceX96 to price
        const price = calculatePriceFromSqrtX96(sqrtPriceX96, isBzzToken0);

        // Calculate more accurate liquidity information
        const liquidityInfo = calculateLiquidityInfo(bzzBalance, usdcBalance, price, liquidity);

        // Format liquidity values for display
        const formattedLiquidityInfo = formatLiquidityDisplay(
          liquidityInfo.tvl,
          liquidityInfo.priceImpact
        );

        // Format price with 3 decimal places and proper USD formatting
        const formattedPrice = price.toFixed(3);

        // Determine price change
        const newPrices = [
          {
            token: 'BZZ',
            price: `$${formattedPrice}`,
            change: determineChange('BZZ', formattedPrice),
            liquidity: formattedLiquidityInfo.tvl,
            priceImpact: formattedLiquidityInfo.priceImpact,
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

    // Calculate more accurate liquidity information
    const calculateLiquidityInfo = (
      bzzBalance: bigint,
      usdcBalance: bigint,
      price: number,
      liquidityValue: bigint
    ) => {
      // Calculate total value locked (TVL) using actual token balances
      const bzzBalanceFormatted = Number(bzzBalance) / 10 ** BZZ_DECIMALS;
      const usdcBalanceFormatted = Number(usdcBalance) / 10 ** USDC_DECIMALS;

      // Calculate USD value of each token in the pool
      const bzzValueUsd = bzzBalanceFormatted * price;
      const usdcValueUsd = usdcBalanceFormatted; // USDC is already in USD

      const totalTvl = bzzValueUsd + usdcValueUsd;

      // Calculate price impact for a $100 trade
      // This is much more useful than an arbitrary depth percentage
      const tradeSize = 100; // $100 trade
      const liquidityValueNumber = Number(liquidityValue);

      let priceImpactPercent = 0;

      if (liquidityValueNumber > 0 && totalTvl > 0) {
        // Simplified price impact calculation for Uniswap V3
        // Price impact ≈ (trade_amount / available_liquidity)^0.5
        // This is a reasonable approximation for small trades
        const effectiveLiquidity = Math.sqrt(liquidityValueNumber) * 0.001; // Scale factor
        priceImpactPercent = Math.sqrt(tradeSize / Math.max(effectiveLiquidity, 1000));

        // Cap at reasonable bounds (0.01% to 10%)
        priceImpactPercent = Math.max(0.0001, Math.min(priceImpactPercent, 0.1));
      }

      return {
        tvl: totalTvl,
        priceImpact: priceImpactPercent,
        bzzValue: bzzValueUsd,
        usdcValue: usdcValueUsd,
      };
    };

    // Format liquidity values for display
    const formatLiquidityDisplay = (tvl: number, priceImpact: number) => {
      let tvlFormatted;
      if (tvl >= 1_000_000) {
        tvlFormatted = `$${(tvl / 1_000_000).toFixed(2)}M`;
      } else if (tvl >= 1_000) {
        tvlFormatted = `$${(tvl / 1_000).toFixed(2)}K`;
      } else {
        tvlFormatted = `$${tvl.toFixed(2)}`;
      }

      const priceImpactFormatted = `${(priceImpact * 100).toFixed(1)}%`;

      return { tvl: tvlFormatted, priceImpact: priceImpactFormatted };
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
              title="BZZ price in USD, Total Value Locked (TVL), and estimated price impact for a $100 trade in the SushiSwap V3 BZZ-USDC pool"
            >
              {item.token}: {item.price}
              {item.change === 'up' && <span className={styles.arrow}>↑</span>}
              {item.change === 'down' && <span className={styles.arrow}>↓</span>}
              {item.liquidity && <span className={styles.liquidity}> • TVL: {item.liquidity}</span>}
              {item.priceImpact && (
                <span className={styles.liquidityDepth}> • Price Impact: {item.priceImpact}</span>
              )}
              {index < prices.length - 1 && ' • '}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default PriceTracker;
