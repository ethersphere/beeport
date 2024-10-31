"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { useWeb3ModalAccount } from "@web3modal/ethers/react";

export const ConnectButton = () => {
  const { isConnected } = useWeb3ModalAccount();

  return (
    <>
      {useHydrated() && (
        <section className="rounded-xl">
          {!isConnected && <w3m-connect-button />}
          {isConnected && <w3m-button />}
        </section>
      )}
    </>
  );
};
