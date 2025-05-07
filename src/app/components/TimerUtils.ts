import { useState, useEffect, useRef } from "react";

// Type for the status message (extracted from the main component)
interface StatusMessage {
  step: string;
  message: string;
  error?: string;
  isError?: boolean;
  isSuccess?: boolean;
}

// Timer hook that encapsulates all timer-related functionality
export const useTimer = (statusMessage: StatusMessage) => {
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Timer effect to count down the remaining time
  useEffect(() => {
    // Clear any existing timer first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Start a new timer if we have an estimated time and we're in the Route step
    if (estimatedTime !== null && statusMessage.step === "Route") {
      console.log("Starting timer with duration:", estimatedTime);

      // Initialize the remaining time if it's not set
      if (remainingTime === null) {
        const buffer: number = 10;
        setRemainingTime(estimatedTime + buffer);
      }

      // Create the interval
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime((prevTime) => {
          const newTime = prevTime !== null ? prevTime - 1 : 0;
          // Reduce log frequency to avoid console spam
          if (newTime % 5 === 0) {
            console.log("Timer tick, remaining time:", newTime);
          }

          if (newTime <= 0) {
            if (timerIntervalRef.current) {
              clearInterval(timerIntervalRef.current);
              timerIntervalRef.current = null;
            }
            return 0;
          }
          return newTime;
        });
      }, 1000);
    }

    // Clean up function
    return () => {
      if (timerIntervalRef.current) {
        console.log("Cleaning up timer");
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
  }, [estimatedTime, statusMessage.step]);

  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  // Update the reset function to also clear the interval
  const resetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setEstimatedTime(null);
    setRemainingTime(null);
  };
  
  return {
    estimatedTime,
    setEstimatedTime,
    remainingTime,
    formatTime,
    resetTimer
  };
};
