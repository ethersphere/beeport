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
      verify: {
        etherscan: {
          apiUrl: "https://api.gnosisscan.io",
          apiKey: GNOSIS_API_KEY,
        },
      },
    },
  },
  etherscan: {
    apiKey: {
      gnosis: GNOSIS_API_KEY,
    },
    customChains: [
      {
        network: "gnosis",
        chainId: 100,
        urls: {
          apiURL: "https://api.gnosisscan.io/api",
          browserURL: "https://gnosisscan.io",
        },
      },
    ],
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