import { Widget } from "@/components/BridgeWidget/Index";
import { WidgetEvents } from "@/components/BridgeWidget/WidgetEvents";
import NextButton from "@/components/ui/NextButton";


export default function Swap() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24 bg-white">
      <div className="z-10 w-11/12 max-w-5xl items-center justify-between font-mono text-sm lg:flex flex-col">
        <WidgetEvents />
        <Widget />

        <NextButton route="/postageBatch" />
      </div>
    </main>
  );
}
