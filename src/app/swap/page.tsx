import { Widget } from "@/components/BridgeWidget/Index";
import { WidgetEvents } from "@/components/BridgeWidget/WidgetEvents";
export default function Swap() {
  return (
    <div className="flex flex-col bg-white p-10 rounded-xl h-screen">
      <WidgetEvents />
      <Widget />
    </div>
  );
}
