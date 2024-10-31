"use client";

import React from "react";
import { useState } from "react";
import { useGlobal } from "@/context/Global";
import {
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";
import { ethers } from "ethers";
import { Button } from "@/components/ui/Button";
import { BuyPostage } from "@/components/contractFunctions";
import NextButton from "@/components/ui/NextButton";

export default function PostageBatch() {
  const { address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [isLoading, setIsLoading] = useState(false);
  const [batchId, setBatchId] = useState<string | undefined>();
  const { needTokens, calculateData } = useGlobal();

  async function SendTx() {
    setIsLoading(true);
    try {
      const batchId = await BuyPostage(
        walletProvider as ethers.Eip1193Provider,
        address as string,
        calculateData
      );
      setBatchId(batchId);
    } catch (error) {
      console.error("Error in SendTx:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-white">
      <div className="z-10 w-11/12 max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col gap-4">
        {/* TODO: MOVE THE FOLLOWING TO COMPONENT */}
        {!needTokens && (
          <Button
            onClick={SendTx}
            className="text-black border-black border-2 rounded-xl p-2"
            disabled={isLoading}
          >
            {isLoading ? "Processing..." : "Buy New Postage Batch"}
          </Button>
        )}
        <NextButton route="/upload" />
      </div>
    </main>
  );
}
