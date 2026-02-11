/**
 * Metric detail section - 4 metrics with progress bars + descriptions.
 * Matches Pencil design node e9Sp4.
 */
import type { MetricDetail } from '../../types/report';

interface Props {
  details: MetricDetail[];
}

const KEY_TO_TITLE: Record<string, string> = {
  vocabulary_level: 'Vocabulary Level',
  accuracy: 'Accuracy',
  speed: 'Speed',
  vocabulary_size: 'Vocabulary Size',
};

export function MetricDetailSection({ details }: Props) {
  return (
    <div className="space-y-0">
      <h3 className="text-base font-semibold text-[#0D0D0D] mb-4">
        영역별 세부 평가 결과
      </h3>

      {details.map((detail) => (
        <div
          key={detail.key}
          className="flex gap-6 py-5 border-t border-[#E8E8E8]"
        >
          {/* Left: Title + Bars */}
          <div className="w-[280px] shrink-0 space-y-3">
            <h4 className="text-lg font-semibold text-[#0D0D0D]" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
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
                  style={{ width: `${Math.max(5, (detail.my_score / 10) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-bold text-[#CC0000] w-6 text-right">
                {Math.round(detail.my_score)}
              </span>
            </div>

            {/* Average bar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-[#7A7A7A] w-[55px] shrink-0">
                회원평균
              </span>
              <div className="flex-1 h-4 bg-[#F0F0F0] rounded-sm relative">
                <div
                  className="h-full bg-[#999999] rounded-sm"
                  style={{ width: `${Math.max(5, (detail.avg_score / 10) * 100)}%` }}
                />
              </div>
              <span className="text-xs font-medium text-[#999999] w-6 text-right">
                {detail.avg_score.toFixed(1)}
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
                {detail.raw_value}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
