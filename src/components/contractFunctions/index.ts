import {
  Addressable,
  AddressLike,
  BrowserProvider,
  Contract,
  ethers,
} from "ethers";
import { BigNumberish } from "ethers";

import {
  // ERC20ABI,
  ERC20_ADDRESS,
  SWARM_CONTRACT_ADDRESS,
} from "@/constants";

import { swarmContractAbi } from "@/abis/swarmContractAbi";
import { ERC20ABI } from "@/abis/ERC20Abi";
import { SwarmLibs } from "@/lib/SwarmLibs";

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
      SWARM_CONTRACT_ADDRESS,
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
  const contract = new Contract(ERC20_ADDRESS, ERC20ABI, signer);
  console.log("address :>> ", address);
  try {
    const balance = await contract.balanceOf(address);
    console.log("balance :>> ", balance);
    return balance;
  } catch (error) {
    console.log("Error en GetBzzBalance :>> ", error);
  }

  return 0;
}

export const MakeContractCallData = async (
  walletProvider: ethers.Eip1193Provider,
  functionName: string,
  functionParams: []
) => {
  const provider = new BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const contract = new Contract(
    SWARM_CONTRACT_ADDRESS,
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
  const signer = await provider.getSigner();
  const tokenERC20 = ERC20_ADDRESS;

  const swarmInstance = new SwarmLibs({
    swarmContractAddress: SWARM_CONTRACT_ADDRESS,
    signer,
    provider,
  });

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

  // TODO: check value ERC20_ADDRESS for dinamyc values and address is fine
  const allowance = await swarmInstance.getAllowance(tokenERC20, address);

  // TODO: check value ERC20_ADDRESS for dinamyc values and address is fine
  if (allowance < calculateData[3]?.toString()) {
    await swarmInstance.ApproveBZZ(tokenERC20, "100");
  }

  const batchId = await swarmInstance.CreateBatch(
    address,
    calculateData[3],
    calculateData[0],
    false
  );
  return batchId;
};
