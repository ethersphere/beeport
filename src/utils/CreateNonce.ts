import { randomBytes, createHash } from "crypto";
import { ethers } from "ethers";

export const createNonce = () => {
  const randomValue = randomBytes(32);
  const hash = createHash("sha256").update(randomValue).digest("hex"); // Genera un hash sha256
  ///convert to bytes32
  const bytes32Hash = ethers.encodeBytes32String(hash);
  return bytes32Hash;
};
