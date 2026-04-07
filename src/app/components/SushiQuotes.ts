import { parseAbi, encodePacked, getAddress, parseUnits } from 'viem';
import {
  GNOSIS_BZZ_ADDRESS,
  GNOSIS_WXDAI_ADDRESS,
  SUSHI_STAMPS_ROUTER_ADDRESS,
  SUSHI_STAMPS_ROUTER_ABI,
  SUSHI_FACTORY_ADDRESS,
  SUSHI_FACTORY_ABI,
  BZZ_USDC_POOL_ADDRESS,
  GNOSIS_USDC_ADDRESS,
  DEFAULT_SLIPPAGE,
  TRANSACTION_TIMEOUT_MS,
} from './constants';
import { getGnosisPublicClient, performWithRetry } from './utils';
import { getPollingInterval } from '@/app/wagmi';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SushiRouteInfo {
  /** Encoded path for exactOutput: BZZ ++ fee ++ [mid ++ fee]* ++ tokenIn */
  path: `0x${string}`;
  /** Whether tokenIn is native xDAI (uses createBatchNative / topUpNative) */
  isNative: boolean;
  /** Pool fee tier(s) used in the path */
  fees: number[];
  /** Human-readable route description */
  description: string;
}

export interface SushiQuoteResult {
  /** Amount of input tokens required (including slippage buffer) */
  maxAmountIn: bigint;
  /** Exact amount without slippage (from Quoter) */
  amountInBeforeSlippage: bigint;
  /** Approximate USD cost (amountIn × tokenPriceUsd) */
  totalAmountUSD: number;
  /** The route used */
  route: SushiRouteInfo;
  /** tokenIn address (address(0) for native xDAI) */
  tokenIn: string;
  /** tokenIn symbol for display */
  tokenInSymbol: string;
  /** tokenIn decimals */
  tokenInDecimals: number;
}

export interface SushiQuoteParams {
  /** Hex address of the input token (address(0) or '0x0' for native xDAI) */
  fromToken: string;
  /** Exact BZZ amount needed (= swarmBatchTotal) */
  bzzAmount: string;
  /** Slippage as percentage (e.g. 5 = 5%) */
  slippagePercent?: number;
  /** Token symbol for display */
  tokenSymbol?: string;
  /** Token decimals */
  tokenDecimals?: number;
  /** Token USD price (used to compute totalAmountUSD) */
  tokenPriceUsd?: number;
}

export interface SushiExecuteParams extends SushiQuoteParams {
  /** Caller's wallet address */
  address: string;
  /** swarm config used to build stamp params */
  swarmConfig: any;
  /** Batch ID to top up (undefined = create new batch) */
  topUpBatchId?: string;
  /** Node address for new batches */
  nodeAddress: string;
  /** wagmi walletClient */
  walletClient: any;
  /** wagmi publicClient */
  publicClient: any;
  /** Pre-computed quote (if already fetched) */
  quote?: SushiQuoteResult;
  /** Callback for status updates */
  setStatusMessage: (status: any) => void;
  onTransactionConfirmed?: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

/**
 * Common fee tiers to try when auto-discovering pools (SushiSwap V3).
 * Order matters — try the most common first.
 */
const FEE_TIERS = [3000, 500, 10000, 100] as const;

/** Minimal ABI for reading the fee tier directly from a V3 pool contract. */
const POOL_FEE_ABI = parseAbi(['function fee() external view returns (uint24)']);

/**
 * Known pool addresses for tokens that have a direct BZZ pool.
 * We store only the address — the fee is read from the pool contract at
 * runtime so we never hardcode an assumption about the fee tier.
 */
const KNOWN_BZZ_POOL_ADDRESSES: Record<string, string> = {
  [GNOSIS_USDC_ADDRESS.toLowerCase()]: BZZ_USDC_POOL_ADDRESS,
};

/** Runtime cache: normalised token address → { pool, fee } */
const bzzPoolCache: Record<string, { pool: string; fee: number }> = {};

// ─── Pool Discovery ──────────────────────────────────────────────────────────

/**
 * Finds a direct BZZ pool for `tokenIn` on SushiSwap V3 (Gnosis).
 *
 * Strategy:
 *  1. Return the runtime cache if already resolved.
 *  2. If a known pool address exists for this token, read its fee() directly
 *     from the pool contract — avoids assuming the wrong fee tier.
 *  3. Fall back to scanning factory.getPool() across all common fee tiers.
 */
async function findDirectBzzPool(
  tokenIn: string
): Promise<{ pool: string; fee: number } | null> {
  const normalised = tokenIn.toLowerCase();

  if (bzzPoolCache[normalised]) {
    return bzzPoolCache[normalised];
  }

  const { client } = getGnosisPublicClient();

  // ── Strategy 1: known pool address → read actual fee from contract ─────────
  const knownPoolAddress = KNOWN_BZZ_POOL_ADDRESSES[normalised];
  if (knownPoolAddress && knownPoolAddress !== ZERO_ADDRESS) {
    try {
      const fee = await client.readContract({
        address: knownPoolAddress as `0x${string}`,
        abi: POOL_FEE_ABI,
        functionName: 'fee',
      });
      const result = { pool: knownPoolAddress, fee: Number(fee) };
      bzzPoolCache[normalised] = result;
      console.log(`🍣 Pool fee for ${tokenIn}: ${Number(fee)} (${Number(fee) / 10000}%)`);
      return result;
    } catch {
      console.warn('⚠️ Could not read fee from known pool, falling back to factory scan');
    }
  }

  // ── Strategy 2: scan factory for all fee tiers ────────────────────────────
  for (const fee of FEE_TIERS) {
    try {
      const pool = await client.readContract({
        address: SUSHI_FACTORY_ADDRESS as `0x${string}`,
        abi: SUSHI_FACTORY_ABI,
        functionName: 'getPool',
        args: [tokenIn as `0x${string}`, GNOSIS_BZZ_ADDRESS as `0x${string}`, fee],
      });

      if (pool && pool !== ZERO_ADDRESS) {
        const result = { pool: pool as string, fee };
        bzzPoolCache[normalised] = result;
        return result;
      }
    } catch {
      // Try next fee tier.
    }
  }

  return null;
}

/**
 * Queries the SushiSwap V3 factory for a WXDAI/USDC pool (needed for xDAI two-hop routing).
 */
async function findWxdaiUsdcPool(): Promise<{ pool: string; fee: number } | null> {
  const { client } = getGnosisPublicClient();

  for (const fee of FEE_TIERS) {
    try {
      const pool = await client.readContract({
        address: SUSHI_FACTORY_ADDRESS as `0x${string}`,
        abi: SUSHI_FACTORY_ABI,
        functionName: 'getPool',
        args: [
          GNOSIS_WXDAI_ADDRESS as `0x${string}`,
          GNOSIS_USDC_ADDRESS as `0x${string}`,
          fee,
        ],
      });

      if (pool && pool !== ZERO_ADDRESS) {
        return { pool: pool as string, fee };
      }
    } catch {
      // Try next fee tier.
    }
  }

  return null;
}

// ─── Path Encoding ────────────────────────────────────────────────────────────

/**
 * Encodes a single-hop exactOutput path: BZZ ++ fee ++ tokenIn.
 */
function encodeSingleHopPath(tokenIn: string, fee: number): `0x${string}` {
  return encodePacked(
    ['address', 'uint24', 'address'],
    [GNOSIS_BZZ_ADDRESS as `0x${string}`, fee, tokenIn as `0x${string}`]
  );
}

/**
 * Encodes a two-hop exactOutput path: BZZ ++ fee2 ++ mid ++ fee1 ++ tokenIn.
 */
function encodeTwoHopPath(
  tokenIn: string,
  fee1: number,
  mid: string,
  fee2: number
): `0x${string}` {
  return encodePacked(
    ['address', 'uint24', 'address', 'uint24', 'address'],
    [
      GNOSIS_BZZ_ADDRESS as `0x${string}`,
      fee2,
      mid as `0x${string}`,
      fee1,
      tokenIn as `0x${string}`,
    ]
  );
}

// ─── Route Resolution ─────────────────────────────────────────────────────────

/**
 * Determines the best swap route from `fromToken` to BZZ.
 * Tries direct pools first, then routes through USDC or WXDAI.
 */
export async function findSushiRoute(fromToken: string): Promise<SushiRouteInfo | null> {
  const isNativeXdai =
    fromToken === ZERO_ADDRESS ||
    fromToken === '0x0' ||
    fromToken.toLowerCase() === ZERO_ADDRESS;

  // For native xDAI, use WXDAI as the effective input token.
  const effectiveTokenIn = isNativeXdai ? GNOSIS_WXDAI_ADDRESS : fromToken;

  // ── Case 1: direct BZZ pool ─────────────────────────────────────────────────
  const directPool = await findDirectBzzPool(effectiveTokenIn);
  if (directPool) {
    const path = encodeSingleHopPath(effectiveTokenIn, directPool.fee);
    return {
      path,
      isNative: isNativeXdai,
      fees: [directPool.fee],
      description: isNativeXdai
        ? `xDAI → WXDAI → BZZ (single-hop, ${directPool.fee / 10000}% fee)`
        : `Direct → BZZ (${directPool.fee / 10000}% fee)`,
    };
  }

  // ── Case 2: two-hop via USDC (tokenIn → USDC → BZZ) ────────────────────────
  const bzzUsdcInfo = KNOWN_BZZ_POOLS[GNOSIS_USDC_ADDRESS.toLowerCase()] ?? {
    pool: BZZ_USDC_POOL_ADDRESS,
    fee: 10000,
  };

  if (
    effectiveTokenIn.toLowerCase() !== GNOSIS_USDC_ADDRESS.toLowerCase()
  ) {
    // Find tokenIn → USDC pool.
    const { client } = getGnosisPublicClient();
    for (const fee of FEE_TIERS) {
      try {
        const pool = await client.readContract({
          address: SUSHI_FACTORY_ADDRESS as `0x${string}`,
          abi: SUSHI_FACTORY_ABI,
          functionName: 'getPool',
          args: [
            effectiveTokenIn as `0x${string}`,
            GNOSIS_USDC_ADDRESS as `0x${string}`,
            fee,
          ],
        });

        if (pool && pool !== ZERO_ADDRESS) {
          const path = encodeTwoHopPath(
            effectiveTokenIn,
            fee,                       // fee for tokenIn→USDC
            GNOSIS_USDC_ADDRESS,
            bzzUsdcInfo.fee            // fee for USDC→BZZ
          );
          return {
            path,
            isNative: isNativeXdai,
            fees: [fee, bzzUsdcInfo.fee],
            description: isNativeXdai
              ? `xDAI → WXDAI → USDC → BZZ (${fee / 10000}% + ${bzzUsdcInfo.fee / 10000}%)`
              : `tokenIn → USDC → BZZ (${fee / 10000}% + ${bzzUsdcInfo.fee / 10000}%)`,
          };
        }
      } catch {
        // Try next fee tier.
      }
    }
  }

  // ── Case 3: two-hop via WXDAI (tokenIn → WXDAI → BZZ) ─────────────────────
  const wxdaiBzzPool = await findDirectBzzPool(GNOSIS_WXDAI_ADDRESS);
  if (wxdaiBzzPool && effectiveTokenIn.toLowerCase() !== GNOSIS_WXDAI_ADDRESS.toLowerCase()) {
    const wxdaiUsdcPool = await findWxdaiUsdcPool();
    if (wxdaiUsdcPool) {
      const path = encodeTwoHopPath(
        effectiveTokenIn,
        wxdaiUsdcPool.fee,
        GNOSIS_WXDAI_ADDRESS,
        wxdaiBzzPool.fee
      );
      return {
        path,
        isNative: false,
        fees: [wxdaiUsdcPool.fee, wxdaiBzzPool.fee],
        description: `tokenIn → WXDAI → BZZ (${wxdaiUsdcPool.fee / 10000}% + ${wxdaiBzzPool.fee / 10000}%)`,
      };
    }
  }

  return null;
}

// ─── Quote ────────────────────────────────────────────────────────────────────

/**
 * Gets a quote for buying `bzzAmount` BZZ by swapping `fromToken` on Gnosis
 * via the SushiSwapStampsRouter contract. Uses eth_call so no gas is consumed.
 */
export const getSushiQuote = async (params: SushiQuoteParams): Promise<SushiQuoteResult> => {
  const {
    fromToken,
    bzzAmount,
    slippagePercent = DEFAULT_SLIPPAGE,
    tokenSymbol = 'Token',
    tokenDecimals = 18,
    tokenPriceUsd = 0,
  } = params;

  console.log('🍣 Getting SushiSwap quote for BZZ purchase…', {
    fromToken,
    bzzAmount,
    slippagePercent,
  });

  const route = await performWithRetry(
    () => findSushiRoute(fromToken),
    'findSushiRoute'
  );

  if (!route) {
    throw new Error(
      `No SushiSwap route found from ${tokenSymbol} to BZZ on Gnosis. ` +
        'Try using USDC or xDAI instead.'
    );
  }

  console.log('🍣 Route found:', route.description);

  const { client } = getGnosisPublicClient();

  // Call quoteSingleHop or quoteMultiHop depending on number of hops.
  // Both are non-view but designed for eth_call (simulate = true).
  const isSingleHop = route.fees.length === 1;

  let amountInBeforeSlippage: bigint;

  if (isSingleHop) {
    const effectiveTokenIn = route.isNative ? GNOSIS_WXDAI_ADDRESS : fromToken;
    const result = await client.simulateContract({
      address: SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`,
      abi: SUSHI_STAMPS_ROUTER_ABI,
      functionName: 'quoteSingleHop',
      args: [
        effectiveTokenIn as `0x${string}`,
        route.fees[0],
        BigInt(bzzAmount),
      ],
    });
    amountInBeforeSlippage = result.result as bigint;
  } else {
    const result = await client.simulateContract({
      address: SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`,
      abi: SUSHI_STAMPS_ROUTER_ABI,
      functionName: 'quoteMultiHop',
      args: [route.path, BigInt(bzzAmount)],
    });
    amountInBeforeSlippage = result.result as bigint;
  }

  // Apply slippage buffer.
  const slippageBps = BigInt(Math.round(slippagePercent * 100)); // percent → bps
  const maxAmountIn =
    (amountInBeforeSlippage * (10000n + slippageBps)) / 10000n;

  // Compute approximate USD cost.
  let totalAmountUSD = 0;
  if (tokenPriceUsd > 0) {
    const amountInFormatted =
      Number(amountInBeforeSlippage) / 10 ** tokenDecimals;
    totalAmountUSD = amountInFormatted * tokenPriceUsd;
  }

  console.log('✅ SushiSwap quote:', {
    route: route.description,
    amountInBeforeSlippage: amountInBeforeSlippage.toString(),
    maxAmountIn: maxAmountIn.toString(),
    totalAmountUSD,
  });

  return {
    maxAmountIn,
    amountInBeforeSlippage,
    totalAmountUSD,
    route,
    tokenIn: route.isNative ? ZERO_ADDRESS : fromToken,
    tokenInSymbol: tokenSymbol,
    tokenInDecimals: tokenDecimals,
  };
};

// ─── Allowance Check ──────────────────────────────────────────────────────────

/**
 * Checks whether the user has approved enough `tokenIn` to the router.
 */
export const checkRouterAllowance = async (
  userAddress: string,
  tokenIn: string,
  requiredAmount: bigint
): Promise<boolean> => {
  if (tokenIn === ZERO_ADDRESS || tokenIn === '0x0') {
    return true; // Native xDAI doesn't need approval.
  }

  try {
    const { client } = getGnosisPublicClient();
    const allowance = await client.readContract({
      address: tokenIn as `0x${string}`,
      abi: parseAbi([
        'function allowance(address owner, address spender) external view returns (uint256)',
      ]),
      functionName: 'allowance',
      args: [userAddress as `0x${string}`, SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`],
    });

    return BigInt(allowance.toString()) >= requiredAmount;
  } catch (error) {
    console.warn('⚠️ Could not check router allowance, will include approval:', error);
    return false;
  }
};

// ─── Execute ──────────────────────────────────────────────────────────────────

/**
 * Executes a SushiSwap token → BZZ → stamp purchase (create or top-up) in a
 * single on-chain transaction via the SushiSwapStampsRouter contract.
 */
export const executeSushiSwap = async (params: SushiExecuteParams): Promise<void> => {
  const {
    fromToken,
    bzzAmount,
    slippagePercent = DEFAULT_SLIPPAGE,
    address,
    swarmConfig,
    topUpBatchId,
    nodeAddress,
    walletClient,
    publicClient,
    setStatusMessage,
    onTransactionConfirmed,
  } = params;

  console.log('🍣 Executing SushiSwap stamp purchase…');

  // ── 1. Get / reuse quote ───────────────────────────────────────────────────
  setStatusMessage({ step: 'Quoting', message: 'Getting SushiSwap quote…' });

  const quote = params.quote ?? (await getSushiQuote({
    fromToken,
    bzzAmount,
    slippagePercent,
    tokenSymbol: params.tokenSymbol,
    tokenDecimals: params.tokenDecimals,
    tokenPriceUsd: params.tokenPriceUsd,
  }));

  const { maxAmountIn, route } = quote;
  const isNative = route.isNative;
  const isTopUp = Boolean(topUpBatchId);

  // ── 2. Approve router (ERC20 only) ────────────────────────────────────────
  if (!isNative) {
    const tokenIn = isNative ? GNOSIS_WXDAI_ADDRESS : fromToken;
    const hasAllowance = await checkRouterAllowance(address, tokenIn, maxAmountIn);

    if (!hasAllowance) {
      setStatusMessage({ step: 'Approval', message: 'Approving token for router…' });
      console.log('🔐 Approving router to spend token…', { tokenIn, maxAmountIn: maxAmountIn.toString() });

      const MAX_UINT256 =
        115792089237316195423570985008687907853269984665640564039457584007913129639935n;

      const approveTxHash = await walletClient.writeContract({
        address: tokenIn as `0x${string}`,
        abi: parseAbi(['function approve(address spender, uint256 amount) external returns (bool)']),
        functionName: 'approve',
        args: [SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`, MAX_UINT256],
      });

      console.log('📝 Approval tx:', approveTxHash);
      setStatusMessage({ step: 'Approval', message: 'Waiting for approval confirmation…' });

      const approveReceipt = await publicClient.waitForTransactionReceipt({
        hash: approveTxHash,
        timeout: TRANSACTION_TIMEOUT_MS,
        pollingInterval: getPollingInterval(100), // Gnosis chainId = 100
      });

      if (approveReceipt.status !== 'success') {
        throw new Error('Token approval transaction failed');
      }
      console.log('✅ Router approved');
    } else {
      console.log('✅ Router already approved, skipping approval');
    }
  }

  // ── 3. Build stamp registry params ────────────────────────────────────────
  const bzzAmountBigInt = BigInt(bzzAmount);

  setStatusMessage({
    step: 'Swapping',
    message: isTopUp ? 'Topping up stamp via SushiSwap…' : 'Buying stamp via SushiSwap…',
  });

  // ── 4. Build and send the router transaction ───────────────────────────────
  let txHash: `0x${string}`;

  if (isTopUp && topUpBatchId) {
    // Top-up branch
    const topupAmountPerChunk = BigInt(swarmConfig.swarmBatchInitialBalance);

    if (isNative) {
      txHash = await walletClient.writeContract({
        address: SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`,
        abi: SUSHI_STAMPS_ROUTER_ABI,
        functionName: 'topUpNative',
        args: [route.path, maxAmountIn, bzzAmountBigInt, topUpBatchId as `0x${string}`, topupAmountPerChunk],
        value: maxAmountIn,
      });
    } else {
      txHash = await walletClient.writeContract({
        address: SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`,
        abi: SUSHI_STAMPS_ROUTER_ABI,
        functionName: 'topUp',
        args: [
          route.path,
          maxAmountIn,
          bzzAmountBigInt,
          topUpBatchId as `0x${string}`,
          topupAmountPerChunk,
        ],
      });
    }
  } else {
    // Create-batch branch
    const batchParams = {
      owner: address as `0x${string}`,
      nodeAddress: nodeAddress as `0x${string}`,
      initialBalancePerChunk: BigInt(swarmConfig.swarmBatchInitialBalance),
      depth: Number(swarmConfig.swarmBatchDepth),
      bucketDepth: Number(swarmConfig.swarmBatchBucketDepth),
      nonce: swarmConfig.swarmBatchNonce as `0x${string}`,
      immutable_: Boolean(swarmConfig.swarmBatchImmutable),
    };

    if (isNative) {
      txHash = await walletClient.writeContract({
        address: SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`,
        abi: SUSHI_STAMPS_ROUTER_ABI,
        functionName: 'createBatchNative',
        args: [route.path, maxAmountIn, bzzAmountBigInt, batchParams],
        value: maxAmountIn,
      });
    } else {
      txHash = await walletClient.writeContract({
        address: SUSHI_STAMPS_ROUTER_ADDRESS as `0x${string}`,
        abi: SUSHI_STAMPS_ROUTER_ABI,
        functionName: 'createBatch',
        args: [route.path, maxAmountIn, bzzAmountBigInt, batchParams],
      });
    }
  }

  console.log('📝 SushiSwap router tx:', txHash);

  setStatusMessage({
    step: 'Confirming',
    message: 'Waiting for transaction confirmation…',
  });

  // ── 5. Wait for confirmation ───────────────────────────────────────────────
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: txHash,
    timeout: TRANSACTION_TIMEOUT_MS,
    pollingInterval: getPollingInterval(100), // Gnosis chainId = 100
  });

  if (receipt.status !== 'success') {
    throw new Error('SushiSwap stamp transaction failed on-chain');
  }

  console.log('✅ SushiSwap stamp transaction confirmed:', txHash);

  if (onTransactionConfirmed) {
    onTransactionConfirmed();
  }
};
