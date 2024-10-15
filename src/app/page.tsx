"use client";
import { useEffect, useState } from "react";
import Calculator from "@/components/Calculator/Calculator";
import {
  ApproveBZZ,
  CreateBatch,
  GetBatchIdsFromOwner,
  GetBZZAllowance,
  GetBZZBalance,
} from "@/components/contractFunctions";
import { Button } from "@/components/ui/Button";
import {
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";
import { BrowserProvider } from "ethers";
import { useGlobal } from "@/context/Global";
import Link from "next/link";
import { ExistingBatches } from "@/components/ExistingBatchs";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const { address, isConnected } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [batchId, setBatchId] = useState("");
  const { needTokens, setBzzUserAmount, batchIds, setBatchIds, calculateData } =
    useGlobal();
  async function SendTx() {
    setIsLoading(true);
    try {
      const provider = new BrowserProvider(walletProvider as any);

      if (!address || !walletProvider) {
        console.error("Wallet is not connected");
        return;
      }
      const signer = await provider.getSigner();
      const allowance = await GetBZZAllowance(signer, address as string);
      if (allowance < calculateData[3]) {
        await ApproveBZZ(signer);
      }
      console.log(calculateData, "calculateData[1]");

      const batchId = await CreateBatch(
        signer,
        address,
        calculateData[3],
        calculateData[0],
        false
      );
      setBatchId(batchId);
    } catch (error) {
      console.error("Error in SendTx:", error);
    } finally {
      setIsLoading(false);
    }
  }

  async function GetUserInfo() {
    const batchIds = await GetBatchIdsFromOwner(
      walletProvider,
      address as string
    );

    const data = await GetBZZBalance(walletProvider, address as string);
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
      <div className="z-10 w-11/12 max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col">
        <div className="flex flex-col bg-white w-6/12 p-10 rounded-xl">
          <Calculator />
        </div>
        {!needTokens && (
          <Button
            onClick={SendTx}
            className="text-black border-black border-2 rounded-xl p-2"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Buy New Postage Batch"}
          </Button>
        )}
        <br />
        {needTokens && (
          <Link
            href="/swap"
            className="text-blue-700 font-bold border-black border-2 rounded-xl p-2"
          >
            <p>Need tokens? buy here</p>
          </Link>
        )}
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
