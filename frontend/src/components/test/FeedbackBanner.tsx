import { memo } from 'react';
import { CircleCheck, CircleX, Zap } from 'lucide-react';

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

/** Streak progress - step dots with glow + pulse */
function StreakProgress({ current, required }: { current: number; required: number }) {
  return (
    <>
      <style>{`
        @keyframes streak-pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 4px #34D399; }
          50% { transform: scale(1.3); box-shadow: 0 0 12px #34D399, 0 0 20px #34D39960; }
        }
        @keyframes streak-zap {
          0% { transform: scale(0.8); opacity: 0.6; }
          50% { transform: scale(1.2); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>
      <div className="flex items-center gap-2.5 ml-[32px]">
        <Zap
          className="w-4 h-4"
          style={{
            color: '#10B981',
            fill: '#10B981',
            animation: 'streak-zap 0.4s ease-out',
            filter: 'drop-shadow(0 0 4px #10B98180)',
          }}
        />
        <div className="flex items-center gap-1.5">
          {Array.from({ length: required }, (_, i) => {
            const filled = i < current;
            const isLatest = i === current - 1;
            return (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 10,
                  height: 10,
                  background: filled
                    ? 'linear-gradient(135deg, #34D399, #10B981)'
                    : '#D1D5DB',
                  boxShadow: filled ? '0 0 6px #34D39980' : undefined,
                  animation: isLatest ? 'streak-pulse 0.8s ease-in-out' : undefined,
                  transition: 'all 0.3s',
                }}
              />
            );
          })}
        </div>
        <span className="font-display text-[12px] font-bold text-emerald-600 tabular-nums">
          {current}/{required}
        </span>
      </div>
    </>
  );
}
