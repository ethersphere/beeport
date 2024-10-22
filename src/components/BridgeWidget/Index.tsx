"use client";

import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { ClientOnly } from "../../utils/ClientOnly";
import { useGlobal } from "@/context/Global";
import { useContractData } from "./CalculateCallData";
import type { WidgetConfig } from "@lifi/widget";
import {
  SEPOLIA_ERC20_ADDRESS,
  SEPOLIA_SWARM_CONTRACT_ADDRESS,
} from "@/constants";

export function Widget() {
  const { bzzAmount } = useGlobal();
  const { erc20CallData, swarmCallData, gasLimitCreateBatch, gasLimitApprove } =
    useContractData();

  const config = {
    appearance: "light",
    contractCalls: [
      {
        toContractCallData: erc20CallData,
        toContractAddress: SEPOLIA_ERC20_ADDRESS,
        toContractGasLimit: gasLimitCreateBatch?.toString(),
        fromAmount: bzzAmount,
        fromTokenAddress: SEPOLIA_ERC20_ADDRESS,
      },
      {
        toContractAddress: SEPOLIA_SWARM_CONTRACT_ADDRESS,
        toContractCallData: swarmCallData,
        toContractGasLimit: gasLimitApprove?.toString(),
      },
    ],
    hiddenUI: ["walletMenu", "poweredBy"],
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
