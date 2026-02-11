import type { TestHistoryItem } from '../../services/stats';

export function AccuracyChart({ history }: { history: TestHistoryItem[] }) {
  if (history.length < 2) return null;

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const diff = latest.accuracy - prev.accuracy;
  const diffText = diff >= 0 ? `+${diff}% 상승` : `${diff}% 하락`;
  const diffColor = diff >= 0 ? '#2D9CAE' : '#EF4444';
  const diffBg = diff >= 0 ? '#EBF8FA' : '#FEF2F2';

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-4 lg:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          정답률 추이
        </h3>
        <span
          className="text-[11px] lg:text-xs font-display font-semibold px-2.5 py-1 rounded-lg"
          style={{ color: diffColor, backgroundColor: diffBg }}
        >
          {diffText}
        </span>
      </div>
      <div className="flex items-end gap-0 h-[120px] lg:h-[160px]">
        {history.slice(-5).map((item, i) => {
          const barH = Math.max(item.accuracy, 8);
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="flex-1 w-full flex items-end justify-center">
                <div
                  className="w-8 lg:w-9 rounded-t-lg"
                  style={{
                    height: `${barH}%`,
                    background: 'linear-gradient(180deg, #2D9CAE, #3DBDC8)',
                  }}
                />
              </div>
              <span className="text-[10px] font-bold text-teal mt-1">
                {item.accuracy}%
              </span>
              <span className="text-[9px] text-text-tertiary">
                {item.test_date}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
