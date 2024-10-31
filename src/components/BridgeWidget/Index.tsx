"use client";

import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { ClientOnly } from "../../utils/ClientOnly";
import { useGlobal } from "@/context/Global";
import { useContractData } from "./CalculateCallData";
import type { WidgetConfig } from "@lifi/widget";
import {
  ERC20_ADDRESS,
  SWARM_CONTRACT_ADDRESS,
} from "@/constants";

export function Widget() {
  const { bzzAmount } = useGlobal();
  const { erc20CallData, swarmCallData } = useContractData();


  const config = {
    appearance: "light",
    contractCalls: [
      {
        toContractCallData: erc20CallData,
        toContractAddress: ERC20_ADDRESS,
        // toContractGasLimit: gasLimitCreateBatch?.toString(),
        // fromAmount: bzzAmount,
        // fromTokenAddress: ERC20_ADDRESS,
      },
      {
        toContractAddress: SWARM_CONTRACT_ADDRESS,
        toContractCallData: swarmCallData,
        // toContractGasLimit: gasLimitApprove?.toString(),
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
