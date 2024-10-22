"use client";
import { GlobalContextProps } from "@/types/globalContext";
import React, { createContext, useState, useContext, ReactNode } from "react";

const GlobalContext = createContext<GlobalContextProps | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [bzzAmount, setBzzAmount] = useState<string | undefined>("");
  const [bzzUserAmount, setBzzUserAmount] = useState<bigint>(0n);
  const [needTokens, setNeedTokens] = useState(false);
  const [calculateData, setCalculateData] = useState<(number | null)[]>([]);

  const [batchIds, setBatchIds] = useState<string[] | null>(null);
  
  return (
    <GlobalContext.Provider
      value={{
        bzzAmount,
        setBzzAmount,
        bzzUserAmount,
        setBzzUserAmount,
        needTokens,
        setNeedTokens,
        calculateData: calculateData || [],
        setCalculateData,
        batchIds,
        setBatchIds,
      }}
    >
      {children}
    </GlobalContext.Provider>
  );
};

export const useGlobal = (): GlobalContextProps => {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error("useGlobal need to be used within a GlobalProvider");
  }
  return context;
};
