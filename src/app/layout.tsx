import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { AppKit } from "@/context/web3";
import { GlobalProvider } from "@/context/Global";
import { Navbar } from "@/components/Navbar";

import { METADATA_SITE } from "@/constants";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  ...METADATA_SITE,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <GlobalProvider>
          <AppKit>
            <Navbar />
            {children}
          </AppKit>
        </GlobalProvider>
      </body>
    </html>
  );
}
