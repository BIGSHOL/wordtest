/**
 * Time breakdown section - total time + category times.
 * Matches Pencil design node v6tTI.
 */

interface Props {
  totalTime: number | null | undefined;
  categories: Record<string, number>;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}분 ${String(s).padStart(2, '0')}초`;
}

export function TimeBreakdown({ totalTime, categories }: Props) {
  return (
    <div className="w-[180px] border border-[#E8E8E8] rounded-sm p-5 space-y-3">
      <h3 className="text-base font-semibold text-[#0D0D0D]">소요시간</h3>

      {/* Total */}
      <div className="space-y-1">
        <p className="text-xs text-[#7A7A7A]">Total</p>
        <p className="text-lg font-bold text-[#CC0000]">
          {totalTime != null ? formatTime(totalTime) : '-'}
        </p>
      </div>

      {/* Separator */}
      <div className="h-px bg-[#E8E8E8]" />

      {/* Category times */}
      {Object.entries(categories).map(([name, seconds]) => (
        <div key={name} className="flex justify-between items-center">
          <span className="text-xs text-[#7A7A7A]">{name}</span>
          <span className="text-xs font-medium text-[#0D0D0D]">
            {formatTime(seconds)}
          </span>
        </div>
      ))}
    </div>
  );
}
