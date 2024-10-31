import { erc20Abi } from "abitype/abis";
import { swarmContractAbi } from "@/abis/swarmContractAbi";
import { PostageStamp } from "@/types/PostageStamp";
import { randomBytes } from "crypto";
// import { SwarmContract } from "@/types/swarmContract";
import {
  JsonRpcSigner,
  Addressable,
  Contract,
  BigNumberish,
  parseUnits,
  JsonRpcProvider,
  BrowserProvider,
  AddressLike,
  formatUnits,
} from "ethers";

interface ISwarmLibs {
  swarmContractAddress: Addressable | string;
  signer: JsonRpcSigner;
  provider: JsonRpcProvider | BrowserProvider;
}

export class SwarmLibs {
  swarmContract: PostageStamp;
  signer: JsonRpcSigner;
  provider: JsonRpcProvider | BrowserProvider;

  constructor({ swarmContractAddress, signer, provider }: ISwarmLibs) {
    this.swarmContract = new Contract(
      swarmContractAddress,
      swarmContractAbi,
      signer
    ) as unknown as PostageStamp;

    this.signer = signer;
    this.provider = provider;
  }

  async CreateBatch(
    address: AddressLike,
    totalCostBZZ: BigNumberish,
    depth: number,
    immutable: boolean
  ): Promise<string | undefined> {
    // let batchId: string;
    const bucketDepth = 16;
    const numberOfChunks = 2 ** depth;
    const nonce = randomBytes(32);
    const initialBalancePerChunk = parseUnits(
      (parseFloat(totalCostBZZ.toString()) / numberOfChunks).toFixed(18),
      "ether"
    );

    try {
      const gasEstimate = await this.swarmContract.createBatch.estimateGas(
        address,
        initialBalancePerChunk,
        depth,
        bucketDepth,
        nonce,
        immutable
      );

      const { maxPriorityFeePerGas, maxFeePerGas } =
        await this.provider.getFeeData();

      const tx = await this.swarmContract.createBatch(
        address,
        initialBalancePerChunk,
        depth,
        bucketDepth,
        nonce,
        immutable,
        {
          gasLimit: gasEstimate,
          maxPriorityFeePerGas,
          maxFeePerGas,
          nonce: await this.getBlockChainNonce(),
        }
      );

      const receipt = await tx.wait(1);

      // TODO check info returned
      if (!!receipt) return receipt.logs[1].topics[1].slice(2).toUpperCase();

      if (!receipt) throw new Error("The batch could not be created");
    } catch (error) {
      console.error("Error calling createBatch:", error);
      throw error;
    }
  }

  async getAllowance(
    tokenAddress: Addressable | string,
    address: Addressable | string
  ) {
    const contract = this.erc20Contract(<Addressable>tokenAddress);

    try {
      const allowance = await contract.allowance(
        address,
        this.swarmContract.getAddress()
      );

      const formattedAllowance = formatUnits(
        allowance,
        await contract.decimals()
      );
      return formattedAllowance;
    } catch (error) {
      throw new Error("Not possible get the allowance");
    }
  }

  async ApproveBZZ(tokenAddress: Addressable | string, amount: string) {
    try {
      const contract = this.erc20Contract(<Addressable>tokenAddress);
      const tx = await contract.approve(
        this.swarmContract.getAddress(),
        parseUnits(amount, await contract.decimals())
      );

      await tx.wait(1);
    } catch (error) {
      console.error("Error calling approveBZZ:", error);
      throw new Error("Not possible make approve in ApproveBZZ");
    }
  }

  private async getBlockChainNonce(): Promise<number | undefined> {
    try {
      return await this.provider.getTransactionCount(this.signer.getAddress());
    } catch (error) {
      throw error;
    }
  }

  private erc20Contract(address: Addressable) {
    return new Contract(address, erc20Abi, this.signer);
  }
}
