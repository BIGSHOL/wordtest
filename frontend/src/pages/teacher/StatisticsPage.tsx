import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { statsService, type DashboardStats } from '../../services/stats';
import { BarChart3, Target, Award } from 'lucide-react';
import { logger } from '../../utils/logger';

export function StatisticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setIsLoading(true);
        const data = await statsService.getDashboardStats();
        setStats(data);
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
        <div className="py-16 text-center text-text-tertiary">로딩 중...</div>
      </TeacherLayout>
    );
  }

  if (!stats) {
    return (
      <TeacherLayout>
        <div className="py-16 text-center text-text-tertiary">
          통계를 불러올 수 없습니다.
        </div>
      </TeacherLayout>
    );
  }

  // Prepare score trend data (last 7 days)
  const scoreTrend = stats.score_trend.slice(-7).map((item) => ({
    label: new Date(item.date).toLocaleDateString('ko-KR', {
      month: 'short',
      day: 'numeric',
    }),
    value: Math.round(item.avg_score),
  }));

  // Prepare level distribution data
  const maxCount = Math.max(...stats.level_distribution.map((l) => l.count), 1);

  // Calculate average level
  const avgLevel =
    stats.level_distribution.length > 0
      ? (
          stats.level_distribution.reduce(
            (sum, l) => sum + l.level * l.count,
            0
          ) / stats.total_students
        ).toFixed(1)
      : '0.0';

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-2xl font-bold text-text-primary">
            통계
          </h1>
          <div className="text-sm text-text-tertiary">
            최근 30일 데이터
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-5">
          {/* Total Tests */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-secondary">
                총 테스트 수
              </span>
              <div className="w-10 h-10 rounded-lg bg-teal-light flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-teal" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-text-primary font-word">
              {stats.total_tests}
            </div>
          </div>

          {/* Average Score */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-secondary">
                평균 정답률
              </span>
              <div className="w-10 h-10 rounded-lg bg-accent-indigo/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-accent-indigo" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-text-primary font-word">
              {Math.round(stats.avg_score)}%
            </div>
          </div>

          {/* Average Level */}
          <div className="bg-surface border border-border-subtle rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-text-secondary">
                평균 레벨
              </span>
              <div className="w-10 h-10 rounded-lg bg-accent-amber/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-accent-amber" />
              </div>
            </div>
            <div className="font-display text-3xl font-bold text-text-primary font-word">
              {avgLevel}
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-2 gap-5">
          {/* Score Trend Chart */}
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary mb-6">
              정답률 추이
            </h2>
            {scoreTrend.length > 0 ? (
              <div className="flex items-end gap-2 h-[200px]">
                {scoreTrend.map((d, i) => (
                  <div
                    key={i}
                    className="flex-1 flex flex-col items-center gap-1"
                  >
                    <span className="text-xs text-text-tertiary font-word">
                      {d.value}%
                    </span>
                    <div
                      className="w-full bg-teal rounded-t-md min-h-[4px]"
                      style={{ height: `${d.value * 2}px` }}
                    />
                    <span className="text-[10px] text-text-tertiary">
                      {d.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-tertiary text-sm">
                데이터가 없습니다.
              </div>
            )}
          </div>

          {/* Level Distribution Chart */}
          <div className="bg-surface border border-border-subtle rounded-xl p-6">
            <h2 className="font-display text-lg font-semibold text-text-primary mb-6">
              레벨 분포
            </h2>
            {stats.level_distribution.length > 0 ? (
              <div className="space-y-3">
                {stats.level_distribution
                  .sort((a, b) => a.level - b.level)
                  .map((l) => (
                    <div key={l.level} className="flex items-center gap-3">
                      <span className="text-xs w-10 text-text-secondary font-word">
                        Lv.{l.level}
                      </span>
                      <div className="flex-1 bg-bg-muted rounded-full h-6 overflow-hidden">
                        <div
                          className="h-full bg-teal rounded-full transition-all duration-300"
                          style={{
                            width: `${(l.count / maxCount) * 100}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-word text-text-secondary w-8 text-right">
                        {l.count}명
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <div className="h-[200px] flex items-center justify-center text-text-tertiary text-sm">
                데이터가 없습니다.
              </div>
            )}
          </div>
        </div>

        {/* Recent Tests Table */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border-subtle">
            <h2 className="font-display text-lg font-semibold text-text-primary">
              최근 테스트
            </h2>
          </div>
          {stats.recent_tests.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F8F6] h-11 text-xs text-text-tertiary font-semibold">
                    <th className="text-left px-6">학생</th>
                    <th className="text-left px-6">점수</th>
                    <th className="text-left px-6">레벨</th>
                    <th className="text-left px-6">날짜</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_tests.slice(0, 10).map((test) => (
                    <tr
                      key={test.id}
                      className="border-b border-border-subtle h-[52px] hover:bg-bg-muted/50 transition-colors"
                    >
                      <td className="px-6 font-medium text-text-primary">
                        {test.student_name}
                      </td>
                      <td className="px-6">
                        <span className="font-word text-sm text-text-secondary">
                          {test.score != null ? `${Math.round(test.score)}%` : '-'}
                        </span>
                      </td>
                      <td className="px-6">
                        {test.determined_level ? (
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold font-word"
                            style={{
                              backgroundColor: `rgba(45, 156, 174, ${
                                0.1 + test.determined_level * 0.05
                              })`,
                              color: '#2D9CAE',
                            }}
                          >
                            Lv.{test.determined_level}
                          </span>
                        ) : (
                          <span className="text-xs text-text-tertiary">-</span>
                        )}
                      </td>
                      <td className="px-6 text-sm text-text-tertiary">
                        {test.completed_at ? new Date(test.completed_at).toLocaleDateString(
                          'ko-KR',
                          {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          }
                        ) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="py-16 text-center text-text-tertiary text-sm">
              최근 테스트 기록이 없습니다.
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default StatisticsPage;
