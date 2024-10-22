import { BrowserProvider, Contract, ethers } from "ethers";
import { BigNumberish } from "ethers";

import {
  // ERC20ABI,
  SEPOLIA_ERC20_ADDRESS,
  SEPOLIA_SWARM_CONTRACT_ADDRESS,
} from "@/constants";
import { randomBytes } from "crypto";

import { swarmContractAbi  } from "@/abis/swarmContractAbi";
import { ERC20ABI } from "@/abis/ERC20Abi";

// TODO CHANGE THIS FUNCTIONS TO CLASS FOR BETTER ORDER
export async function CreateBatch(
  signer: ethers.JsonRpcSigner,
  address: string,
  totalCostBZZ: BigNumberish,
  depth: number,
  immutable: boolean
): Promise<string> {
  let batchId: string = "";

  try {
    const contract = new Contract(
      SEPOLIA_SWARM_CONTRACT_ADDRESS,
      swarmContractAbi,
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

    const receipt = await tx.wait();
  } catch (error) {
    console.error("Error calling approveBZZ:", error);
  }
}

export async function GetBatchIdsFromOwner(
  walletProvider: ethers.Eip1193Provider,
  address: string
) {
  try {
    const provider = new BrowserProvider(
      walletProvider as ethers.Eip1193Provider
    );
    const signer = await provider.getSigner();

    const contract = new Contract(
      SEPOLIA_SWARM_CONTRACT_ADDRESS,
      swarmContractAbi,
      signer
    );
    const batchId = await contract.getBatchesForOwner(address);

    const batchIds = batchId.map((batch: string) =>
      batch.toString().slice(2).toUpperCase()
    );
    return batchIds;
  } catch (error) {
    console.error("Error GetBatchIdsFromOwner:", error);
  }
}

export async function GetBZZBalance(
  walletProvider: ethers.Eip1193Provider,
  address: string
) {
  const provider = new BrowserProvider(
    walletProvider as ethers.Eip1193Provider
  );
  const signer = await provider.getSigner();
  const contract = new Contract(SEPOLIA_ERC20_ADDRESS, ERC20ABI, signer);
  console.log('address :>> ', address);
  try {
    const balance = await contract.balanceOf(address);
    console.log('balance :>> ', balance);
    return balance;
    
  } catch (error) {
    console.log('Error en GetBzzBalance :>> ', error);
  }

  return 0

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
  return formattedAllowance;
};

export const MakeContractCallData = async (
  walletProvider: ethers.Eip1193Provider,
  functionName: string,
  functionParams: []
) => {
  const provider = new BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const contract = new Contract(
    SEPOLIA_SWARM_CONTRACT_ADDRESS,
    swarmContractAbi,
    signer
  );
  const callData = contract.interface.encodeFunctionData(
    functionName,
    functionParams
  );
  return callData;
};

export const BuyPostage = async (
  walletProvider: ethers.Eip1193Provider,
  address: string,
  calculateData: (number | null)[]
) => {
  const provider = new BrowserProvider(
    walletProvider as ethers.Eip1193Provider
  );

  if (
    !address ||
    !walletProvider ||
    !calculateData ||
    !calculateData[3] ||
    !calculateData[0]
  ) {
    console.error("Error in BuyPostage");
    return;
  }
  const signer = await provider.getSigner();
  const allowance = await GetBZZAllowance(signer, address as string);
  if (allowance < calculateData[3]?.toString()) {
    await ApproveBZZ(signer);
  }

  const batchId = await CreateBatch(
    signer,
    address,
    calculateData[3],
    calculateData[0],
    false
  );
  return batchId;
};
