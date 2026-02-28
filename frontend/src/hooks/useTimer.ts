import { useState, useEffect, useRef, useCallback } from 'react';

export type TimerUrgency = 'calm' | 'caution' | 'warning' | 'critical';

interface UseTimerReturn {
  secondsLeft: number;
  fraction: number;
  urgency: TimerUrgency;
  reset: () => void;
  pause: () => void;
  resume: () => void;
}

const URGENCY_CONFIG: Record<TimerUrgency, { color: string; barColors: [string, string] }> = {
  calm: { color: '#4F46E5', barColors: ['#4F46E5', '#7C3AED'] },
  caution: { color: '#D97706', barColors: ['#F59E0B', '#D97706'] },
  warning: { color: '#F97316', barColors: ['#F97316', '#EA580C'] },
  critical: { color: '#DC2626', barColors: ['#EF4444', '#DC2626'] },
};

export { URGENCY_CONFIG };

function getUrgency(fraction: number): TimerUrgency {
  if (fraction > 0.5) return 'calm';
  if (fraction > 0.33) return 'caution';
  if (fraction > 0.25) return 'warning';
  return 'critical';
}

export function useTimer(totalSeconds: number, onTimeout?: () => void): UseTimerReturn {
  const [secondsLeft, setSecondsLeft] = useState(totalSeconds);
  const [paused, setPaused] = useState(false);
  const onTimeoutRef = useRef(onTimeout);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutFiredRef = useRef(false);
  onTimeoutRef.current = onTimeout;

  const fraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const urgency = getUrgency(fraction);

  // Fire timeout callback AFTER "0" is rendered on screen
  useEffect(() => {
    if (secondsLeft === 0 && !paused && timeoutFiredRef.current) {
      timeoutFiredRef.current = false;
      onTimeoutRef.current?.();
    }
  }, [secondsLeft, paused]);

  // Start/stop interval based on paused state
  useEffect(() => {
    if (paused) {
      // Clear interval when paused
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Start interval when not paused
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
          timeoutFiredRef.current = true;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [paused]);

  const reset = useCallback(() => {
    timeoutFiredRef.current = false;
    setSecondsLeft(totalSeconds);
    setPaused(false);
  }, [totalSeconds]);

  const pause = useCallback(() => {
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setPaused(false);
  }, []);

  return { secondsLeft, fraction, urgency, reset, pause, resume };
}