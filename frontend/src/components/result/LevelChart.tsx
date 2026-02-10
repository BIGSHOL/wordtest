import { getLevelRank, RANKS } from '../../types/rank';
import type { TestHistoryItem } from '../../services/stats';

export function LevelChart({ history }: { history: TestHistoryItem[] }) {
  const leveled = history.filter((h) => h.determined_level != null);
  if (leveled.length < 2) return null;

  const latest = leveled[leveled.length - 1];
  const latestRank = latest.determined_level
    ? getLevelRank(latest.determined_level)
    : null;

  const barColors: Record<number, { bg: string; fill: string }> = {};
  for (let i = 1; i <= 10; i++) {
    const r = RANKS[Math.min(i - 1, RANKS.length - 1)];
    barColors[i] = {
      bg: `${r.colors[0]}20`,
      fill: r.colors[0],
    };
  }

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-4 lg:p-6 w-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
          레벨 변화
        </h3>
        {latestRank && (
          <span
            className="text-[11px] lg:text-xs font-display font-semibold px-2.5 py-1 rounded-lg"
            style={{
              color: latestRank.colors[1],
              backgroundColor: `${latestRank.colors[0]}20`,
            }}
          >
            {latestRank.name} 달성
          </span>
        )}
      </div>
      <div className="flex flex-col gap-2.5">
        {leveled.slice(-5).map((item, i) => {
          const level = item.determined_level || 1;
          const pct = Math.round((level / 10) * 100);
          const colors = barColors[level] || barColors[1];
          const rank = getLevelRank(level);
          return (
            <div key={i} className="flex items-center gap-3">
              <span className="text-[11px] text-text-tertiary font-display font-medium w-10 shrink-0">
                {item.test_date}
              </span>
              <div
                className="flex-1 h-7 rounded-lg relative overflow-hidden"
                style={{ backgroundColor: colors.bg }}
              >
                <div
                  className="h-full rounded-lg flex items-center px-2"
                  style={{
                    width: `${Math.max(pct, 15)}%`,
                    backgroundColor: colors.fill,
                  }}
                >
                  <span className="text-[11px] text-white font-display font-semibold whitespace-nowrap">
                    Lv.{level} {rank.name}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
