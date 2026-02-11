interface StatCardProps {
  value: string;
  label: string;
  color: string;
}

export function StatCard({ value, label, color }: StatCardProps) {
  return (
    <div
      className="flex flex-col items-center gap-1.5 rounded-2xl bg-bg-surface p-4 md:p-5 w-full"
      style={{ boxShadow: '0 2px 8px #1A191808' }}
    >
      <span className="font-display text-[28px] font-bold" style={{ color, letterSpacing: -1 }}>
        {value}
      </span>
      <span className="font-display text-xs font-medium text-text-tertiary">
        {label}
      </span>
    </div>
  );
}
