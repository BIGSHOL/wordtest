/**
 * Teacher view: student test result report.
 * Matches design screens ZDcZ1 (PC) and fZm1C (Mobile).
 */
import { useParams, Link } from 'react-router-dom';
import { logger } from '../../utils/logger';
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import {
  testService,
  type TestResultResponse,
  type TestSessionData,
} from '../../services/test';
import { studentService } from '../../services/student';
import { statsService, type TestHistoryItem } from '../../services/stats';
import { ArrowLeft } from 'lucide-react';
import type { User } from '../../types/auth';

import { StudentInfoCard } from '../../components/result/StudentInfoCard';
import { StatsRow } from '../../components/result/StatsRow';
import { AccuracyChart } from '../../components/result/AccuracyChart';
import { LevelChart } from '../../components/result/LevelChart';
import { WrongAnalysis } from '../../components/result/WrongAnalysis';
import { OXGrid } from '../../components/result/OXGrid';

export function StudentResultPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<User | null>(null);
  const [tests, setTests] = useState<TestSessionData[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedResult, setSelectedResult] = useState<TestResultResponse | null>(null);
  const [history, setHistory] = useState<TestHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [, setIsLoadingResult] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    setIsLoading(true);

    const loadData = async () => {
      try {
        const [studentsData, testsData] = await Promise.all([
          studentService.listStudents(),
          testService.listTests(studentId),
        ]);
        const foundStudent = studentsData.find((s) => s.id === studentId);
        setStudent(foundStudent || null);
        setTests(testsData.tests);

        // Load history for charts
        try {
          const histData = await statsService.getStudentHistory(studentId);
          setHistory(histData.history);
        } catch {
          // stats endpoint might not exist yet
        }

        // Auto-select latest test
        if (testsData.tests.length > 0) {
          viewResult(testsData.tests[0].id);
        }
      } catch (error) {
        logger.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [studentId]);

  const viewResult = async (testId: string) => {
    setIsLoadingResult(true);
    setSelectedTestId(testId);
    try {
      const result = await testService.getTestResult(testId);
      setSelectedResult(result);
    } catch (error) {
      logger.error('Failed to load result:', error);
    } finally {
      setIsLoadingResult(false);
    }
  };

  return (
    <TeacherLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/students"
                className="w-9 h-9 rounded-[10px] bg-white border border-border-subtle flex items-center justify-center hover:bg-bg-muted transition-colors"
              >
                <ArrowLeft className="w-[18px] h-[18px] text-text-primary" />
              </Link>
              <div>
                <h1 className="font-display text-lg font-bold text-text-primary">
                  학생 리포트
                </h1>
                <p className="text-[13px] text-text-secondary">
                  {student?.name || '학생'}
                  {student?.school_name ? ` · ${student.school_name}` : ''}
                  {student?.grade ? ` ${student.grade}` : ''}
                </p>
              </div>
            </div>
          </div>

          {selectedResult ? (
            <div className="space-y-4 lg:space-y-6">
              <StudentInfoCard student={student} session={selectedResult.test_session} />
              <StatsRow session={selectedResult.test_session} />

              {history.length >= 2 && (
                <div className="flex flex-col lg:flex-row gap-4">
                  <div className="flex-1">
                    <AccuracyChart history={history} />
                  </div>
                  <div className="flex-1">
                    <LevelChart history={history} />
                  </div>
                </div>
              )}

              <WrongAnalysis answers={selectedResult.answers} />
              <OXGrid answers={selectedResult.answers} session={selectedResult.test_session} />

              {/* Test history selector */}
              {tests.length > 1 && (
                <div className="rounded-2xl bg-white border border-border-subtle overflow-hidden">
                  <div className="px-5 py-4 border-b border-border-subtle">
                    <h3 className="font-display text-sm lg:text-base font-bold text-text-primary">
                      다른 테스트 결과 보기
                    </h3>
                  </div>
                  <div className="divide-y divide-border-subtle max-h-60 overflow-y-auto">
                    {tests.map((test) => (
                      <button
                        key={test.id}
                        onClick={() => viewResult(test.id)}
                        className={`w-full text-left px-5 py-3 flex items-center justify-between transition-colors ${
                          selectedTestId === test.id
                            ? 'bg-teal-light'
                            : 'hover:bg-bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                              test.test_type === 'placement'
                                ? 'bg-blue-100 text-blue-800'
                                : 'bg-purple-100 text-purple-800'
                            }`}
                          >
                            {test.test_type === 'placement' ? '배치' : '정기'}
                          </span>
                          <span className="text-sm font-semibold text-text-primary">
                            {test.correct_count}/{test.total_questions}
                          </span>
                          {test.score !== null && (
                            <span className="text-sm text-text-secondary">
                              ({test.score}점)
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-text-secondary">
                          {new Date(test.started_at).toLocaleDateString('ko-KR')}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-border-subtle rounded-2xl p-12 text-center">
              <p className="text-text-secondary font-display">
                {tests.length === 0
                  ? '테스트 기록이 없습니다.'
                  : '결과를 불러오는 중...'}
              </p>
            </div>
          )}

          {/* Mobile bottom button */}
          <div className="lg:hidden pb-6">
            <Link
              to="/students"
              className="flex items-center justify-center h-[52px] rounded-2xl bg-teal text-white font-display text-base font-bold w-full"
            >
              돌아가기
            </Link>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

export default StudentResultPage;
