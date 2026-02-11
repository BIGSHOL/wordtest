/**
 * Mastery session header - shows current stage, progress, exit button.
 */
import { memo } from 'react';
import { ArrowLeft } from 'lucide-react';
import { GrowthIcon } from './GrowthIcon';
import { ComboCounter } from './ComboCounter';
import { STAGE_CONFIG } from '../../types/mastery';
import type { StageNumber } from '../../types/mastery';

interface MasteryHeaderProps {
  stage: number;
  currentIndex: number;
  totalInBatch: number;
  combo: number;
  onExit: () => void;
}

export const MasteryHeader = memo(function MasteryHeader({
  stage,
  currentIndex,
  totalInBatch,
  combo,
  onExit,
}: MasteryHeaderProps) {
  const config = STAGE_CONFIG[stage as StageNumber];

  return (
    <div className="flex items-center justify-between px-4 md:px-6 py-3 w-full">
      {/* Left: back + stage info */}
      <div className="flex items-center gap-3">
        <button
          onClick={onExit}
          className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-bg-surface transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="flex items-center gap-2">
          <GrowthIcon stage={stage as StageNumber} size="sm" />
          <div className="flex flex-col">
            <span className="font-display text-[13px] font-bold text-text-primary leading-tight">
              Stage {stage}
            </span>
            <span className="font-display text-[11px] text-text-tertiary leading-tight">
              {config?.name}
            </span>
          </div>
        </div>
      </div>

      {/* Center: combo */}
      <ComboCounter combo={combo} />

      {/* Right: progress counter */}
      <div className="flex items-center gap-1">
        <span className="font-display text-sm font-bold text-accent-indigo tabular-nums">
          {currentIndex + 1}
        </span>
        <span className="font-display text-sm text-text-tertiary">/</span>
        <span className="font-display text-sm text-text-tertiary tabular-nums">
          {totalInBatch}
        </span>
      </div>
    </div>
  );
});
