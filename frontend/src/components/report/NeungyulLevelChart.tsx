/**
 * 능률 VOCA 4-column level chart with red circle marker.
 * Used when book_series === 'neungyul' in mastery reports.
 */

interface Props {
  currentRank: number | null; // 1-4
}

const LEVELS = [
  { rank: 1, name: '기초', color: '#2D9CAE', bg: '#EBF8FA' },
  { rank: 2, name: '기초 확장', color: '#1A7A8A', bg: '#E0F0F3' },
  { rank: 3, name: '심화', color: '#CC0000', bg: '#FFF0F0' },
  { rank: 4, name: '심화 확장', color: '#991111', bg: '#FFE8E8' },
];

const BOOKS = [
  '능률 VOCA\n중등 기본',
  '능률 VOCA\n중등 기본\n파생어',
  '능률 VOCA\n중등 고난도',
  '능률 VOCA\n중등 고난도\n파생어',
];

export function NeungyulLevelChart({ currentRank }: Props) {
  const chartRank = currentRank && currentRank >= 1 && currentRank <= 4 ? currentRank : null;
  const fraction = chartRank ? (chartRank - 0.5) / 4 : 0;
  const circleLeft = `calc(${fraction * 100}% + ${50 * (1 - fraction)}px)`;

  return (
    <div className="space-y-1">
      <h3 className="text-[13px] font-bold text-[#0D0D0D]">Level Chart</h3>

      <div className="relative">
        <div className="border-2 border-[#AAAAAA] overflow-hidden">
          {/* Level row */}
          <div className="flex border-b-2 border-[#AAAAAA]">
            <div className="w-[50px] shrink-0 bg-[#F5F5F5] flex items-center justify-center border-r border-[#BBBBBB] py-2">
              <span className="text-xs font-bold text-[#333]">레벨</span>
            </div>
            {LEVELS.map((lv) => {
              const isCurrent = lv.rank === chartRank;
              return (
                <div
                  key={lv.rank}
                  className="flex-1 min-w-0 flex items-center justify-center border-r border-[#BBBBBB] last:border-r-0 py-2.5 relative"
                  style={{
                    backgroundColor: isCurrent ? '#CC000020' : lv.bg,
                  }}
                >
                  <span
                    className="text-[13px] text-center whitespace-pre-line leading-tight"
                    style={{
                      color: lv.color,
                      fontWeight: isCurrent ? 700 : 500,
                    }}
                  >
                    {lv.name}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Textbook row */}
          <div className="flex">
            <div className="w-[50px] shrink-0 bg-[#F5F5F5] flex items-center justify-center border-r border-[#BBBBBB] py-2">
              <span className="text-xs font-bold text-[#333]">교재</span>
            </div>
            {BOOKS.map((book, i) => {
              const isCurrent = i + 1 === chartRank;
              return (
                <div
                  key={i}
                  className="flex-1 min-w-0 flex items-center justify-center border-r border-[#BBBBBB] last:border-r-0 py-2"
                >
                  <span
                    className="text-[10px] text-center whitespace-pre-line leading-tight"
                    style={{
                      color: isCurrent ? '#CC0000' : '#555555',
                      fontWeight: isCurrent ? 700 : 400,
                    }}
                  >
                    {book}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Red circle marker */}
        {chartRank && (
          <div
            className="absolute top-1/2 pointer-events-none"
            style={{
              left: circleLeft,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="rounded-full border-[3px] border-[#CC0000]"
              style={{ width: '48px', height: '48px' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
