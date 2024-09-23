"use client";

import type { WidgetConfig } from "@lifi/widget";
import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { ClientOnly } from "../utils/ClientOnly";
import { useBzz } from "@/context/Bzz";

export function Widget() {
  const { bzzAmount } = useBzz();

  const config = {
    toChain: 100,
    toAmount: bzzAmount,
    appearance: "light",
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
