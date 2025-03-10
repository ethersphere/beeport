import "../styles/global.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Swarm Storage",
  description: "Swarm storage uploader with multichain support",
  icons: {
    icon: "./favicon.png", // Standard favicon
    shortcut: "./favicon.png", // Shortcut icon for iOS
  },
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="swarm-theme">
        <div className="swarm-container">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}

export default RootLayout;
