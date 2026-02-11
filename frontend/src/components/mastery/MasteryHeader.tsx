/**
 * Mastery session header - matches original QuizHeader design.
 * Center: stage badge pill with gradient + combo.
 */
import { memo } from 'react';
import { ArrowLeft, Circle, Sprout, TreePine, TreeDeciduous, Cherry } from 'lucide-react';
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

const STAGE_GRADIENTS: Record<number, [string, string]> = {
  1: ['#9CA3AF', '#6B7280'],
  2: ['#10B981', '#059669'],
  3: ['#3B82F6', '#2563EB'],
  4: ['#F59E0B', '#D97706'],
  5: ['#EF4444', '#DC2626'],
};

const STAGE_ICONS: Record<number, React.ComponentType<{ className?: string }>> = {
  1: Circle, 2: Sprout, 3: TreePine, 4: TreeDeciduous, 5: Cherry,
};

export const MasteryHeader = memo(function MasteryHeader({
  stage,
  currentIndex,
  totalInBatch,
  combo,
  onExit,
}: MasteryHeaderProps) {
  const config = STAGE_CONFIG[stage as StageNumber];
  const [c1, c2] = STAGE_GRADIENTS[stage] ?? ['#9CA3AF', '#6B7280'];
  const StageIcon = STAGE_ICONS[stage] ?? Circle;

  return (
    <div className="flex items-center justify-between h-14 px-5 md:px-8 w-full">
      {/* Left: back button */}
      <button
        onClick={onExit}
        className="w-10 h-10 rounded-full flex items-center justify-center"
      >
        <ArrowLeft className="w-[22px] h-[22px] text-text-primary" />
      </button>

      {/* Center: stage badge + combo */}
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-[5px] rounded-full px-3.5 py-[5px]"
          style={{
            background: `linear-gradient(90deg, ${c1}, ${c2})`,
            boxShadow: `0 0 8px ${c1}30`,
          }}
        >
          <StageIcon className="w-3.5 h-3.5 text-white" />
          <span className="font-display text-[13px] font-bold text-white">
            {config?.label} {stage}
          </span>
        </div>
        {combo >= 2 && <ComboCounter combo={combo} />}
      </div>

      {/* Right: counter */}
      <span className="font-display text-[15px] font-semibold text-text-secondary">
        {currentIndex + 1} / {totalInBatch}
      </span>
    </div>
  );
});
