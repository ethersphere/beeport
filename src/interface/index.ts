import { ethers } from "ethers";

export interface BatchCreatedEvent {
  batchId: string;
  totalAmount: ethers.BigNumberish;
  normalisedBalance: ethers.BigNumberish;
  _owner: string;
  _depth: number;
  _bucketDepth: number;
  _immutable: boolean;
}

export interface GlobalContextProps {
  bzzAmount: string;
  setBzzAmount: React.Dispatch<React.SetStateAction<string>>;
  bzzUserAmount: bigint;
  setBzzUserAmount: React.Dispatch<React.SetStateAction<bigint>>;
  needTokens: boolean;
  setNeedTokens: React.Dispatch<React.SetStateAction<boolean>>;
  calculateData: any;
  setCalculateData: React.Dispatch<React.SetStateAction<any>>;
  batchIds: string[];
  setBatchIds: React.Dispatch<React.SetStateAction<string[]>>;
}
