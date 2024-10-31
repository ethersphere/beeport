"use client";
import { Input } from "@/components/ui/Input";
import { useGlobal } from "@/context/Global";
import { SwarmCalc, timeUnitType, volumeUnitType } from "@/lib/SwarmCalc";
import { getPrice } from "@/services/getPrice";
import { parseEther } from "ethers";
import React, { useState, useEffect } from "react";

// TODO: REVIEW THE CODE IN THIS FILE
export default function Calculator() {
  const [price, setPrice] = useState<number | undefined>();
  const [time, setTime] = useState<number>(0);
  const [timeUnit, setTimeUnit] = useState<timeUnitType>(timeUnitType.HOURS);
  const [volume, setVolume] = useState<number>(0);
  const [volumeUnit, setVolumeUnit] = useState<volumeUnitType>(
    volumeUnitType.GB
  );

  const [amount, setAmount] = useState<number>(0);

  const [minimumDepth, setMinimumDepth] = useState<number>(0);
  const [depth, setDepth] = useState<number>(0);

  const { setBzzAmount, bzzUserAmount, setNeedTokens, setCalculateData } =
    useGlobal();

  const [storageCost, setStorageCost] = useState("");
  const [timeError, setTimeError] = useState("");
  const [volumeError, setVolumeError] = useState("");

  // Fetch the price on component mount
  useEffect(() => {
    (async () => {
      const price = await getPrice();
      setPrice(price);
    })();
  }, []);

  // Auto calculate whenever time, volume, timeUnit, or volumeUnit change
  useEffect(() => {
    if (!!price) {
      handleCalculate();
    }
  }, [time, timeUnit, volume, volumeUnit]);

  // Auto calculate storage cost when depth, amount, or minimumDepth change
  useEffect(() => {
    if (!amount) return;

    if (!!depth) {
      const cost = SwarmCalc.calculateStorageCost(depth, amount);
      const bzzAmount = parseEther(cost.toString());

      if (bzzAmount > bzzUserAmount) {
        setNeedTokens(true);
      } else {
        setNeedTokens(false);
      }
      setStorageCost(cost.toFixed(4));
      setBzzAmount(cost.toFixed(4));
    }

    setCalculateData([depth, amount, minimumDepth]);
  }, [depth, amount, minimumDepth]);

  const handleCalculate = () => {
    setTimeError("");
    setVolumeError("");

    const hours = SwarmCalc.convertTimeToHours(time, timeUnit);
    const gigabytes = SwarmCalc.convertVolumeToGB(volume, volumeUnit);

    if (!gigabytes) setVolumeError("Volume must be a positive number.");
    if (!hours) setTimeError("The value of time must be greater than zero.");

    if (!hours || !gigabytes || !price) return;
    const block = (hours * 3600) / 5;

    calculateDepth(gigabytes);
    setMinimumDepth(calculateMinimumDepth(gigabytes));
    const totalAmount = SwarmCalc.calculateAmount(block, price);
    setAmount(totalAmount);
  };

  const calculateDepth = (gigabytes: number) => {
    const volumeToDepth = SwarmCalc.getVolumeToDepth();
    const keys = Object.keys(volumeToDepth)
      .map((key) => parseFloat(key))
      .sort((a, b) => a - b);

    const foundKey = keys.find((key) => key >= gigabytes);
    setDepth(foundKey ? volumeToDepth[foundKey.toFixed(2)] : 0);
  };

  const calculateMinimumDepth = (gigabytes: number) => {
    for (let depth = 17; depth <= 41; depth++) {
      if (gigabytes <= Math.pow(2, 12 + depth) / 1024 ** 3) {
        return depth;
      }
    }
    return 0;
  };

  useEffect(() => {
    const cost = SwarmCalc.calculateStorageCost(depth, amount);
    setCalculateData([depth, amount, minimumDepth, cost]);
  }, [depth, amount, minimumDepth, storageCost]);

  return (
    <div className="flex flex-col space-y-2 w-[86%] mx-auto p-2 bg-white text-black">
      <div className="flex justify-between items-center space-x-2">
        <Input
          type="text"
          placeholder="Volume (> 0)"
          className="w-full text-sm font-bold"
          onChange={(e) => setVolume(parseFloat(e.target.value))}
        />
        <select
          className="text-sm p-1 border rounded w-24 font-bold"
          value={volumeUnit}
          onChange={(e) => setVolumeUnit(e.target.value as volumeUnitType)}
        >
          <option value="MB">MB</option>
          <option value="GB">GB</option>
          <option value="TB">TB</option>
          <option value="PB">PB</option>
        </select>
      </div>
      {!!volumeError && <p className="text-red-500 text-xs">{volumeError}</p>}

      <div className="flex justify-between items-center space-x-2">
        <Input
          type="text"
          placeholder="Time (>= 24 hrs)"
          className="w-full text-sm font-bold"
          onChange={(e) => setTime(parseFloat(e.target.value))}
        />

        <select
          className="text-sm p-1 border rounded w-24 font-bold "
          value={timeUnit}
          onChange={(e) => setTimeUnit(e.target.value as timeUnitType)}
        >
          <option value={`${timeUnitType.HOURS}`}>Hours</option>
          <option value={`${timeUnitType.DAYS}`}>Days</option>
          <option value={`${timeUnitType.WEEKS}`}>Weeks</option>
          <option value={`${timeUnitType.YEARS}`}>Years</option>
        </select>
      </div>

      {!!timeError && <p className="text-red-500 text-xs">{timeError}</p>}

      {!!storageCost && (
        <div className="text-center mt-2 font-bold">
          <p className="text-sm">Storage cost: {storageCost} BZZ</p>
        </div>
      )}
    </div>
  );
}
