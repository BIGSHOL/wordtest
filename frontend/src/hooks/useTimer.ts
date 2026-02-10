import { useState, useEffect, useRef, useCallback } from 'react';

export type TimerUrgency = 'calm' | 'caution' | 'warning' | 'critical';

interface UseTimerReturn {
  secondsLeft: number;
  fraction: number;
  urgency: TimerUrgency;
  reset: () => void;
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
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  const fraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const urgency = getUrgency(fraction);

  useEffect(() => {
    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          onTimeoutRef.current?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, []); // interval은 한 번만 생성, reset()으로 재시작

  const reset = useCallback(() => {
    setSecondsLeft(totalSeconds);
  }, [totalSeconds]);

  return { secondsLeft, fraction, urgency, reset };
}
