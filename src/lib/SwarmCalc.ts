import { parseEther } from "ethers";

export enum timeUnitType {
  YEARS = "years",
  WEEKS = "weeks",
  DAYS = "days",
  HOURS = "hours",
}

export enum volumeUnitType {
  GB = "GB",
  TB = "TB",
  PB = "PB",
  MB = "MB",
}

export class SwarmCalc {
  static getVolumeToDepth = (): { [key: string]: number } => {
    return {
      "4.93": 22,
      "17.03": 23,
      "44.21": 24,
      "102.78": 25,
      "225.86": 26,
      "480.43": 27,
      "1024.00": 28,
      "2109.44": 29,
      "4300.80": 30,
      "8724.48": 31,
      "17612.80": 32,
      "35461.12": 33,
      "71249.92": 34,
      "142981.12": 35,
      "286627.84": 36,
      "574187.52": 37,
      "1174405.12": 38,
      "2359296.00": 39,
      "4718592.00": 40,
      "9437184.00": 41,
    };
  };

  static convertTimeToHours = (
    time: number,
    unit: timeUnitType
  ): number | undefined => {
    if (time < 0) {
      console.error("The value of time must be greater than zero");
      return;
    }

    switch (unit) {
      case timeUnitType.YEARS:
        return time * 8760;
      case timeUnitType.WEEKS:
        return time * 168;
      case timeUnitType.DAYS:
        return time * 24;
      default:
        return time;
    }
  };

  static convertVolumeToGB = (
    volume: number,
    unit: volumeUnitType
  ): number | undefined => {
    if (volume < 0) {
      console.error("Volume must be a positive number.");
      return;
    }

    let gigabytes: number;
    switch (unit) {
      case volumeUnitType.TB:
        gigabytes = volume * 1024;
        break;
      case volumeUnitType.PB:
        gigabytes = volume * 1048576;
        break;
      case volumeUnitType.MB:
        gigabytes = (volume * 1) / 1024;
        break;
      default:
        gigabytes = volume;
        break;
    }

    console.log("gigabytes :>> ", gigabytes);

    if (gigabytes > 9437184) {
      console.error("Volume must be less than 9 PB.");
      return;
    }

    return gigabytes;
  };

  static calculateAmount = (blocks: number, price: number): number => {
    return blocks * price;
  };

  static calculateStorageCost = (depth: number, amount: number): number => {
    return (2 ** depth * amount) / 1e16;
  };
}
