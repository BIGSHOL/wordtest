/**
 * Teacher dashboard page.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import type { User } from '../../types/auth';
import { studentService } from '../../services/student';

export function DashboardPage() {
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await studentService.listStudents();
      setStudents(data);
    } catch {
      // handle error silently
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-text-primary">대시보드</h1>
          <Link
            to="/students"
            className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm font-medium"
          >
            학생 관리
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-surface border border-[#E2E8F0] rounded-xl p-5">
            <p className="text-sm text-text-secondary">등록 학생</p>
            <p className="text-2xl font-bold text-text-primary mt-1">
              {isLoading ? '...' : students.length}
            </p>
          </div>
          <div className="bg-surface border border-[#E2E8F0] rounded-xl p-5">
            <p className="text-sm text-text-secondary">이번 주 테스트</p>
            <p className="text-2xl font-bold text-text-primary mt-1">-</p>
          </div>
          <div className="bg-surface border border-[#E2E8F0] rounded-xl p-5">
            <p className="text-sm text-text-secondary">평균 점수</p>
            <p className="text-2xl font-bold text-text-primary mt-1">-</p>
          </div>
        </div>

        {/* Recent Students */}
        <div className="bg-surface border border-[#E2E8F0] rounded-xl">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h2 className="text-lg font-semibold text-text-primary">학생 목록</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              등록된 학생이 없습니다.{' '}
              <Link to="/students" className="text-primary hover:underline">
                학생을 추가해보세요
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {students.map((student) => (
                <div key={student.id} className="px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-text-primary">{student.name}</p>
                    <p className="text-sm text-text-secondary">@{student.username}</p>
                  </div>
                  <Link
                    to={`/students/${student.id}/results`}
                    className="text-sm text-primary hover:underline"
                  >
                    결과 보기
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default DashboardPage;
