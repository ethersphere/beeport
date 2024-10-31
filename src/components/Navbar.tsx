"use client";

import { usePathname } from "next/navigation";
import { ConnectButton } from "./ConnectButton";
import Link from "next/link";
export const Navbar = () => {
  const pathname = usePathname();
  console.log(pathname);

  return (
    <div className="flex flex-row bg-white p-10 text-black rounded-xl w-11/12 m-auto font-bold justify-between items-center">
      <ConnectButton />
      <Link
        href="/"
        className={`text-black ${pathname === "/" ? "text-red-500" : ""}`}
      >
        Calculate
      </Link>
      <Link
        href="/swap"
        className={` ${pathname === "/swap" ? " text-red-500" : "text-black"}`}
      >
        Swap
      </Link>
      <Link
        href="/postageBatch"
        className={`text-black ${
          pathname === "/postageBatch" ? "text-red-500" : ""
        }`}
      >
        Postage Batch
      </Link>
      <Link
        href="/upload"
        className={`text-black ${
          pathname === "/upload" ? "u text-red-500" : ""
        }`}
      >
        Upload
      </Link>
    </div>
  );
};
