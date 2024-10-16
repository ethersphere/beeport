import { BrowserProvider, Contract, ethers } from "ethers";
import { BigNumberish } from "ethers";

import {
  contractABI,
  ERC20ABI,
  SEPOLIA_ERC20_ADDRESS,
  SEPOLIA_SWARM_CONTRACT_ADDRESS,
} from "@/constants";
import { randomBytes } from "crypto";

export async function CreateBatch(
  signer: ethers.JsonRpcSigner,
  address: string,
  totalCostBZZ: BigNumberish, // Costo total en BZZ
  depth: number,
  immutable: boolean
): Promise<string> {
  let batchId: string = "";

  try {
    const contract = new Contract(
      SEPOLIA_SWARM_CONTRACT_ADDRESS,
      contractABI,
      signer
    );

    const bucketDepth = 16;

    const numberOfChunks = 2 ** depth;

    const initialBalancePerChunk = ethers.parseUnits(
      (parseFloat(totalCostBZZ.toString()) / numberOfChunks).toFixed(18),
      "ether"
    );
    const nonce = randomBytes(32);
    const gasEstimate = await contract.createBatch.estimateGas(
      address,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      nonce,
      immutable
    );

    const tx = await contract.createBatch(
      address,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      nonce,
      immutable,
      { gasLimit: gasEstimate }
    );

    const receipt = await tx.wait();
    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log(
      "Transaction status:",
      receipt.status === 1 ? "Success" : "Failed"
    );

    batchId = receipt.logs[1].topics[1].slice(2).toUpperCase();

    return batchId;
  } catch (error) {
    console.error("Error calling createBatch:", error);
  }
  return batchId;
}

export async function ApproveBZZ(signer: ethers.JsonRpcSigner) {
  try {
    const contract = new Contract(SEPOLIA_ERC20_ADDRESS, ERC20ABI, signer);
    const tx = await contract.approve(SEPOLIA_SWARM_CONTRACT_ADDRESS, 100n);
    console.log("Transaction hash:", tx.hash);
    console.log(tx, "tx");
    const receipt = await tx.wait();
    console.log(tx.value, "tx to string");

    console.log("Transaction confirmed in block:", receipt.blockNumber);
    console.log(
      "Transaction status:",
      receipt.status === 1 ? "Success" : "Failed"
    );
    console.log(receipt, "receipt general data");
  } catch (error) {
    console.error("Error calling approveBZZ:", error);
  }
}

export async function GetBatchIdsFromOwner(
  walletProvider: any,
  address: string
) {
  try {
    const provider = new BrowserProvider(walletProvider as any);
    const signer = await provider.getSigner();

    const contract = new Contract(
      SEPOLIA_SWARM_CONTRACT_ADDRESS,
      contractABI,
      signer
    );
    const batchId = await contract.getBatchesForOwner(address);

    const batchIds = batchId.map((batch: any) =>
      batch.toString().slice(2).toUpperCase()
    );
    return batchIds;
  } catch (error) {
    console.error("Error calling getBatchId:", error);
  }
}

export async function GetBZZBalance(walletProvider: any, address: string) {
  const provider = new BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  const contract = new Contract(SEPOLIA_ERC20_ADDRESS, ERC20ABI, signer);
  const balance = await contract.balanceOf(address);

  return balance;
}

export const GetBZZAllowance = async (
  signer: ethers.JsonRpcSigner,
  address: string
) => {
  const contract = new Contract(SEPOLIA_ERC20_ADDRESS, ERC20ABI, signer);
  const allowance = await contract.allowance(
    address,
    SEPOLIA_SWARM_CONTRACT_ADDRESS
  );
  const formattedAllowance = ethers.formatUnits(allowance, 18);
  console.log("Allowance:", formattedAllowance);
  return formattedAllowance;
};

export const MakeContractCallData = async (
  walletProvider: any,
  address: string,
  functionName: string,
  functionParams: any[]
) => {
  const provider = new BrowserProvider(walletProvider as any);
  const signer = await provider.getSigner();
  const contract = new Contract(
    SEPOLIA_SWARM_CONTRACT_ADDRESS,
    contractABI,
    signer
  );
  const callData = contract.interface.encodeFunctionData(
    functionName,
    functionParams
  );
  return callData;
};
