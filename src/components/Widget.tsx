"use client";

import type { WidgetConfig } from "@lifi/widget";
import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { ClientOnly } from "../utils/ClientOnly";
import { useGlobal } from "@/context/Global";
import { useWeb3Modal } from "@web3modal/ethers/react";

export function Widget() {
  const { bzzAmount } = useGlobal();
  const { open } = useWeb3Modal();
  const config = {
    toChain: 100,
    toAmount: bzzAmount,
    appearance: "light",
    contractCalls: [
      {
        toContractAddress: `0x${"0".repeat(40)}`,
        toContractCallData: "0x",
        toTokenAddress: "0x0", //// approve
        fromAmount: "0",
        toContractGasLimit: "0",
        fromTokenAddress: "0x0",
      },
      {
        toContractAddress: `0x${"0".repeat(40)}`,
        toContractCallData: "0x",
        toTokenAddress: "0x0", //// postage batch buy
        fromAmount: "0",
        toContractGasLimit: "0",
        fromTokenAddress: "0x0",
      },
    ],
    walletConfig: {
      autoConnect: true,
      onConnect: () => {
        open();
      },
    },
    hiddenUI: ["walletMenu", "poweredBy"],
    theme: {},
  } as Partial<WidgetConfig>;

  return (
    <main>
      <ClientOnly fallback={<WidgetSkeleton config={config} />}>
        <LiFiWidget
          config={config}
          toAmount={bzzAmount}
          toChain={100}
          toToken="BZZ"
          integrator="nextjs-example"
        />
      </ClientOnly>
    </main>
  );
}
