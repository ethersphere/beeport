// types.ts
export type ExecutionStatus = {
  step: string;
  message: string;
  error?: string;
  isError?: boolean;
  isSuccess?: boolean;
  reference?: string;
  filename?: string;
};

export type UploadStep = "idle" | "ready" | "uploading" | "complete";

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
}

export interface GetCrossChainQuoteParams {
  selectedChainId: number;
  fromToken: string;
  address: string;
  toAmount: string;
  gnosisDestinationToken: string;
  setEstimatedTime?: (time: number) => void;
}
