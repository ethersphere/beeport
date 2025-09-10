// types.ts
export type ExecutionStatus = {
  step: string;
  message: string;
  error?: string;
  isError?: boolean;
  isSuccess?: boolean;
  reference?: string;
  filename?: string;
  distributionTime?: number;
  remainingTime?: number;
  canClose?: boolean;
};

export type UploadStep = 'idle' | 'ready' | 'uploading' | 'distributing' | 'complete';

export type SwarmConfigType = {
  toChain: number;
  swarmPostageStampAddress: string;
  swarmToken: string;
  swarmContractGasLimit: string;
  swarmContractAbi: string[];
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

export interface GetGnosisQuoteParams {
  gnosisSourceToken: string;
  address: string;
  bzzAmount: string;
  nodeAddress: string;
  swarmConfig: any;
  setEstimatedTime?: (time: number) => void;
  topUpBatchId?: string;
}

export interface GetCrossChainQuoteParams {
  selectedChainId: number;
  fromToken: string;
  address: string;
  toAmount: string;
  gnosisDestinationToken: string;
  setEstimatedTime?: (time: number) => void;
}

// LiFi SDK interfaces
export interface ToAmountQuoteParams {
  fromChain: string | number;
  toChain: string | number;
  fromToken: string;
  toToken: string;
  fromAddress: string;
  toAddress?: string;
  toAmount: string | number;
}

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

export interface ToolDetails {
  key: string;
  name: string;
  logoURI: string;
}

export interface FeeCost {
  name: string;
  description: string;
  token: TokenInfo;
  amount: string;
  amountUSD: string;
  percentage?: string;
  included?: boolean;
}

export interface GasCost {
  type: string;
  price: string;
  estimate: string;
  limit: string;
  amount: string;
  amountUSD: string;
  token: TokenInfo;
}

export interface TransactionRequest {
  value: string;
  to: string;
  data: string;
  from: string;
  chainId: number;
  gasPrice: string;
  gasLimit: string;
}

export interface StampInfo {
  batchID: string;
  utilization: number;
  usable: boolean;
  depth: number;
  amount: string;
  bucketDepth: number;
  exists: boolean;
  batchTTL: number;
  // Additional properties for UI display
  totalSize?: string;
  usedSize?: string;
  remainingSize?: string;
  utilizationPercent?: number;
}

export interface IncludedStep {
  id: string;
  type: string;
  action: {
    fromChainId: number;
    fromAmount: string;
    fromToken: TokenInfo;
    toChainId: number;
    toToken: TokenInfo;
    fromAddress: string;
    toAddress: string;
    destinationGasConsumption?: string;
  };
  estimate: {
    tool: string;
    fromAmount: string;
    toAmount: string;
    toAmountMin: string;
    gasCosts: GasCost[];
    executionDuration: number;
    approvalAddress: string;
    feeCosts: FeeCost[];
  };
  tool: string;
  toolDetails: ToolDetails;
}

export interface ToAmountQuoteResponse {
  type: string;
  id: string;
  tool: string;
  toolDetails: ToolDetails;
  action: {
    fromToken: TokenInfo;
    fromAmount: string;
    toToken: TokenInfo;
    fromChainId: number;
    toChainId: number;
    slippage: number;
    fromAddress: string;
    toAddress: string;
  };
  estimate: {
    tool: string;
    approvalAddress: string;
    toAmountMin: string;
    toAmount: string;
    fromAmount: string;
    feeCosts: FeeCost[];
    gasCosts: GasCost[];
    executionDuration: number;
    fromAmountUSD?: string;
    toAmountUSD?: string;
  };
  includedSteps: IncludedStep[];
  integrator: string;
  transactionRequest: TransactionRequest;
}
