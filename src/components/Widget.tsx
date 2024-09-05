"use client";

import type { WidgetConfig } from "@lifi/widget";
import { LiFiWidget, WidgetSkeleton } from "@lifi/widget";
import { ClientOnly } from "../utils/ClientOnly";
import { useBzz } from "@/context/Bzz";

export function Widget() {
  const { bzzAmount, setBzzAmount } = useBzz();

  const config = {
    toChain: 100,
    toAmount: 1,
    fromAmount: bzzAmount,
    theme: {
      container: {
        boxShadow: "0px 8px 32px rgba(0, 0, 0, 0.08)",
        borderRadius: "16px",
      },
    },
  } as Partial<WidgetConfig>;

  return (
    <main>
      <ClientOnly fallback={<WidgetSkeleton config={config} />}>
        <LiFiWidget
          config={config}
          toAmount={100}
          toToken="BZZ"
          integrator="nextjs-example"
        />
      </ClientOnly>
    </main>
  );
}
