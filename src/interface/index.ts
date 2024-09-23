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
