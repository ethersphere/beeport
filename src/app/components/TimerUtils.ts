import { useState, useEffect, useRef } from 'react';
import { RELAY_TIMER_BUFFER_SECONDS } from './constants';
import { ExecutionStatus } from './types';

/**
 * Custom hook for managing timer functionality
 *
 * @param statusMessage Current execution status
 * @returns Timer-related states and functions
 */
export const useTimer = (statusMessage: ExecutionStatus) => {
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [remainingTime, setRemainingTime] = useState<number | null>(null);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Format seconds into minutes:seconds display format
   *
   * @param seconds Time in seconds
   * @returns Formatted time string (e.g., "2:45")
   */
  const formatTime = (seconds: number): string => {
    if (seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  /**
   * Reset the timer and clear the interval
   */
  const resetTimer = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    setEstimatedTime(null);
    setRemainingTime(null);
  };

  // Timer management effect
  useEffect(() => {
    // Clear any existing timer first
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Start a new timer if we have an estimated time and we're in a relevant step
    if (
      estimatedTime !== null &&
      (statusMessage.step === 'Route' ||
        statusMessage.step === 'deposit' ||
        statusMessage.step === 'Quoting' ||
        statusMessage.step === 'Relay')
    ) {
      console.log('Starting timer with duration:', estimatedTime);

      // Initialize the remaining time if it's not set
      if (remainingTime === null) {
        setRemainingTime(estimatedTime + RELAY_TIMER_BUFFER_SECONDS);
      }

      // Create the interval
      timerIntervalRef.current = setInterval(() => {
        setRemainingTime(prevTime => {
          const newTime = prevTime !== null ? prevTime - 1 : 0;
          // Reduce log frequency to avoid console spam
          if (newTime % 5 === 0) {
            console.log('Timer tick, remaining time:', newTime);
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

    // Cleanup function
    return () => {
      if (timerIntervalRef.current) {
        console.log('Cleaning up timer');
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
    };
    // remainingTime is intentionally omitted to avoid infinite loops
    // The effect only reads remainingTime to check if it's null for initialization
  }, [estimatedTime, statusMessage.step]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    estimatedTime,
    setEstimatedTime,
    remainingTime,
    formatTime,
    resetTimer,
  };
};
