"use client";
import React, { createContext, useState, useContext, ReactNode } from "react";

// Definimos el tipo para el contexto
interface BzzContextProps {
  bzzAmount: string;
  setBzzAmount: React.Dispatch<React.SetStateAction<string>>;
}

// Creamos el contexto con un valor inicial opcional
const BzzContext = createContext<BzzContextProps | undefined>(undefined);

// Proveedor del contexto
export const BzzProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [bzzAmount, setBzzAmount] = useState("");

  return (
    <BzzContext.Provider value={{ bzzAmount, setBzzAmount }}>
      {children}
    </BzzContext.Provider>
  );
};

// Custom hook para usar el contexto
export const useBzz = (): BzzContextProps => {
  const context = useContext(BzzContext);
  if (!context) {
    throw new Error("useBzz debe usarse dentro de un BzzProvider");
  }
  return context;
};
