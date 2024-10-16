import { ConnectButton } from "./ConnectButton";
import Link from "next/link";
export const Navbar = () => {
  return (
    <div className="flex flex-row bg-white p-10 text-black rounded-xl w-11/12 m-auto font-bold justify-between">
      <Link href="/">Home</Link>
      <ConnectButton />
      <Link href="/swap">Swap</Link>
    </div>
  );
};
