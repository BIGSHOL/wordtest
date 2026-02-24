import { Clock } from 'lucide-react';

interface TotalTimerDisplayProps {
  secondsLeft: number;
  totalSeconds: number;
}

export function TotalTimerDisplay({ secondsLeft, totalSeconds }: TotalTimerDisplayProps) {
  const minutes = Math.floor(Math.max(0, secondsLeft) / 60);
  const seconds = Math.max(0, secondsLeft) % 60;
  const fraction = totalSeconds > 0 ? secondsLeft / totalSeconds : 1;
  const isUrgent = fraction < 0.15;

  return (
    <div className={`flex items-center gap-1.5 ${isUrgent ? 'animate-pulse' : ''}`}>
      <Clock
        className="w-4 h-4"
        style={{ color: isUrgent ? '#DC2626' : '#6D6C6A' }}
      />
      <span
        className="font-display text-sm font-bold tabular-nums"
        style={{ color: isUrgent ? '#DC2626' : '#3D3D3C' }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </span>
    </div>
  );
}
