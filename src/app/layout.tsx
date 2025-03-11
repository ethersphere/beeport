import "../styles/global.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";
import "./globals.css";

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
        <div className="main-container">
          <video autoPlay muted playsInline className="background-video">
            <source src="/doors_v3.mp4" type="video/mp4" />
          </video>

          <main className="content">
            <Providers>{children}</Providers>
          </main>
        </div>
      </body>
    </html>
  );
}

export default RootLayout;
