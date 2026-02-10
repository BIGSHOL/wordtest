import { RankBadge } from '../test/RankBadge';
import { getLevelRank } from '../../types/rank';
import { formatDuration, computeDuration } from './helpers';
import type { TestSessionData } from '../../services/test';

function MobileStatCard({
  value,
  label,
  color,
  isRank,
  rank,
  level,
}: {
  value: string;
  label: string;
  color: string;
  isRank?: boolean;
  rank?: ReturnType<typeof getLevelRank> | null;
  level?: number | null;
}) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 rounded-[14px] bg-white py-3.5 px-3">
      {isRank && rank && level ? (
        <span className="font-display text-xl font-extrabold" style={{ color }}>
          Lv.{level} {rank.name}
        </span>
      ) : (
        <span
          className="font-display text-2xl font-extrabold"
          style={{ color, letterSpacing: -1 }}
        >
          {value}
        </span>
      )}
      <span className="font-display text-[11px] text-text-secondary font-medium">
        {label}
      </span>
    </div>
  );
}

export function StatsRow({ session }: { session: TestSessionData }) {
  const accuracy =
    session.total_questions > 0
      ? Math.round((session.correct_count / session.total_questions) * 100)
      : 0;
  const wrongCount = session.total_questions - session.correct_count;
  const duration = computeDuration(session);
  const rank = session.determined_level ? getLevelRank(session.determined_level) : null;

  const stats = [
    { value: `${accuracy}%`, label: '정답률', color: '#4F46E5' },
    { value: `${session.correct_count}/${session.total_questions}`, label: '맞힌 문제', color: '#10B981' },
    { value: `${wrongCount}/${session.total_questions}`, label: '틀린 문제', color: '#EF4444' },
    {
      value: rank ? `Lv.${session.determined_level} ${rank.name}` : '-',
      label: '레벨/랭크',
      color: rank ? rank.colors[1] : '#6D6C6A',
      isRank: true,
      rank,
      level: session.determined_level,
    },
    { value: formatDuration(duration), label: '소요 시간', color: '#2D9CAE' },
  ];

  return (
    <>
      {/* PC: 5 in a row */}
      <div className="hidden lg:flex gap-4 w-full">
        {stats.map((s, i) => (
          <div
            key={i}
            className="flex-1 flex flex-col items-center gap-1.5 rounded-2xl bg-white border border-border-subtle py-5 px-4"
          >
            {s.isRank && s.rank && s.level ? (
              <div className="flex items-center gap-2">
                <RankBadge rank={s.rank} size="sm" />
                <span className="font-display text-lg font-bold" style={{ color: s.color }}>
                  Lv.{s.level} {s.rank.name}
                </span>
              </div>
            ) : (
              <span
                className="font-display text-[28px] lg:text-[32px] font-bold"
                style={{ color: s.color, letterSpacing: -1 }}
              >
                {s.value}
              </span>
            )}
            <span className="font-display text-xs text-text-tertiary font-medium">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* Mobile: grid layout (2-2-1) */}
      <div className="lg:hidden flex flex-col gap-2.5 w-full">
        <div className="flex gap-2.5">
          {stats.slice(0, 2).map((s, i) => (
            <MobileStatCard key={i} {...s} />
          ))}
        </div>
        <div className="flex gap-2.5">
          {stats.slice(2, 4).map((s, i) => (
            <MobileStatCard key={i + 2} {...s} />
          ))}
        </div>
        <MobileStatCard {...stats[4]} />
      </div>
    </>
  );
}
