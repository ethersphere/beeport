import { ConnectButton } from "@rainbow-me/rainbowkit";
import SwapComponent from "./components/SwapComponent";

export default function SwapPage() {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", padding: 12 }}>
        <ConnectButton />
      </div>
      <SwapComponent />
    </div>
  );
}
