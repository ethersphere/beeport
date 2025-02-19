import "../styles/global.css";
import "@rainbow-me/rainbowkit/styles.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Swarming",
  description: "Swaram uploaded with multichain support",
  icons: {
    icon: "./favicon.png", // Standard favicon
    shortcut: "./favicon.png", // Shortcut icon for iOS
  },
};

function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

export default RootLayout;
