/**
 * Teacher dashboard page.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import type { User } from '../../types/auth';
import { studentService } from '../../services/student';
import { statsService, type DashboardStats } from '../../services/stats';
import { Users, Target, Award, FileText, Clock, UserPlus } from 'lucide-react';

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
    <div className="bg-surface border border-border-subtle rounded-xl p-5 flex items-center gap-4">
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center"
        style={{ backgroundColor: color + '15' }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <div>
        <p className="text-2xl font-bold font-word text-text-primary">{value}</p>
        <p className="text-xs text-text-tertiary">{label}</p>
      </div>
    </div>
  );
}

export function DashboardPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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

  // Format today's date in Korean
  const today = new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Average level will come from stats API in the future
  const avgLevel = 0; // Placeholder for now

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold text-text-primary">대시보드</h1>
          <p className="text-sm text-text-secondary">{today}</p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon={Users}
            label="등록 학생"
            value={isLoading ? '...' : `${students.length}명`}
            color="#2D9CAE"
          />
          <StatCard
            icon={Target}
            label="평균 정답률"
            value={stats?.avg_score ? `${stats.avg_score.toFixed(1)}%` : '-'}
            color="#4F46E5"
          />
          <StatCard
            icon={Award}
            label="평균 레벨"
            value={avgLevel > 0 ? `Lv.${Math.round(avgLevel)}` : '-'}
            color="#F59E0B"
          />
          <StatCard
            icon={FileText}
            label="이번 주 테스트"
            value={stats?.weekly_test_count ? `${stats.weekly_test_count}건` : '-'}
            color="#3B82F6"
          />
          <StatCard
            icon={Clock}
            label="평균 소요시간"
            value={stats?.avg_time_seconds ? `${(stats.avg_time_seconds / 60).toFixed(1)}분` : '-'}
            color="#2D9CAE"
          />
          <StatCard
            icon={UserPlus}
            label="신규 학생"
            value="-"
            color="#10B981"
          />
        </div>

        {/* Student Table Card */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          <div className="px-5 py-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">최근 학생 현황</h2>
            <Link
              to="/students"
              className="text-sm text-teal hover:text-teal/80 font-medium transition-colors"
            >
              전체 보기
            </Link>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              등록된 학생이 없습니다.{' '}
              <Link to="/students" className="text-teal hover:underline">
                학생을 추가해보세요
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-[#F8F8F6]">
                    <th className="px-5 py-3 text-left text-xs text-text-tertiary font-semibold uppercase tracking-wider">
                      이름
                    </th>
                    <th className="px-5 py-3 text-left text-xs text-text-tertiary font-semibold uppercase tracking-wider">
                      아이디
                    </th>
                    <th className="px-5 py-3 text-left text-xs text-text-tertiary font-semibold uppercase tracking-wider">
                      이메일
                    </th>
                    <th className="px-5 py-3 text-left text-xs text-text-tertiary font-semibold uppercase tracking-wider">
                      가입일
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {students.slice(0, 8).map((student) => (
                    <tr
                      key={student.id}
                      onClick={() => navigate(`/students/${student.id}/results`)}
                      className="bg-white border-b border-border-subtle h-[52px] hover:bg-bg-muted cursor-pointer transition-colors"
                    >
                      <td className="px-5 py-3 text-sm font-medium text-text-primary">
                        {student.name}
                      </td>
                      <td className="px-5 py-3 text-sm text-text-secondary">
                        {student.username}
                      </td>
                      <td className="px-5 py-3 text-sm text-text-secondary">
                        {student.email || '-'}
                      </td>
                      <td className="px-5 py-3 text-sm text-text-secondary">
                        {new Date(student.created_at).toLocaleDateString('ko-KR')}
                      </td>
                    </tr>
                  ))}
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
