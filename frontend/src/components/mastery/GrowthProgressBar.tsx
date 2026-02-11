/**
 * Growth progress bar - shows word distribution across 5 stages + mastered.
 */
import { memo } from 'react';
import { GrowthIcon } from './GrowthIcon';
import type { StageSummary, StageNumber } from '../../types/mastery';

interface GrowthProgressBarProps {
  summary: StageSummary;
  totalWords: number;
}

const SEGMENTS: { key: keyof StageSummary; stage: StageNumber | 6; label: string; color: string }[] = [
  { key: 'stage_1', stage: 1, label: '씨앗', color: '#9CA3AF' },
  { key: 'stage_2', stage: 2, label: '새싹', color: '#10B981' },
  { key: 'stage_3', stage: 3, label: '묘목', color: '#3B82F6' },
  { key: 'stage_4', stage: 4, label: '나무', color: '#F59E0B' },
  { key: 'stage_5', stage: 5, label: '열매', color: '#EF4444' },
  { key: 'mastered', stage: 6, label: '완료', color: '#FFD700' },
];

export const GrowthProgressBar = memo(function GrowthProgressBar({
  summary,
  totalWords,
}: GrowthProgressBarProps) {
  return (
    <div className="flex flex-col gap-2 w-full px-1">
      {/* Bar */}
      <div className="flex w-full h-3 rounded-full overflow-hidden bg-[#EDECEA]">
        {SEGMENTS.map(({ key, color }) => {
          const count = summary[key] ?? 0;
          const pct = totalWords > 0 ? (count / totalWords) * 100 : 0;
          if (pct === 0) return null;
          return (
            <div
              key={key}
              style={{ width: `${pct}%`, background: color, minWidth: pct > 0 ? 4 : 0 }}
              className="transition-all duration-500"
            />
          );
        })}
      </div>

      {/* Labels */}
      <div className="flex justify-between items-center gap-1">
        {SEGMENTS.map(({ key, stage, label, color }) => {
          const count = summary[key] ?? 0;
          return (
            <div key={key} className="flex flex-col items-center gap-0.5 min-w-0">
              <GrowthIcon stage={stage as StageNumber} size="sm" />
              <span
                className="font-display text-[10px] font-bold tabular-nums"
                style={{ color }}
              >
                {count}
              </span>
              <span className="font-display text-[9px] text-text-tertiary truncate">
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
});
