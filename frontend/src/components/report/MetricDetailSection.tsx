/**
 * Metric detail section - 6 skill areas with progress bars + descriptions.
 * Compact layout designed to fit A4 page together with overview + level chart.
 */
import type { MetricDetail } from '../../types/report';

interface Props {
  details: MetricDetail[];
}

const SKILL_ICONS: Record<string, string> = {
  meaning: '📖',
  association: '🔗',
  listening: '👂',
  inference: '🧠',
  spelling: '✏️',
  comprehensive: '⭐',
};

export function MetricDetailSection({ details }: Props) {
  return (
    <div className="space-y-0">
      <h3 className="text-[15px] font-bold text-[#0D0D0D] mb-2">
        영역별 세부 평가 결과
      </h3>

      {details.map((detail) => {
        const myBarW = Math.max(5, (detail.my_score / 10) * 100);
        const avgScore = 5.0; // fixed 50% for all areas
        const avgBarW = 50;
        const icon = SKILL_ICONS[detail.key] || '';

        return (
          <div
            key={detail.key}
            className="flex gap-4 py-[9px] border-t border-[#E8E8E8]"
          >
            {/* Left: Title + Bars */}
            <div className="w-[220px] shrink-0 space-y-1">
              <h4 className="text-[13px] font-bold text-[#0D0D0D] flex items-center gap-1.5">
                {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
                {detail.name}
              </h4>

              {/* My score bar */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#555] w-[48px] shrink-0">
                  나의점수
                </span>
                <div className="flex-1 h-[14px] bg-[#F0F0F0] rounded-sm relative">
                  <div
                    className="h-full bg-[#CC0000] rounded-sm"
                    style={{ width: `${myBarW}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-[#CC0000] w-10 text-right whitespace-nowrap">
                  {Math.round(detail.my_score * 10)}%
                </span>
              </div>

              {/* Average bar */}
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-[#555] w-[48px] shrink-0">
                  동학년평균
                </span>
                <div className="flex-1 h-[14px] bg-[#F0F0F0] rounded-sm relative">
                  <div
                    className="h-full bg-[#999999] rounded-sm"
                    style={{ width: `${avgBarW}%` }}
                  />
                </div>
                <span className="text-xs font-medium text-[#999999] w-10 text-right whitespace-nowrap">
                  {Math.round(avgScore * 10)}%
                </span>
              </div>
            </div>

            {/* Right: Description text */}
            <div className="flex-1 flex items-center">
              <p className="text-xs leading-relaxed text-[#555]">
                {detail.description}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
