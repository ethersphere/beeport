"use client";

import { ethers } from "ethers";
import { randomBytes } from "crypto";
import { useGlobal } from "@/context/Global";
import {
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";
import { ERC20_ADDRESS, SWARM_CONTRACT_ADDRESS } from "@/constants";
import { CalculateGas } from "../contractFunctions/CalculateGas";
import { ERC20ABI } from "@/abis/ERC20Abi";
import { swarmContractAbi } from "@/abis/swarmContractAbi";

export function useContractData() {
  const { bzzAmount, calculateData } = useGlobal();
  const { address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();

  if (!address) {
    console.error("Address is null or undefined. Please connect your wallet.");
    return {
      erc20CallData: null,
      swarmCallData: null,
      gasLimitCreateBatch: null,
      gasLimitApprove: null,
    };
  }

  const contractERC20Interface = new ethers.Interface(ERC20ABI);
  const erc20CallData = contractERC20Interface.encodeFunctionData("approve", [
    SWARM_CONTRACT_ADDRESS,
    BigInt(Math.floor(Number(bzzAmount))),
  ]);

  const bucketDepth = 16;
  const numberOfChunks = calculateData[0] ? 2 ** calculateData[0]! : null;
  const nonce = randomBytes(32);

  let initialBalancePerChunk = ethers?.parseUnits("0", "ether"); // Valor predeterminado seguro
  if (numberOfChunks && calculateData[3]) {
    const totalBalance = parseFloat(calculateData[3].toString());
    if (!isNaN(totalBalance)) {
      initialBalancePerChunk = ethers?.parseUnits(
        (totalBalance / numberOfChunks).toFixed(18),
        "ether"
      );
    } else {
      console.error("Total balance is NaN. Skipping batch creation.");
    }
  } else {
    console.error(
      "Invalid numberOfChunks or calculateData[3]. Skipping batch creation."
    );
  }

  // Verificar si initialBalancePerChunk y calculateData[0] son válidos antes de llamar a la función
  if (!initialBalancePerChunk || !calculateData[0]) {
    console.error(
      "Invalid initialBalancePerChunk or calculateData. Cannot proceed with the batch creation."
    );
    return {
      erc20CallData,
      swarmCallData: null,
      gasLimitCreateBatch: null,
      gasLimitApprove: null,
    };
  }

  const contractInterfaceSwarm = new ethers.Interface(swarmContractAbi);
  const swarmCallData = contractInterfaceSwarm.encodeFunctionData(
    "createBatch",
    [
      address,
      initialBalancePerChunk,
      calculateData[0]!, // bucketDepth
      bucketDepth,
      nonce,
      false,
    ]
  );

  // const gasLimitCreateBatch = CalculateGas(
  //   SWARM_CONTRACT_ADDRESS,
  //   address as string,
  //   "createBatch",
  //   swarmContractAbi,
  //   walletProvider as ethers.Eip1193Provider,
  //   [address, initialBalancePerChunk, calculateData[0]!]
  // );

  // const gasLimitApprove = CalculateGas(
  //   ERC20_ADDRESS,
  //   address as string,
  //   "approve",
  //   ERC20ABI,
  //   walletProvider as ethers.Eip1193Provider,
  //   [SWARM_CONTRACT_ADDRESS, bzzAmount]
  // );

  return {
    erc20CallData,
    swarmCallData,
    // gasLimitCreateBatch,
    // gasLimitApprove,
  };
}
