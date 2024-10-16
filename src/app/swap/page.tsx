import { Widget } from "@/components/Widget";
import { WidgetEvents } from "@/components/WidgetEvents";
import { NFT } from "@lifi/widget";
export default function Swap() {
  return (
    <div className="flex flex-col bg-white p-10 rounded-xl h-screen">
      <WidgetEvents />
      <Widget />
      {/* <NFT owner={{ address: "0x0000000000000000000000000000000000000000" }} /> */}
    </div>
  );
}
