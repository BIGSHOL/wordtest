interface GradientProgressBarProps {
  current: number;
  total: number;
}

export function GradientProgressBar({ current, total }: GradientProgressBarProps) {
  const percent = total > 0 ? (current / total) * 100 : 0;

  return (
    <div className="h-1.5 px-5 lg:px-12 w-full">
      <div className="h-1.5 rounded-full bg-bg-muted w-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${percent}%`,
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
          }}
        />
      </div>
    </div>
  );
}
