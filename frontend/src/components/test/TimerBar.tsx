import { Timer } from 'lucide-react';
import { type TimerUrgency, URGENCY_CONFIG } from '../../hooks/useTimer';

interface TimerBarProps {
  secondsLeft: number;
  fraction: number;
  urgency: TimerUrgency;
}

export function TimerBar({ secondsLeft, fraction, urgency }: TimerBarProps) {
  const config = URGENCY_CONFIG[urgency];
  const percent = Math.max(0, Math.min(100, fraction * 100));

  return (
    <div className="flex items-center gap-3 w-full">
      <Timer className="w-4 h-4 shrink-0" style={{ color: config.color }} />
      <div className="h-2.5 rounded-full bg-bg-muted w-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-1000 ease-linear ${
            urgency === 'warning' || urgency === 'critical' ? 'animate-pulse' : ''
          }`}
          style={{
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${config.barColors[0]}, ${config.barColors[1]})`,
            ...(urgency === 'warning' || urgency === 'critical'
              ? { boxShadow: `0 0 ${urgency === 'critical' ? 14 : 8}px ${config.barColors[0]}60` }
              : {}),
          }}
        />
      </div>
      <span
        className={`font-display text-sm font-bold shrink-0 tabular-nums ${
          urgency === 'critical' ? 'animate-bounce' : ''
        }`}
        style={{ color: config.color }}
      >
        {secondsLeft}s
      </span>
    </div>
  );
}
