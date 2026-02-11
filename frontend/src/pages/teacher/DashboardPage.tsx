/**
 * Teacher dashboard page - matches Pencil design spec.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import type { User } from '../../types/auth';
import { studentService } from '../../services/student';
import { statsService, type DashboardStats } from '../../services/stats';
import { getLevelRank } from '../../types/rank';
import { Users, Target, Trophy, Calendar, Timer, Search, FileText, Download } from 'lucide-react';

function StatCard({
  icon: Icon,
  label,
  value,
  color
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="bg-white border border-border-subtle rounded-2xl" style={{ padding: '20px 24px' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[13px] font-medium text-text-secondary">{label}</span>
        <Icon className="w-[18px] h-[18px]" style={{ color }} />
      </div>
      <p className="text-[32px] font-extrabold font-word text-text-primary leading-none" style={{ letterSpacing: '-1px' }}>
        {value}
      </p>
    </div>
  );
}

export function DashboardPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      studentService.listStudents(),
      statsService.getDashboardStats().catch(() => null),
    ])
      .then(([studentData, statsData]) => {
        setStudents(studentData);
        setStats(statsData);
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Calculate average level from students with latest_level
  const studentsWithLevel = students.filter(s => s.latest_level && s.latest_level > 0);
  const avgLevel = studentsWithLevel.length > 0
    ? studentsWithLevel.reduce((sum, s) => sum + (s.latest_level || 0), 0) / studentsWithLevel.length
    : 0;
  const avgRank = avgLevel > 0 ? getLevelRank(Math.round(avgLevel)) : null;

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-word text-[26px] font-extrabold text-text-primary mb-1">
              대시보드
            </h1>
            <p className="font-word text-sm text-text-secondary">
              학생 테스트 현황을 한눈에 확인하세요
            </p>
          </div>
          <div className="relative w-60">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="학생 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full h-10 pl-10 pr-4 bg-white border border-border-subtle rounded-[10px] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal/20"
            />
          </div>
        </div>

        {/* Stats Row - 5 cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <StatCard
            icon={Users}
            label="총 학생 수"
            value={isLoading ? '...' : `${students.length}명`}
            color="#2D9CAE"
          />
          <StatCard
            icon={Target}
            label="평균 정답률"
            value={stats?.avg_score ? `${stats.avg_score.toFixed(1)}%` : '-'}
            color="#5A8F6B"
          />
          <StatCard
            icon={Trophy}
            label="평균 레벨"
            value={avgRank ? `Lv.${Math.round(avgLevel)} ${avgRank.name}` : '-'}
            color="#D4A843"
          />
          <StatCard
            icon={Calendar}
            label="오늘 응시자"
            value={stats?.today_test_count != null ? `${stats.today_test_count}명` : '-'}
            color="#2D9CAE"
          />
          <StatCard
            icon={Timer}
            label="평균 정답 시간"
            value={stats?.avg_time_seconds ? `${stats.avg_time_seconds.toFixed(1)}초` : '-'}
            color="#F97316"
          />
        </div>

        {/* Recent Test Results Table Card */}
        <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
          <div className="px-6 py-5 flex items-center justify-between border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary">최근 테스트 결과</h2>
            <button className="flex items-center gap-2 px-4 py-2 bg-[#EBF8FA] text-teal text-sm font-semibold rounded-lg hover:bg-[#DDF3F6] transition-colors">
              <Download className="w-3.5 h-3.5" />
              내보내기
            </button>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : !stats?.recent_tests || stats.recent_tests.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              최근 테스트 결과가 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F8F6] h-11">
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">이름</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">학교</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">학년</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">레벨</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">정답률</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">문제 수</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">틀린 문제</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">정답 시간</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">응시일</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">상태</th>
                    <th className="px-3 py-3 text-left text-xs text-text-secondary font-semibold whitespace-nowrap">보고서</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recent_tests.slice(0, 10).map((test) => {
                    const rank = test.determined_level ? getLevelRank(test.determined_level) : null;
                    const durationMin = test.duration_seconds ? Math.floor(test.duration_seconds / 60) : null;
                    const durationSec = test.duration_seconds ? test.duration_seconds % 60 : null;
                    const wrongAnswers = test.total_questions != null && test.correct_count != null
                      ? test.total_questions - test.correct_count
                      : null;
                    return (
                      <tr
                        key={test.id}
                        className="bg-white border-b border-border-subtle h-[52px] hover:bg-bg-muted transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-text-primary whitespace-nowrap">
                          {test.student_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {test.student_school || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {test.student_grade || '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {rank ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
                              style={{
                                backgroundColor: rank.colors[0] + '20',
                                color: rank.colors[1]
                              }}
                            >
                              Lv.{test.determined_level} {rank.name}
                            </span>
                          ) : (
                            <span className="text-sm text-text-secondary">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-text-primary whitespace-nowrap">
                          {test.score != null ? `${test.score}%` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {test.total_questions || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {wrongAnswers != null ? wrongAnswers : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {durationMin != null ? `${durationMin}분 ${durationSec}초` : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-text-secondary whitespace-nowrap">
                          {test.completed_at ? new Date(test.completed_at).toLocaleDateString('ko-KR', { year: '2-digit', month: 'numeric', day: 'numeric' }) : '-'}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#5A8F6B]"></span>
                            <span className="text-xs text-text-secondary">완료</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/students/${test.student_id}/results`)}
                            className="inline-flex items-center gap-1 text-sm text-teal hover:text-teal/80 font-medium transition-colors"
                          >
                            <FileText className="w-4 h-4" />
                            보기
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default DashboardPage;
