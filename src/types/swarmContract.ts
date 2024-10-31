import { ExtractAbiEvents, narrow, ParseAbi } from "abitype";
import { swarmContractAbi } from "@/abis/swarmContractAbi";
import { ExtractAbiFunctionNames } from "abitype";
import {
  BaseContract,
  Contract,
  ContractTransaction,
  EventFragment,
  FunctionFragment,
  Interface,
} from "ethers";

const abiNarrow = narrow(swarmContractAbi);

type parsedAbi = ParseAbi<typeof abiNarrow>;

type ContractFunctions = ExtractAbiFunctionNames<parsedAbi>;

type ContractFunctionsNames = ExtractAbiFunctionNames<parsedAbi>;

type ContractEvents = ExtractAbiEvents<parsedAbi>;

type ContractEventsNames = ExtractAbiEvents<parsedAbi>;

// export interface SwarmContractInterface extends Interface {
//   getFunction(nameOrSignature: ContractFunctions): FunctionFragment;
//   getEvent(nameOrSignatureOrTopic: ContractEvents): EventFragment;
// }

// export interface SwarmContract extends BaseContract {
//   interface: SwarmContractInterface;
// }
