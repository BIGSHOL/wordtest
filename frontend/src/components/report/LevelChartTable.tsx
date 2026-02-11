/**
 * Horizontal level chart table with 11 ranks + textbook mapping.
 * Red circle marker on current rank.
 * Matches Pencil design node ZA13S / IJnYi.
 */

interface Props {
  currentRank: number | null;
}

const LEVELS = [
  { rank: 1, name: 'Iron', color: '#6D6C6A', bg: '#E8E8E8' },
  { rank: 2, name: 'Bronze', color: '#CD7F32', bg: '#FFF0F0' },
  { rank: 3, name: 'Silver', color: '#808080', bg: '#C0C0C030' },
  { rank: 4, name: 'Gold', color: '#B8860B', bg: '#FFF8DC' },
  { rank: 5, name: 'Platinum', color: '#2D9CAE', bg: '#EBF8FA' },
  { rank: 6, name: 'Emerald', color: '#5A8F6B', bg: '#E8FAF0' },
  { rank: 7, name: 'Diamond', color: '#4A7AB5', bg: '#E0F0FF' },
  { rank: 8, name: 'Master', color: '#CC0000', bg: '#F0E8FF' },
  { rank: 9, name: 'Grand\nmaster', color: '#DC2626', bg: '#FEF2F2' },
  { rank: 10, name: 'Challenger', color: '#D4A843', bg: '#FFF8DC' },
  { rank: 11, name: 'Legend', color: '#999999', bg: '#FFF5F5' },
];

const BOOKS = [
  'POWER VOCA\n5000-01',
  'POWER VOCA\n5000-02',
  'POWER VOCA\n5000-03',
  'POWER VOCA\n5000-04',
  'POWER VOCA\n5000-05',
  'POWER VOCA\n5000-06',
  'POWER VOCA\n5000-07',
  'POWER VOCA\n5000-08',
  'POWER VOCA\n5000-09',
  'POWER VOCA\n5000-10',
  'POWER VOCA\n수능기출',
];

export function LevelChartTable({ currentRank }: Props) {
  // Calculate circle center position: 50px header + fraction of remaining width
  const fraction = currentRank ? (currentRank - 0.5) / 11 : 0;
  const circleLeft = `calc(${fraction * 100}% + ${50 * (1 - fraction)}px)`;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-bold text-[#0D0D0D]">Level Chart</h3>

      {/* Wrapper for circle overflow */}
      <div className="relative">
        <div className="border-2 border-[#AAAAAA] overflow-hidden">
          {/* Level row */}
          <div className="flex border-b-2 border-[#AAAAAA]">
            <div className="w-[50px] shrink-0 bg-[#F5F5F5] flex items-center justify-center border-r border-[#BBBBBB] py-2">
              <span className="text-[10px] font-semibold text-[#333]">레벨</span>
            </div>
            {LEVELS.map((lv) => {
              const isCurrent = lv.rank === currentRank;
              return (
                <div
                  key={lv.rank}
                  className="flex-1 min-w-0 flex items-center justify-center border-r border-[#BBBBBB] last:border-r-0 py-2 relative"
                  style={{
                    backgroundColor: isCurrent ? '#CC000020' : lv.bg,
                  }}
                >
                  <span
                    className="text-[8px] text-center whitespace-pre-line leading-tight"
                    style={{
                      color: lv.color,
                      fontWeight: isCurrent ? 700 : 400,
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
              <span className="text-[10px] font-semibold text-[#333]">교재</span>
            </div>
            {BOOKS.map((book, i) => {
              const isCurrent = i + 1 === currentRank;
              return (
                <div
                  key={i}
                  className="flex-1 min-w-0 flex items-center justify-center border-r border-[#BBBBBB] last:border-r-0 py-2"
                  style={{
                    backgroundColor: isCurrent ? '#FFF0F0' : undefined,
                  }}
                >
                  <span
                    className="text-[8px] text-center whitespace-pre-line leading-tight"
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

        {/* Red circle marker - outside overflow-hidden so it can extend beyond table */}
        {currentRank && currentRank >= 1 && currentRank <= 11 && (
          <div
            className="absolute top-1/2 pointer-events-none"
            style={{
              left: circleLeft,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div
              className="rounded-full border-[6px] border-[#CC0000]"
              style={{
                width: '90px',
                height: '90px',
                background: 'radial-gradient(circle, #CC000018 0%, #CC000010 70%, transparent 100%)',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
