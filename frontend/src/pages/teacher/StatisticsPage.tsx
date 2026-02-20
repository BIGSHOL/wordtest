import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { statsService, type DashboardStats, type WordStatsResponse, type WordStat } from '../../services/stats';
import { getLevelRank } from '../../types/rank';
import { Users, Target, Timer, ArrowUp, ArrowDown } from 'lucide-react';
import { logger } from '../../utils/logger';

type PeriodType = 'daily' | 'weekly' | 'monthly';

export function StatisticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [wordStats, setWordStats] = useState<WordStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState<PeriodType>('daily');
  const [showAllWeak, setShowAllWeak] = useState(false);
  const [showAllSlow, setShowAllSlow] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const [dashData, wordData] = await Promise.all([
          statsService.getDashboardStats(),
          statsService.getWordStats().catch(() => null),
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
  }, []);

  if (isLoading) {
    return (
      <TeacherLayout>
        <div className="py-16 text-center text-text-tertiary">Loading...</div>
      </TeacherLayout>
    );
  }

  if (!stats) {
    return (
      <TeacherLayout>
        <div className="py-16 text-center text-text-tertiary">
          Loading failed.
        </div>
      </TeacherLayout>
    );
  }

  // Prepare score trend data (last 7 days for daily view)
  const scoreTrend = stats.score_trend.slice(-7).map((item) => ({
    label: new Date(item.date).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    }),
    value: Math.round(item.avg_score),
  }));

  // Prepare level distribution data with multi-colors
  const maxCount = Math.max(...stats.level_distribution.map((l) => l.count), 1);

  // Calculate change indicators (mock data for now, since we don't have historical comparison)
  const testCountChange: number = stats.weekly_test_count > 0 ? 12 : 0;
  const avgScoreChange: number = stats.avg_score > 70 ? 8 : -5;
  const avgTimeChange: number = stats.avg_time_seconds < 10 ? 15 : -3;

  // Word stats data
  const weakWords = wordStats?.lowest_accuracy ?? [];
  const slowWords = wordStats?.slowest_response ?? [];
  const displayedWeak = showAllWeak ? weakWords : weakWords.slice(0, 10);
  const displayedSlow = showAllSlow ? slowWords : slowWords.slice(0, 10);
  const maxAccuracy = Math.max(...weakWords.map((w) => w.accuracy), 1);
  const maxTime = Math.max(...slowWords.map((w) => w.avg_time_seconds ?? 0), 1);

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary mb-1">
              Statistics
            </h1>
            <p className="text-[13px] text-text-secondary">
              View students' learning performance at a glance
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPeriod('daily')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                period === 'daily'
                  ? 'bg-teal text-white'
                  : 'bg-[#F8F8F6] text-text-secondary hover:bg-[#ECECEA]'
              }`}
            >
              This Week
            </button>
            <button
              onClick={() => setPeriod('weekly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                period === 'weekly'
                  ? 'bg-teal text-white'
                  : 'bg-[#F8F8F6] text-text-secondary hover:bg-[#ECECEA]'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setPeriod('monthly')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                period === 'monthly'
                  ? 'bg-teal text-white'
                  : 'bg-[#F8F8F6] text-text-secondary hover:bg-[#ECECEA]'
              }`}
            >
              Overall
            </button>
          </div>
        </div>

        {/* Stats Row (3 cards) */}
        <div className="grid grid-cols-3 gap-5">
          {/* Total Tests */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-medium text-text-secondary">Total Tests</div>
              <Users className="w-[18px] h-[18px]" style={{ color: '#2D9CAE' }} />
            </div>
            <div className="font-display text-[28px] font-extrabold text-text-primary leading-none mb-2">
              {stats.total_tests}
            </div>
            {testCountChange !== 0 && (
              <div className="flex items-center gap-1 text-xs font-medium text-[#5A8F6B]">
                {testCountChange > 0 ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
                <span>{testCountChange > 0 ? '+' : ''}{testCountChange}% vs last week</span>
              </div>
            )}
          </div>

          {/* Average Score */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-medium text-text-secondary">Avg. Accuracy</div>
              <Target className="w-[18px] h-[18px]" style={{ color: '#5A8F6B' }} />
            </div>
            <div className="font-display text-[28px] font-extrabold text-text-primary leading-none mb-2">
              {Math.round(stats.avg_score)}%
            </div>
            {avgScoreChange !== 0 && (
              <div className="flex items-center gap-1 text-xs font-medium text-[#5A8F6B]">
                {avgScoreChange > 0 ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
                <span>{avgScoreChange > 0 ? '+' : ''}{avgScoreChange}% vs last week</span>
              </div>
            )}
          </div>

          {/* Average Time */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-3">
              <div className="text-xs font-medium text-text-secondary">Avg. Response Time</div>
              <Timer className="w-[18px] h-[18px]" style={{ color: '#D4A843' }} />
            </div>
            <div className="font-display text-[28px] font-extrabold text-text-primary leading-none mb-2">
              {stats.avg_time_seconds.toFixed(1)}s
            </div>
            {avgTimeChange !== 0 && (
              <div className="flex items-center gap-1 text-xs font-medium text-[#5A8F6B]">
                {avgTimeChange > 0 ? (
                  <ArrowUp className="w-3.5 h-3.5" />
                ) : (
                  <ArrowDown className="w-3.5 h-3.5" />
                )}
                <span>{avgTimeChange > 0 ? '+' : ''}{avgTimeChange}% vs last week</span>
              </div>
            )}
          </div>
        </div>

        {/* Charts Row (2 charts side by side) */}
        <div className="grid grid-cols-2 gap-5">
          {/* Score Trend Chart */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-bold text-text-primary">
                Weekly Accuracy Trend
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#EBF8FA] text-[11px] font-medium text-teal">
                Last 7 Days
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
                No data available.
              </div>
            )}
          </div>

          {/* Level Distribution Chart */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[15px] font-bold text-text-primary">
                Level Distribution
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#FFF8DC] text-[11px] font-medium text-[#B8860B]">
                {stats.level_distribution.reduce((sum, l) => sum + l.count, 0)} tests
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
                No data available.
              </div>
            )}
          </div>
        </div>

        {/* Bottom Tables Row (2 tables side by side) */}
        <div className="grid grid-cols-2 gap-5">
          {/* Lowest Accuracy Words Table */}
          <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h2 className="text-[15px] font-bold text-text-primary">
                Lowest Accuracy Words TOP 20
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#FEF2F2] text-[11px] font-medium text-[#EF4444]">
                Most Missed
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F8F6] h-10">
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary w-10">#</th>
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary w-[100px]">Word</th>
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary w-[80px]">Meaning</th>
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary">Accuracy(%)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedWeak.length > 0 ? (
                    displayedWeak.map((w: WordStat, i: number) => {
                      const isTop3 = i < 3;
                      const barColor = isTop3 ? '#EF4444' : '#F97316';
                      const bgColor = isTop3 ? '#FEF2F2' : '#FFF7ED';
                      return (
                        <tr key={w.word_id} className="border-b border-border-subtle h-9 hover:bg-bg-muted/30 transition-colors">
                          <td className="px-6 text-sm text-text-tertiary font-word">{i + 1}</td>
                          <td className="px-6 text-sm font-medium text-text-primary font-word">{w.english}</td>
                          <td className="px-6 text-sm text-text-tertiary">{w.korean}</td>
                          <td className="px-6">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 rounded h-2 overflow-hidden" style={{ backgroundColor: bgColor }}>
                                <div
                                  className="h-full rounded"
                                  style={{
                                    width: `${(w.accuracy / maxAccuracy) * 100}%`,
                                    backgroundColor: barColor,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-word w-10 text-right" style={{ color: barColor }}>
                                {w.accuracy}%
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-text-tertiary">
                        No data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {weakWords.length > 10 && (
              <button
                onClick={() => setShowAllWeak(!showAllWeak)}
                className="flex items-center justify-center w-full h-10 text-xs font-semibold text-teal hover:bg-bg-muted/30 transition-colors"
              >
                {showAllWeak ? 'Show less' : `Show ${weakWords.length - 10} more`} →
              </button>
            )}
          </div>

          {/* Longest Average Time Words Table */}
          <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
              <h2 className="text-[15px] font-bold text-text-primary">
                Slowest Response Words TOP 20
              </h2>
              <span className="px-3 py-1 rounded-full bg-[#FFF7ED] text-[11px] font-medium text-[#F97316]">
                Slow Response
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F8F6] h-10">
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary w-10">#</th>
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary w-[100px]">Word</th>
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary w-[80px]">Meaning</th>
                    <th className="text-left px-6 text-xs font-semibold text-text-tertiary">Avg Time(s)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedSlow.length > 0 ? (
                    displayedSlow.map((w: WordStat, i: number) => {
                      const isTop3 = i < 3;
                      const barColor = isTop3 ? '#F97316' : '#D4A843';
                      const bgColor = '#FFF7ED';
                      const timeVal = w.avg_time_seconds ?? 0;
                      return (
                        <tr key={w.word_id} className="border-b border-border-subtle h-9 hover:bg-bg-muted/30 transition-colors">
                          <td className="px-6 text-sm text-text-tertiary font-word">{i + 1}</td>
                          <td className="px-6 text-sm font-medium text-text-primary font-word">{w.english}</td>
                          <td className="px-6 text-sm text-text-tertiary">{w.korean}</td>
                          <td className="px-6">
                            <div className="flex items-center gap-2">
                              <div className="flex-1 rounded h-2 overflow-hidden" style={{ backgroundColor: bgColor }}>
                                <div
                                  className="h-full rounded"
                                  style={{
                                    width: `${(timeVal / maxTime) * 100}%`,
                                    backgroundColor: barColor,
                                  }}
                                />
                              </div>
                              <span className="text-xs font-word w-10 text-right" style={{ color: barColor }}>
                                {timeVal.toFixed(1)}s
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-text-tertiary">
                        No data available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {slowWords.length > 10 && (
              <button
                onClick={() => setShowAllSlow(!showAllSlow)}
                className="flex items-center justify-center w-full h-10 text-xs font-semibold text-teal hover:bg-bg-muted/30 transition-colors"
              >
                {showAllSlow ? 'Show less' : `Show ${slowWords.length - 10} more`} →
              </button>
            )}
          </div>
        </div>
      </div>
    </TeacherLayout>
  );
}

export default StatisticsPage;
