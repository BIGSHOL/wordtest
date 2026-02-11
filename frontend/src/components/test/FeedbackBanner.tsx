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

/** Streak progress dots + bar */
function StreakProgress({ current, required }: { current: number; required: number }) {
  return (
    <div className="flex items-center gap-2.5 ml-[32px]">
      {/* Dots */}
      <div className="flex items-center gap-1">
        {Array.from({ length: required }, (_, i) => (
          <div
            key={i}
            className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
              i < current
                ? 'bg-emerald-500 scale-110'
                : 'bg-emerald-200'
            }`}
          />
        ))}
      </div>
      {/* Label */}
      <span className="font-display text-xs font-semibold text-emerald-700 tabular-nums">
        {current}/{required}
      </span>
    </div>
  );
}
