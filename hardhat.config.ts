import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-ethers";
import "@nomicfoundation/hardhat-verify";
import "hardhat-deploy";

// Load environment variables
import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });


// Get environment variables or use defaults
const PRIVATE_KEY = process.env.WALLET_SECRET || "0x0000000000000000000000000000000000000000000000000000000000000000";
const GNOSIS_RPC_URL = process.env.GNOSIS_RPC_URL || "https://gnosis-rpc.publicnode.com";
const GNOSIS_API_KEY = process.env.MAINNET_ETHERSCAN_KEY || "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.23",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    gnosis: {
      url: GNOSIS_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 100,
    },
  },
  // Etherscan API v2: one key from https://etherscan.io/myapikey works for Gnosis (chainId 100).
  etherscan: {
    apiKey: GNOSIS_API_KEY,
  },

  // Sourcify verification (v2 - supported by GnosisScan / Blockscout natively)
  // No API key required. Verifies on https://sourcify.dev and mirrors to GnosisScan.
  sourcify: {
    enabled: true,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
    deploy: "./deploy",
    deployments: "./deployments",
  },
  namedAccounts: {
    deployer: {
      default: 0,
    },
  },
};

export default config; 