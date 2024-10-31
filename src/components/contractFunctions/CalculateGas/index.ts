import { ethers, BaseContractMethod, BrowserProvider } from "ethers";


export async function CalculateGas(
  contractAddress: string,
  address: string,
  functionName: string,
  contractAbi: string[],
  walletProvider: ethers.Eip1193Provider,
  params: (
    | number
    | null
    | bigint
    | string
    | boolean
    | undefined
    | `0x${string}`
    | `0x${string}`[]
    | `0x${string}`[][]
  )[]
): Promise<bigint> {
  const provider = new BrowserProvider(walletProvider);
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);

  const method = contract[
    functionName as keyof typeof contract
  ] as BaseContractMethod<any[], any, any>;

  if (typeof method.populateTransaction !== "function") {
    throw new Error(`Function ${functionName} does not exist on the contract.`);
  }

  const tx = await method.populateTransaction(address, ...params);

  const gasEstimate = await signer.estimateGas(tx);

  return gasEstimate;
}
