import { ConnectButton } from "@rainbow-me/rainbowkit";
import SwapComponent from "./components/SwapComponent";
import PriceTracker from "@/app/components/PriceTracker";
import styles from "./page.module.css";

export default function SwapPage() {
  return (
    <div className={styles.pageContainer}>
      <video autoPlay muted playsInline className={styles.backgroundVideo}>
        <source src="/doors_v3.mp4" type="video/mp4" />
      </video>

      <div className={styles.contentWrapper}>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: 12,
          }}
        >
          <ConnectButton />
        </div>
        <SwapComponent />
        <PriceTracker />
      </div>
    </div>
  );
}
