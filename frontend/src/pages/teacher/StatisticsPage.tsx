import { useState, useEffect, type ReactNode } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { statsService, type DashboardStats, type WordStatsResponse, type WordStat } from '../../services/stats';
import { getLevelRank } from '../../types/rank';
import { Users, Target, Timer } from 'lucide-react';
import { logger } from '../../utils/logger';

type PeriodType = 'weekly' | 'monthly' | 'all';

export function StatisticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [wordStats, setWordStats] = useState<WordStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('all');
  const [showAllWeak, setShowAllWeak] = useState(false);
  const [showAllSlow, setShowAllSlow] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const [dashData, wordData] = await Promise.all([
          statsService.getDashboardStats(period),
          statsService.getWordStats(period).catch(() => null),
        ]);
        setStats(dashData);
        setWordStats(wordData);
      } catch (error) {
        logger.error('Failed to fetch statistics:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchStats();
  }, [period]);

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="py-16 text-center text-text-tertiary">로딩 중...</div>
      </TeacherLayout>
    );
  }

  if (!stats) {
    return (
      <TeacherLayout>
        <div className="py-16 text-center text-text-tertiary">
          데이터를 불러오지 못했습니다.
        </div>
      </TeacherLayout>
    );
  }

  // Prepare score trend data
  const scoreTrend = stats.score_trend.map((item) => ({
    label: new Date(item.date).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    }),
    value: Math.round(item.avg_score),
  }));

  // Prepare level distribution data
  const maxCount = Math.max(...stats.level_distribution.map((l) => l.count), 1);

  // Word stats data
  const weakWords = wordStats?.lowest_accuracy ?? [];
  const slowWords = wordStats?.slowest_response ?? [];
  const displayedWeak = showAllWeak ? weakWords : weakWords.slice(0, 10);
  const displayedSlow = showAllSlow ? slowWords : slowWords.slice(0, 10);
  const maxAccuracy = Math.max(...weakWords.map((w) => w.accuracy), 1);
  const maxTime = Math.max(...slowWords.map((w) => w.avg_time_seconds ?? 0), 1);

  const periodLabel =
    period === 'weekly' ? '최근 7일' : period === 'monthly' ? '최근 30일' : '전체 기간';

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
              학습 통계
            </h1>
            <p className="text-[13px] text-text-secondary">
              학생들의 학습 성과를 한눈에 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(['weekly', 'monthly', 'all'] as PeriodType[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  period === p
                    ? 'bg-teal text-white'
                    : 'bg-[#F8F8F6] text-text-secondary hover:bg-[#ECECEA]'
                }`}
              >
                {p === 'weekly' ? '이번 주' : p === 'monthly' ? '이번 달' : '전체'}
              </button>
            ))}
          </div>
        </div>

        {/* Stats Row (3 cards) */}
        <div className="grid grid-cols-3 gap-5">
          {/* Total Tests */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-medium text-text-secondary">총 테스트 수</div>
              <Users className="w-[18px] h-[18px]" style={{ color: '#2D9CAE' }} />
            </div>
            <div className="font-display text-[28px] font-extrabold text-text-primary leading-none">
              {stats.total_tests}
            </div>
          </div>

          {/* Average Score */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-medium text-text-secondary">평균 정답률</div>
              <Target className="w-[18px] h-[18px]" style={{ color: '#5A8F6B' }} />
            </div>
            <div className="font-display text-[28px] font-extrabold text-text-primary leading-none">
              {Math.round(stats.avg_score)}%
            </div>
          </div>

          {/* Average Time */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-medium text-text-secondary">평균 응답 시간</div>
              <Timer className="w-[18px] h-[18px]" style={{ color: '#D4A843' }} />
            </div>
            <div className="font-display text-[28px] font-extrabold text-text-primary leading-none">
              {stats.avg_time_seconds.toFixed(1)}초
            </div>
          </div>
        </div>

        {/* Charts Row (2 charts side by side) */}
        <div className="grid grid-cols-2 gap-5">
          {/* Score Trend Chart */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-bold text-text-primary">
                정답률 추이
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#EBF8FA] text-[11px] font-medium text-teal">
                {periodLabel}
              </span>
            </div>
            {scoreTrend.length > 0 ? (
              <div className="relative">
                {/* Y-axis labels */}
                <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between text-[10px] text-text-tertiary font-word">
                  <span>100%</span>
                  <span>75%</span>
                  <span>50%</span>
                  <span>25%</span>
                </div>
                <div className="flex items-end gap-2 h-[280px] ml-10">
                  {scoreTrend.map((d, i) => (
                    <div
                      key={i}
                      className="flex-1 flex flex-col items-center gap-2"
                    >
                      <span className="text-xs text-text-tertiary font-word">
                        {d.value}%
                      </span>
                      <div
                        className="w-8 rounded-t-md transition-all duration-300 min-h-[4px]"
                        style={{
                          height: `${(d.value / 100) * 240}px`,
                          background: 'linear-gradient(180deg, #2D9CAE 0%, #3DBDC8 100%)'
                        }}
                      />
                      <span className="text-[11px] text-text-tertiary mt-1">
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary text-sm">
                데이터가 없습니다.
              </div>
            )}
          </div>

          {/* Level Distribution Chart */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-bold text-text-primary">
                레벨 분포
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#FFF8DC] text-[11px] font-medium text-[#B8860B]">
                {stats.level_distribution.reduce((sum, l) => sum + l.count, 0)}회
              </span>
            </div>
            {stats.level_distribution.length > 0 ? (
              <div className="space-y-4">
                {stats.level_distribution
                  .sort((a, b) => a.level - b.level)
                  .map((l) => {
                    const rank = getLevelRank(l.level);
                    return (
                      <div key={l.level} className="flex items-center gap-3">
                        <span className="text-sm w-28 text-text-secondary font-medium font-word whitespace-nowrap shrink-0">
                          {rank.name}
                        </span>
                        <div className="flex-1 bg-[#F5F4F1] h-5 rounded-[10px] overflow-hidden">
                          <div
                            className="h-full rounded-[10px] transition-all duration-300 flex items-center justify-end pr-3"
                            style={{
                              width: `${(l.count / maxCount) * 100}%`,
                              backgroundColor: rank.colors[0],
                            }}
                          >
                            {l.count > 0 && (
                              <span className="text-xs font-semibold text-white">
                                {l.count}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-word text-text-secondary w-12 text-right">
                          {l.count}
                        </span>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-text-tertiary text-sm">
                데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Tables Row (2 tables side by side) */}
        <div className="grid grid-cols-2 gap-5 items-start">
          {/* Lowest Accuracy Words Table */}
          <WordStatsTable
            title="오답률 높은 단어 TOP 20"
            badge="오답 빈출"
            badgeBg="#FEF2F2"
            badgeColor="#EF4444"
            words={displayedWeak}
            showAll={showAllWeak}
            onToggle={() => setShowAllWeak(!showAllWeak)}
            totalCount={weakWords.length}
            valueHeader="정답률(%)"
            renderBar={(w, i) => {
              const isTop3 = i < 3;
              const barColor = isTop3 ? '#EF4444' : '#F97316';
              const bgColor = isTop3 ? '#FEF2F2' : '#FFF7ED';
              return (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded h-2 overflow-hidden" style={{ backgroundColor: bgColor }}>
                    <div
                      className="h-full rounded"
                      style={{ width: `${(w.accuracy / maxAccuracy) * 100}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span className="text-[11px] font-word w-10 text-right shrink-0" style={{ color: barColor }}>
                    {w.accuracy}%
                  </span>
                </div>
              );
            }}
          />

          {/* Slowest Response Words Table */}
          <WordStatsTable
            title="응답 느린 단어 TOP 20"
            badge="느린 응답"
            badgeBg="#FFF7ED"
            badgeColor="#F97316"
            words={displayedSlow}
            showAll={showAllSlow}
            onToggle={() => setShowAllSlow(!showAllSlow)}
            totalCount={slowWords.length}
            valueHeader="평균 시간(초)"
            renderBar={(w, i) => {
              const isTop3 = i < 3;
              const barColor = isTop3 ? '#F97316' : '#D4A843';
              const timeVal = w.avg_time_seconds ?? 0;
              return (
                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded h-2 overflow-hidden" style={{ backgroundColor: '#FFF7ED' }}>
                    <div
                      className="h-full rounded"
                      style={{ width: `${(timeVal / maxTime) * 100}%`, backgroundColor: barColor }}
                    />
                  </div>
                  <span className="text-[11px] font-word w-10 text-right shrink-0" style={{ color: barColor }}>
                    {timeVal.toFixed(1)}초
                  </span>
                </div>
              );
            }}
          />
        </div>
      </div>
    </TeacherLayout>
  );
}

/** Shared word stats table component for TOP 20 lists */
function WordStatsTable({
  title, badge, badgeBg, badgeColor,
  words, showAll, onToggle, totalCount,
  valueHeader, renderBar,
}: {
  title: string;
  badge: string;
  badgeBg: string;
  badgeColor: string;
  words: WordStat[];
  showAll: boolean;
  onToggle: () => void;
  totalCount: number;
  valueHeader: string;
  renderBar: (w: WordStat, i: number) => ReactNode;
}) {
  return (
    <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between"
        style={{ padding: '16px 24px', borderBottom: '1px solid #E8E8E6' }}
      >
        <h2 className="text-[15px] font-bold text-text-primary">{title}</h2>
        <span
          className="px-3 py-1 rounded-full text-[11px] font-medium"
          style={{ backgroundColor: badgeBg, color: badgeColor }}
        >
          {badge}
        </span>
      </div>

      {/* Table */}
      <table className="w-full">
        <thead>
          <tr style={{ backgroundColor: '#F8F8F6', height: 36, borderBottom: '1px solid #E8E8E6' }}>
            <th className="text-left text-[11px] font-semibold text-text-tertiary" style={{ width: 40, paddingLeft: 24, paddingRight: 4 }}>#</th>
            <th className="text-left text-[11px] font-semibold text-text-tertiary" style={{ width: 100, padding: '0 8px' }}>단어</th>
            <th className="text-left text-[11px] font-semibold text-text-tertiary" style={{ width: 72, padding: '0 8px' }}>뜻</th>
            <th className="text-left text-[11px] font-semibold text-text-tertiary" style={{ paddingLeft: 8, paddingRight: 24 }}>{valueHeader}</th>
          </tr>
        </thead>
        <tbody>
          {words.length > 0 ? (
            words.map((w, i) => (
              <tr
                key={w.word_id}
                className="hover:bg-bg-muted/30 transition-colors"
                style={{ borderBottom: '1px solid #F0F0EE', height: 40 }}
              >
                <td className="text-[12px] text-text-tertiary font-word" style={{ paddingLeft: 24, paddingRight: 4 }}>{i + 1}</td>
                <td style={{ padding: '0 8px' }}>
                  <div className="text-[12px] font-medium text-text-primary font-word whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: 92 }}>
                    {w.english}
                  </div>
                </td>
                <td style={{ padding: '0 8px' }}>
                  <div className="text-[12px] text-text-tertiary whitespace-nowrap overflow-hidden text-ellipsis" style={{ maxWidth: 64 }}>
                    {w.korean}
                  </div>
                </td>
                <td style={{ paddingLeft: 8, paddingRight: 24 }}>
                  {renderBar(w, i)}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={4} className="text-center text-sm text-text-tertiary" style={{ padding: '32px 24px' }}>
                데이터가 없습니다.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Show more / Show less */}
      {totalCount > 10 && (
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-full text-xs font-semibold text-teal hover:bg-bg-muted/30 transition-colors"
          style={{ height: 40, borderTop: '1px solid #F0F0EE' }}
        >
          {showAll ? '접기' : `${totalCount - 10}개 더 보기`} →
        </button>
      )}
    </div>
  );
}

export default StatisticsPage;
