import { getAddress } from "viem";

export const toChecksumAddress = (
  address: string | undefined | null
): string | null => {
  if (!address) return null;
  try {
    return getAddress(address);
  } catch (error) {
    console.log("Invalid address:", address, error);
    return null;
  }
};
