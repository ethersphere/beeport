// types.ts
export type ExecutionStatus = {
  step: string;
  message: string;
  error?: string;
  isError?: boolean;
  isSuccess?: boolean;
  reference?: string;
  filename?: string;
  warning?: string;
  /** Set when the user may choose to ignore one unreadable stamp backup. */
  ignoreBackup?: { batchId: string; index: number };
};

export type UploadStep = 'idle' | 'ready' | 'uploading' | 'complete';

export type SwarmConfigType = {
  swarmBatchInitialBalance: string;
  swarmBatchDepth: string;
  swarmBatchBucketDepth: string;
  swarmBatchImmutable: boolean;
  swarmBatchNonce: string;
  swarmBatchTotal: string;
};

export type StorageOption = {
  depth: number;
  size: string;
};

export interface TokenInfo {
  address: string;
  chainId: number;
  symbol: string;
  decimals: number;
  name: string;
  coinKey?: string;
  logoURI?: string;
  priceUSD?: string;
}

export interface StampInfo {
  batchID: string;
  utilization: number;
  /** Bee v2.8.1 fractional fullness in `[0, 1]` when returned by `/stamps`. */
  utilizationRatio?: number;
  usable: boolean;
  depth: number;
  amount: string;
  bucketDepth: number;
  exists: boolean;
  batchTTL: number;
  /** Local-only label from `PATCH /stamps/{id}` when the node owns the batch. */
  label?: string;
  // Additional properties for UI display
  totalSize?: string;
  usedSize?: string;
  remainingSize?: string;
  utilizationPercent?: number;
  createdDate?: string;
}
