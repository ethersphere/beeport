import { BrowserProvider } from "ethers";
import { ethers } from "ethers";

// TODO ADD THIS FUNCTIONS TO CLASS IN THE PARENT LEVEL
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
  const provider = new BrowserProvider(
    walletProvider as ethers.Eip1193Provider
  );
  const signer = await provider.getSigner();
  const contract = new ethers.Contract(contractAddress, contractAbi, signer);
  const gasEstimate = await contract[functionName].estimateGas(
    address,
    ...params
  );

  return gasEstimate;
}
