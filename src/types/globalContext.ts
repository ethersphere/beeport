export interface GlobalContextProps {
  bzzAmount: string | undefined;
  setBzzAmount: React.Dispatch<React.SetStateAction<string | undefined>>;
  bzzUserAmount: bigint;
  setBzzUserAmount: React.Dispatch<React.SetStateAction<bigint>>;
  needTokens: boolean;
  setNeedTokens: React.Dispatch<React.SetStateAction<boolean>>;
  calculateData: (number | null)[];
  setCalculateData: React.Dispatch<React.SetStateAction<(number | null)[]>>;
  batchIds: string[] |  null;
  setBatchIds: React.Dispatch<React.SetStateAction<string[] | null>>;
}
