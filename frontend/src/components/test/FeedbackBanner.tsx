import { memo } from 'react';
import { CircleCheck, CircleX } from 'lucide-react';

interface FeedbackBannerProps {
  isCorrect: boolean;
  correctAnswer?: string;
  stageStreak?: number;
  requiredStreak?: number;
}

export const FeedbackBanner = memo(function FeedbackBanner({
  isCorrect,
  correctAnswer,
  stageStreak,
  requiredStreak,
}: FeedbackBannerProps) {
  const showStreak = isCorrect && stageStreak != null && requiredStreak != null && requiredStreak > 1;
  const didAdvance = showStreak && stageStreak === 0; // streak resets to 0 after advancing

  if (isCorrect) {
    return (
      <div className="flex flex-col gap-2 rounded-2xl bg-correct-light px-5 md:px-8 py-3.5 w-full">
        <div className="flex items-center gap-2.5">
          <CircleCheck className="w-[22px] h-[22px] text-correct shrink-0" />
          <span className="font-display text-[15px] font-semibold" style={{ color: '#065F46' }}>
            {didAdvance ? '스테이지 UP!' : '정답입니다!'}
          </span>
        </div>
        {showStreak && !didAdvance && requiredStreak > 0 && (
          <StreakProgress current={stageStreak} required={requiredStreak} />
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-wrong-light px-5 md:px-8 py-3.5 w-full">
      <CircleX className="w-[22px] h-[22px] text-wrong shrink-0" />
      <span className="font-display text-sm font-semibold" style={{ color: '#991B1B' }}>
        아쉬워요! 정답은 &lsquo;{correctAnswer}&rsquo; 입니다
      </span>
    </div>
  );
});

/** Streak progress - mini bar with lightning icon */
function StreakProgress({ current, required }: { current: number; required: number }) {
  const pct = required > 0 ? (current / required) * 100 : 0;
  return (
    <div className="flex items-center gap-2 ml-[32px]">
      {/* Mini progress bar */}
      <div className="w-16 h-[5px] rounded-full bg-emerald-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(90deg, #34D399, #10B981)',
          }}
        />
      </div>
      {/* Label */}
      <span className="font-display text-[11px] font-bold text-emerald-600 tabular-nums">
        {current}/{required}
      </span>
    </div>
  );
}
