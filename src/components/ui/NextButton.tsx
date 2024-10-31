"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import { useRouter } from "next/navigation";

interface NextButtonProps {
  route: string;
  label?: string;
}

const NextButton: React.FC<NextButtonProps> = ({ route, label = "Next" }) => {
  const router = useRouter();

  const handleClick = () => {
    router.push(route);
  };

  return (
    <Button
      onClick={handleClick}
      className="text-black border-black border-2 rounded-xl p-2 mt-4 m-auto"
    >
      {label}
    </Button>
  );
};

export default NextButton;