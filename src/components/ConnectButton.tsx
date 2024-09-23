"use client";

import { useWeb3ModalAccount } from "@web3modal/ethers/react";

export const ConnectButton = () => {
  const { isConnected } = useWeb3ModalAccount();

  return (
    <section className="m-auto rounded-xl">
      {isConnected === false && <w3m-connect-button />}

      {isConnected && <w3m-button />}
    </section>
  );
};
