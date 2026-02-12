/**
 * Segment progress bar for Stage Test.
 * Shows word distribution across stages as colored segments (left=mastered → right=waiting).
 * Matches the Pencil design in wordtest.pen.
 */
import type { StageWord } from '../../stores/stageTestStore';

interface StageProgressBarProps {
  words: StageWord[];
  totalWords: number;
}

interface Segment {
  key: string;
  count: number;
  color: string;
  textColor: string;
  label: string;
  labelFull: string;
}

const SEGMENT_DEFS = [
  { key: 'master', color: '#22C55E', textColor: '#16A34A', label: 'M', labelFull: 'Master' },
  { key: 's4', color: '#F97316', textColor: '#EA580C', label: 'S4', labelFull: 'Stage 4' },
  { key: 's3', color: '#F59E0B', textColor: '#D97706', label: 'S3', labelFull: 'Stage 3' },
  { key: 's2', color: '#3B82F6', textColor: '#2563EB', label: 'S2', labelFull: 'Stage 2' },
  { key: 's1', color: '#94A3B8', textColor: '#64748B', label: 'S1', labelFull: 'Stage 1' },
  { key: 'wait', color: '#E5E7EB', textColor: '#9CA3AF', label: '대기', labelFull: '대기' },
] as const;

function computeSegments(words: StageWord[], totalWords: number): Segment[] {
  let masterCount = 0;
  let s4Count = 0;
  let s3Count = 0;
  let s2Count = 0;
  let s1Count = 0;
  let waitCount = 0;

  for (const w of words) {
    if (w.status === 'mastered') { masterCount++; continue; }
    if (w.status === 'skipped') { masterCount++; continue; } // skipped counts as "done"
    if (w.status === 'untested') { waitCount++; continue; }
    // active
    if (w.stage >= 4) s4Count++;
    else if (w.stage === 3) s3Count++;
    else if (w.stage === 2) s2Count++;
    else s1Count++;
  }

  // Account for words not in the words array (edge case)
  const counted = masterCount + s4Count + s3Count + s2Count + s1Count + waitCount;
  if (counted < totalWords) {
    waitCount += totalWords - counted;
  }

  const counts = [masterCount, s4Count, s3Count, s2Count, s1Count, waitCount];
  return SEGMENT_DEFS.map((def, i) => ({
    ...def,
    count: counts[i],
  }));
}

export function StageProgressBar({ words, totalWords }: StageProgressBarProps) {
  const segments = computeSegments(words, totalWords);
  const activeSegments = segments.filter((s) => s.count > 0);

  return (
    <div className="w-full px-4 py-1.5 md:px-8 lg:px-20">
      {/* Segment bar */}
      <div className="w-full h-3 md:h-3.5 lg:h-4 flex gap-0.5 rounded-md overflow-hidden bg-[#F3F4F6]">
        {activeSegments.map((seg, i) => {
          const pct = (seg.count / totalWords) * 100;
          const isFirst = i === 0;
          const isLast = i === activeSegments.length - 1;
          return (
            <div
              key={seg.key}
              className="h-full transition-all duration-500 ease-out"
              style={{
                width: `${pct}%`,
                backgroundColor: seg.color,
                borderRadius: isFirst && isLast
                  ? '6px'
                  : isFirst
                  ? '6px 0 0 6px'
                  : isLast
                  ? '0 6px 6px 0'
                  : '0',
              }}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-2.5 md:gap-4 mt-1.5">
        {segments.map((seg) => (
          <div key={seg.key} className="flex items-center gap-1">
            <div
              className="w-2 h-2 md:w-2.5 md:h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            {/* Mobile: short label, Desktop: full label */}
            <span
              className="font-display text-[10px] md:text-[11px] lg:text-xs font-semibold md:hidden"
              style={{ color: seg.textColor }}
            >
              {seg.label}:{seg.count}
            </span>
            <span
              className="font-display text-[11px] lg:text-xs font-semibold hidden md:inline"
              style={{ color: seg.textColor }}
            >
              {seg.labelFull}: {seg.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
