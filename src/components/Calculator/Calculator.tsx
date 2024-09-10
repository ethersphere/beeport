"use client";
import { Input } from "@/components/ui/Input";
import { useBzz } from "@/context/Bzz";
import React, { useState, useEffect } from "react";

export default function Calculator() {
  const [price, setPrice] = useState<any>(null);
  const [time, setTime] = useState("");
  const [timeUnit, setTimeUnit] = useState("hours");
  const [volume, setVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState("GB");
  const [convertedTime, setConvertedTime] = useState<number | null>(null);
  const [minimumDepth, setMinimumDepth] = useState<number | null>(0);
  const [depth, setDepth] = useState<number | null | "No suitable depth found">(
    null
  );

  const { bzzAmount, setBzzAmount } = useBzz();

  const [amount, setAmount] = useState<number | null>(null);
  const [storageCost, setStorageCost] = useState("");
  const [minimumDepthStorageCost, setMinimumDepthStorageCost] = useState<
    string | null
  >(null);
  const [timeError, setTimeError] = useState("");
  const [volumeError, setVolumeError] = useState("");

  // Fetch the price on component mount
  useEffect(() => {
    fetchPrice();
  }, []);

  // Auto calculate whenever time, volume, timeUnit, or volumeUnit change
  useEffect(() => {
    if (price) {
      handleCalculate();
    }
  }, [time, timeUnit, volume, volumeUnit]);

  // Auto calculate storage cost when depth, amount, or minimumDepth change
  useEffect(() => {
    if (depth !== null && amount !== null) {
      calculateStorageCost();
    }
    if (minimumDepth !== null && amount !== null) {
      calculateMinimumDepthStorageCost();
    }
  }, [depth, amount, minimumDepth]);

  const fetchPrice = async () => {
    try {
      const response = await fetch(
        "https://api.swarmscan.io/v1/events/storage-price-oracle/price-update"
      );
      if (!response.ok) throw new Error("Network response was not ok");
      const data = await response.json();
      if (data.events && data.events.length > 0) {
        setPrice(parseFloat(data.events[0].data.price));
      } else {
        console.error("No price update available.");
      }
    } catch (error: any) {
      console.error("Error fetching price:", error?.message);
    }
  };

  const handleCalculate = () => {
    setTimeError("");
    setVolumeError("");

    const hours = convertTimeToHours(time, timeUnit);
    const gigabytes = convertVolumeToGB(volume, volumeUnit);

    if (!hours || !gigabytes) return;

    setConvertedTime(hours);
    calculateDepth(gigabytes);
    setMinimumDepth(calculateMinimumDepth(gigabytes));
    calculateAmount((hours * 3600) / 5);
  };

  const calculateDepth = (gigabytes: number) => {
    const volumeToDepth: { [key: string]: number } = {
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

    const keys = Object.keys(volumeToDepth)
      .map((key) => parseFloat(key))
      .sort((a, b) => a - b);
    let foundKey = keys.find((key) => key >= gigabytes);
    setDepth(
      foundKey ? volumeToDepth[foundKey.toFixed(2)] : "No suitable depth found"
    );
  };

  const calculateMinimumDepth = (gigabytes: number) => {
    for (let depth = 17; depth <= 41; depth++) {
      if (gigabytes <= Math.pow(2, 12 + depth) / 1024 ** 3) {
        return depth;
      }
    }
    return null;
  };

  const calculateAmount = (blocks: number) => {
    if (price !== null && !isNaN(blocks)) {
      const totalAmount = blocks * price;
      setAmount(totalAmount);
    } else {
      setAmount(0); // Valor por defecto si no es posible el cálculo
    }
  };

  const calculateStorageCost = () => {
    if (depth !== null && amount !== null && !isNaN(amount)) {
      const cost = (2 ** (depth as number) * (amount as number)) / 1e16;
      setStorageCost(cost.toFixed(4));
      setBzzAmount(cost.toFixed(4));
    } else {
      setStorageCost("0.0000");
    }
  };

  const calculateMinimumDepthStorageCost = () => {
    if (minimumDepth !== null && amount !== null) {
      const cost = (2 ** minimumDepth * amount) / 1e16;
      setMinimumDepthStorageCost(cost.toFixed(4));
    }
  };

  const convertTimeToHours = (time: string, unit: string) => {
    const num = parseFloat(time);
    if (isNaN(num) || num <= 0) {
      setTimeError("Time must be a positive number greater than 24 hrs.");
      return 0;
    }
    const hours =
      num *
      (unit === "years"
        ? 8760
        : unit === "weeks"
        ? 168
        : unit === "days"
        ? 24
        : 1);
    if (hours < 24) {
      setTimeError("Time must be longer than 24 hours.");
      return 0;
    }
    return hours;
  };

  const convertVolumeToGB = (volume: string, unit: string) => {
    const num = parseFloat(volume);
    if (isNaN(num) || num <= 0) {
      setVolumeError("Volume must be a positive number.");
      return 0;
    }
    const gigabytes =
      num *
      (unit === "TB"
        ? 1024
        : unit === "PB"
        ? 1048576
        : unit === "MB"
        ? 1 / 1024
        : 1);
    if (gigabytes <= 0 || gigabytes > 9437184) {
      setVolumeError("Volume must be greater than 0 and less than 9 PB.");
      return 0;
    }
    return gigabytes;
  };

  return (
    <div className="flex flex-col space-y-2 w-[86%] mx-auto p-2 bg-white text-black">
      <div className="flex justify-between items-center space-x-2">
        <Input
          type="text"
          placeholder="Time (>= 24 hrs)"
          className="w-full text-sm font-bold"
          onChange={(e) => setTime(e.target.value)}
        />
        <select
          className="text-sm p-1 border rounded w-24 font-bold "
          value={timeUnit}
          onChange={(e) => setTimeUnit(e.target.value)}
        >
          <option value="hours">Hours</option>
          <option value="days">Days</option>
          <option value="weeks">Weeks</option>
          <option value="years">Years</option>
        </select>
      </div>
      {timeError && <p className="text-red-500 text-xs">{timeError}</p>}

      <div className="flex justify-between items-center space-x-2">
        <Input
          type="text"
          placeholder="Volume (> 0)"
          className="w-full text-sm font-bold"
          onChange={(e) => setVolume(e.target.value)}
        />
        <select
          className="text-sm p-1 border rounded w-24 font-bold"
          value={volumeUnit}
          onChange={(e) => setVolumeUnit(e.target.value)}
        >
          <option value="GB">GB</option>
          <option value="MB">MB</option>
          <option value="TB">TB</option>
          <option value="PB">PB</option>
        </select>
      </div>
      {volumeError && <p className="text-red-500 text-xs">{volumeError}</p>}

      {storageCost && (
        <div className="text-center mt-2 font-bold">
          <p className="text-sm">Storage cost: {storageCost} BZZ</p>
        </div>
      )}
    </div>
  );
}
