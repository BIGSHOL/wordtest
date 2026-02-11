/**
 * Stage transition screen - shown between stages.
 */
import { memo, useEffect } from 'react';
import { GrowthIcon } from './GrowthIcon';
import { STAGE_CONFIG } from '../../types/mastery';
import type { StageNumber, StageSummary } from '../../types/mastery';
import { ArrowRight, Trophy } from 'lucide-react';

interface StageTransitionProps {
  completedStage: number;
  nextStage: number | null; // null = all done
  wordsAdvanced: number;
  wordsMastered: number;
  summary: StageSummary;
  onContinue: () => void;
}

export const StageTransition = memo(function StageTransition({
  completedStage,
  nextStage,
  wordsAdvanced,
  wordsMastered,
  summary: _summary,
  onContinue,
}: StageTransitionProps) {
  // Auto-continue after 3 seconds
  useEffect(() => {
    const timer = setTimeout(onContinue, 4000);
    return () => clearTimeout(timer);
  }, [onContinue]);

  const allDone = nextStage === null;
  const completedConfig = STAGE_CONFIG[completedStage as StageNumber];
  const nextConfig = nextStage ? STAGE_CONFIG[nextStage as StageNumber] : null;

  return (
    <div className="flex flex-col items-center justify-center gap-6 min-h-[60vh] px-6 animate-in fade-in zoom-in-95 duration-500">
      {/* Completed stage icon */}
      <div className="relative">
        <GrowthIcon stage={completedStage as StageNumber} size="lg" animate />
        <div
          className="absolute -inset-4 rounded-full animate-ping opacity-20"
          style={{ background: completedConfig?.color ?? '#9CA3AF' }}
        />
      </div>

      {/* Title */}
      <div className="flex flex-col items-center gap-2">
        <h2 className="font-display text-2xl font-bold text-text-primary">
          {allDone ? '학습 완료!' : `Stage ${completedStage} 완료!`}
        </h2>
        <p className="font-display text-sm text-text-secondary text-center">
          {allDone
            ? `${wordsMastered}개 단어를 완전 마스터했어요!`
            : wordsAdvanced > 0
            ? `${wordsAdvanced}개 단어가 다음 단계로 승급했어요`
            : '연속 정답을 쌓으면 다음 단계로 승급해요'
          }
        </p>
      </div>

      {/* Next stage preview */}
      {nextConfig && (
        <div
          className="flex items-center gap-3 rounded-2xl px-5 py-3.5"
          style={{ background: '#F5F4F1' }}
        >
          <span className="font-display text-sm text-text-tertiary">다음</span>
          <ArrowRight className="w-4 h-4 text-text-tertiary" />
          <GrowthIcon stage={nextStage as StageNumber} size="sm" />
          <span className="font-display text-sm font-semibold text-text-primary">
            Stage {nextStage}: {nextConfig.name}
          </span>
        </div>
      )}

      {allDone && (
        <div className="flex items-center gap-2 text-amber-500">
          <Trophy className="w-6 h-6" />
          <span className="font-display text-lg font-bold">모든 단계를 완료했습니다!</span>
        </div>
      )}

      {/* Continue button */}
      <button
        onClick={onContinue}
        className="flex items-center justify-center gap-2 h-12 px-8 rounded-2xl text-white font-display text-[15px] font-semibold transition-opacity"
        style={{
          background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
          boxShadow: '0 4px 16px #4F46E540',
        }}
      >
        {allDone ? '결과 보기' : '계속하기'}
      </button>

      <p className="font-display text-xs text-text-tertiary">자동으로 진행됩니다...</p>
    </div>
  );
});
