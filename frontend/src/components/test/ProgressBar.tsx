/**
 * Test progress bar component.
 */
interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const pct = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm text-text-secondary">
        <span>{current} / {total}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="w-full h-2 bg-[#E2E8F0] rounded-full overflow-hidden">
        <div
          className="h-full bg-primary rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
