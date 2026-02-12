/**
 * Metric detail section - 4 metrics with progress bars + descriptions.
 * Matches Pencil design node e9Sp4.
 */
import type { MetricDetail } from '../../types/report';

interface Props {
  details: MetricDetail[];
  totalWordCount?: number;
}

const KEY_TO_TITLE: Record<string, string> = {
  vocabulary_level: '어휘 수준',
  accuracy: '정확도',
  speed: '속도',
  vocabulary_size: '어휘 범위',
};

/** Format a 0-10 normalized score into human-readable label per metric key. */
function formatScore(key: string, score: number, raw?: string | null): string {
  switch (key) {
    case 'vocabulary_level':
      return `Lv.${Number.isInteger(score) ? score : score.toFixed(1)}`;
    case 'accuracy':
      return `${Math.round(score * 10)}%`;
    case 'speed':
      return `${(Math.round((10 - score) * 30) / 10).toFixed(1)}초`;
    case 'vocabulary_size':
      if (raw) return raw; // "1,748개" from backend
      return `${Math.round(score * 250)}개`;
    default:
      return String(Math.round(score));
  }
}

/** Estimate avg raw value for vocabulary_size using my_score / raw_value ratio. */
function formatAvgScore(key: string, avgScore: number, myScore: number, raw?: string | null): string {
  if (key === 'vocabulary_size') {
    const rawCount = raw ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : 0;
    if (rawCount > 0 && myScore > 0) {
      const avgCount = Math.round((avgScore / myScore) * rawCount);
      return `${avgCount.toLocaleString()}개`;
    }
    return `${Math.round(avgScore * 250)}개`;
  }
  return formatScore(key, avgScore);
}

/** Calculate bar width % — vocab_size uses raw count / total words for proper proportion. */
function barWidth(key: string, score: number, raw?: string | null, totalWordCount?: number): number {
  if (key === 'vocabulary_size' && totalWordCount && totalWordCount > 0) {
    const rawCount = raw ? parseInt(raw.replace(/[^0-9]/g, ''), 10) : 0;
    if (rawCount > 0) {
      return Math.max(3, Math.min(100, (rawCount / totalWordCount) * 100));
    }
  }
  return Math.max(5, (score / 10) * 100);
}

export function MetricDetailSection({ details, totalWordCount }: Props) {
  return (
    <div className="space-y-0">
      <h3 className="text-base font-semibold text-[#0D0D0D] mb-4">
        영역별 세부 평가 결과
      </h3>

      {details.map((detail) => {
        const myLabel = formatScore(detail.key, detail.my_score, detail.raw_value);
        const avgLabel = formatAvgScore(detail.key, detail.avg_score, detail.my_score, detail.raw_value);
        const myBarW = barWidth(detail.key, detail.my_score, detail.raw_value, totalWordCount);
        const avgBarW = detail.key === 'vocabulary_size' && totalWordCount && totalWordCount > 0
          ? (() => {
              const rawCount = detail.raw_value ? parseInt(detail.raw_value.replace(/[^0-9]/g, ''), 10) : 0;
              if (rawCount > 0 && detail.my_score > 0) {
                const avgCount = (detail.avg_score / detail.my_score) * rawCount;
                return Math.max(3, Math.min(100, (avgCount / totalWordCount) * 100));
              }
              return Math.max(5, (detail.avg_score / 10) * 100);
            })()
          : Math.max(5, (detail.avg_score / 10) * 100);

        return (
          <div
            key={detail.key}
            className="flex gap-6 py-5 border-t border-[#E8E8E8]"
          >
            {/* Left: Title + Bars */}
            <div className="w-[280px] shrink-0 space-y-3">
              <h4 className="text-lg font-semibold text-[#0D0D0D]">
                {KEY_TO_TITLE[detail.key] || detail.name}
              </h4>

              {/* My level bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#7A7A7A] w-[55px] shrink-0">
                  나의레벨
                </span>
                <div className="flex-1 h-4 bg-[#F0F0F0] rounded-sm relative">
                  <div
                    className="h-full bg-[#CC0000] rounded-sm"
                    style={{ width: `${myBarW}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#CC0000] w-16 text-right whitespace-nowrap">
                  {myLabel}
                </span>
              </div>

              {/* Average bar */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#7A7A7A] w-[55px] shrink-0">
                  동학년평균
                </span>
                <div className="flex-1 h-4 bg-[#F0F0F0] rounded-sm relative">
                  <div
                    className="h-full bg-[#999999] rounded-sm"
                    style={{ width: `${avgBarW}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#999999] w-16 text-right whitespace-nowrap">
                  {avgLabel}
                </span>
              </div>
            </div>

            {/* Right: Description text */}
            <div className="flex-1">
              <p className="text-xs leading-relaxed text-[#7A7A7A]">
                {detail.description}
              </p>
              {detail.raw_value && (
                <p className="text-xs font-semibold text-[#CC0000] mt-2">
                  {detail.key === 'vocabulary_size'
                    ? `내가 알고 있는 단어: ${detail.raw_value}`
                    : detail.raw_value}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
