"use client";
import { useEffect, useState } from "react";
import Calculator from "@/components/Calculator/Calculator";
import {
  GetBatchIdsFromOwner,
  GetBZZBalance,
} from "@/components/contractFunctions";
import { Button } from "@/components/ui/Button";
import {
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";
import { useGlobal } from "@/context/Global";
import Link from "next/link";
import { ExistingBatches } from "@/components/Home/ExistingBatches";
import { ethers } from "ethers";
import NextButton from "../ui/NextButton";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [batchId] = useState<string | undefined>();
  const { needTokens, setBzzUserAmount, setBatchIds, calculateData } =
    useGlobal();

  async function GetUserInfo() {
    const batchIds = await GetBatchIdsFromOwner(
      walletProvider as ethers.Eip1193Provider,
      address as string
    );

    const data = await GetBZZBalance(
      walletProvider as ethers.Eip1193Provider,
      address as string
    );
    setBzzUserAmount(data);
    setBatchIds(batchIds);
  }

  useEffect(() => {
    if (address && isConnected) {
      GetUserInfo();
    }
  }, [address, isConnected]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-white">
      <div className="z-10 flex max-w-5xl items-center justify-center font-mono text-sm lg:flex flex-col">
        <div className="flex flex-col bg-white w-full p-10 rounded-xl m-auto">
          <Calculator />
        </div>

        {needTokens && (
          <Link
            href="/swap"
            className="text-blue-700 font-bold border-black border-2 rounded-xl p-2"
          >
            <p>Need tokens? buy here</p>
          </Link>
        )}

        <NextButton route="/swap" />

        {/* TODO: MOVE THE FOLLOWING TO COMPONENT */}
        {batchId && (
          <div className="text-black items-center justify-center text-nowrap mt-10 border-black border-2 rounded-xl p-2">
            <p>Your New Batch ID:</p>
            <p>{batchId}</p>
          </div>
        )}
      </div>
      <ExistingBatches />
    </main>
  );
}
