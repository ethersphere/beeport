"use client";

import { useHydrated } from "@/hooks/useHydrated";
import { useWeb3ModalAccount } from "@web3modal/ethers/react";

export const ConnectButton = () => {
  const { isConnected } = useWeb3ModalAccount();

  return (
    <>
      {isConnected === false && <w3m-connect-button />}
      {/* {isConnected && <w3m-account-button />} */}
    </>
  );
};
