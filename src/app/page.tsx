"use client";
import { useState } from "react";
import Calculator from "@/components/Calculator/Calculator";
import { ConnectButton } from "@/components/ConnectButton";
import { ApproveBZZ, CreateBatch } from "@/components/contractFunctions";
import { Button } from "@/components/ui/Button";
import { Widget } from "@/components/Widget";
import { WidgetEvents } from "@/components/WidgetEvents";
import {
  useWeb3ModalAccount,
  useWeb3ModalProvider,
} from "@web3modal/ethers/react";
import { BrowserProvider } from "ethers";
import { useHydrated } from "@/hooks/useHydrated";

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const { address } = useWeb3ModalAccount();
  const { walletProvider } = useWeb3ModalProvider();
  const [batchId, setBatchId] = useState("");
  async function SendTx() {
    setIsLoading(true);
    try {
      if (!address || !walletProvider) {
        console.error("Wallet is not connected");
        return;
      }
      const provider = new BrowserProvider(walletProvider as any);
      const signer = await provider.getSigner();
      await ApproveBZZ(signer);
      const batchId = await CreateBatch(
        signer,
        address,
        1000n,
        1,
        1,
        "test",
        true
      );
      console.log("Batch ID:", batchId);
      setBatchId(batchId);
    } catch (error) {
      console.error("Error in SendTx:", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-white">
      <div className="z-10 w-11/12 max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col">
        <div className="flex flex-col bg-white w-6/12 p-10 rounded-xl">
          {useHydrated() && <ConnectButton />}
          <br />
          <Calculator />
          <WidgetEvents />
          <Widget />
        </div>
        <Button onClick={SendTx} className="text-black" disabled={isLoading}>
          {isLoading ? "Sending..." : "Send Tx"}
        </Button>
        {batchId && (
          <div className="text-black items-center justify-center text-nowrap mt-10">
            <p>Batch ID:</p>
            <p>{batchId}</p>
          </div>
        )}
      </div>
    </main>
  );
}
