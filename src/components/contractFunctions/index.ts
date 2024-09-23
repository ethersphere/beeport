import {
  BrowserProvider,
  Contract,
  ethers,
  EventLog,
  TransactionReceipt,
} from "ethers";
import { BigNumberish } from "ethers";

import {
  contractABI,
  ERC20ABI,
  SEPOLIA_ERC20_ADDRESS,
  SEPOLIA_SWARM_CONTRACT_ADDRESS,
} from "@/constants";
import { BatchCreatedEvent } from "@/interface";
import { useWeb3ModalProvider } from "@web3modal/ethers/react";
import { Log } from "ethers";

export async function CreateBatch(
  signer: any,
  address: string,
  initialBalancePerChunk: BigNumberish,
  depth: number,
  bucketDepth: number,
  nonce: string,
  immutable: boolean
): Promise<string> {
  let batchId: string = "";

  try {
    const contract = new Contract(
      SEPOLIA_SWARM_CONTRACT_ADDRESS,
      contractABI,
      signer
    );

    const initialBalancePerChunk = ethers.parseUnits("2", "ether"); // Balance inicial
    const depth = 8; // Profundidad
    const bucketDepth = 4; // Bucket depth
    const encodedNonce = ethers.encodeBytes32String(nonce);

    // Estimate gas before sending the transaction
    const gasEstimate = await contract.createBatch.estimateGas(
      address,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      encodedNonce,
      immutable
    );

    const tx = await contract.createBatch(
      address,
      initialBalancePerChunk,
      depth,
      bucketDepth,
      encodedNonce,
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

export async function ApproveBZZ(signer: any) {
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
