export const SEPOLIA_SWARM_CONTRACT_ADDRESS =
  process.env.NEXT_PUBLIC_SWARM_CONTRACT_ADDRESS!; //// SEPOLIA TESTNET

export const SEPOLIA_ERC20_ADDRESS = process.env.NEXT_PUBLIC_ERC20_ADDRESS!; //// SEPOLIA TESTNET

if (!SEPOLIA_SWARM_CONTRACT_ADDRESS || !SEPOLIA_ERC20_ADDRESS) {
  throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is not set");
}

export const PUBLIC_URL_DOMAIN =
  process.env.NEXT_PUBLIC_URL_DOMAIN || "http://locahost:3000";

export const PROJECT_ID = process.env.NEXT_PUBLIC_WALLET_CONNECT_ID!;

if (!PROJECT_ID) {
  throw new Error("NEXT_PUBLIC_WALLET_CONNECT_ID is not set");

}

// TODO review the following texts
export const METADATA_SITE = {
  title: "Swarm",
  name: "Swarm",
  description: "Swarm calculator",
  icons: ["https://www.ethswarm.org/favicon.png"],
};
