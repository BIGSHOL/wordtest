/**
 * Overall result section - level badge, recommended book, 3 info badges.
 * Matches Pencil design node sVrdK.
 */
import type { EnhancedTestReport } from '../../types/report';

interface Props {
  report: EnhancedTestReport;
}

const LEVEL_NAMES: Record<number, string> = {
  1: 'Iron',
  2: 'Bronze',
  3: 'Silver',
  4: 'Gold',
  5: 'Platinum',
  6: 'Emerald',
  7: 'Diamond',
  8: 'Master',
  9: 'Grandmaster',
  10: 'Challenger',
  11: 'LEGEND', 12: 'LEGEND', 13: 'LEGEND', 14: 'LEGEND', 15: 'LEGEND',
};

export function OverallResult({ report }: Props) {
  const level = report.test_session.determined_level || 1;
  const levelName = LEVEL_NAMES[level] || '';

  return (
    <div className="flex-1 border border-[#E8E8E8] rounded-sm p-5 space-y-4">
      <h3 className="text-lg font-bold text-[#0D0D0D]">종합 평가 결과</h3>

      {/* Level badge + Book info */}
      <div className="flex items-center gap-4">
        {/* Book info */}
        <div className="flex-1 space-y-1">
          <p className="text-xs text-[#7A7A7A]">추천 교재</p>
          <p className="text-base font-bold text-[#CC0000]">
            {report.recommended_book}
          </p>
        </div>

        {/* Level badge */}
        <div className="w-[80px] h-[80px] rounded-full border-[3px] border-[#CC0000] flex flex-col items-center justify-center">
          <span className="text-[#CC0000] text-xl font-bold leading-none">Lv.{level}</span>
          <span className="text-[#CC0000] text-[11px] font-semibold leading-tight mt-0.5">
            {levelName}
          </span>
        </div>
      </div>

      {/* 3 info badges */}
      <div className="flex gap-2">
        <InfoBadge title="학년수준" value={report.grade_level} />
        <InfoBadge title="어휘수준" value={report.vocab_description} />
        <InfoBadge
          title="동학년순위"
          value={
            report.peer_ranking
              ? `상위 ${report.peer_ranking.percentile}%`
              : '-'
          }
        />
      </div>
    </div>
  );
}

function InfoBadge({ title, value }: { title: string; value: string }) {
  return (
    <div className="flex-1 border border-[#CC0000] rounded p-2.5 text-center space-y-1">
      <p className="text-xs font-bold text-[#CC0000]">{title}</p>
      <p className="text-xs font-semibold text-[#0D0D0D] leading-tight">
        {value}
      </p>
    </div>
  );
}
