import { ChainId } from "@lifi/sdk";
import { StorageOption, SwarmConfigType } from "./types";

export const DEFAULT_NODE_ADDRESS =
  "0xb81784e65c84ca25b595ff4f0badb502673e343b";
export const BATCH_REGISTRY_ADDRESS =
  "0x85022Dac19170a2C162852C5c73E3982E7e505E0";
export const LIFI_CONTRACT_ADDRESS =
  "0x2dfaDAB8266483beD9Fd9A292Ce56596a2D1378D";
export const GNOSIS_BZZ_ADDRESS = "0xdbf3ea6f5bee45c02255b2c26a16f300502f68da";
export const BEE_GATEWAY_URL = "http://95.216.6.96:3333/bzz/";
export const GNOSIS_PRICE_ORACLE_ADDRESS =
  "0x86de783bf23bc13daef5a55ec531c198da8f10cf";
// We are using USDC as this is what LIFI mostly uses now with Relay bridge for Gnosis
export const GNOSIS_DESTINATION_TOKEN =
  "0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83";
export const DEFAULT_BEE_API_URL = "http://95.216.6.96:3333";

export const DAY_OPTIONS = [1, 2, 7, 15, 30, 45, 90, 180, 365];

export const STORAGE_OPTIONS: StorageOption[] = [
  { depth: 22, size: "5GB" },
  { depth: 23, size: "17GB" },
  { depth: 24, size: "44GB" },
  { depth: 25, size: "102GB" },
  { depth: 26, size: "225GB" },
  { depth: 27, size: "480GB" },
];

export const DEFAULT_SWARM_CONFIG: SwarmConfigType = {
  toChain: ChainId.DAI,
  swarmPostageStampAddress: "0x45a1502382541Cd610CC9068e88727426b696293",
  swarmToken: "0xdbf3ea6f5bee45c02255b2c26a16f300502f68da",
  swarmContractGasLimit: "2000000",
  swarmContractAbi: [
    "function createBatch(address _owner, uint256 _initialBalancePerChunk, uint8 _depth, uint8 _bucketDepth, bytes32 _nonce, bool _immutable) external",
  ],
  swarmBatchInitialBalance: "477774720",
  swarmBatchDepth: "20",
  swarmBatchBucketDepth: "16",
  swarmBatchImmutable: false,
  swarmBatchNonce:
    "0x" +
    Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join(""),
};

export const GNOSIS_PRICE_ORACLE_ABI = [
  {
    name: "currentPrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint32" }],
  },
] as const;
