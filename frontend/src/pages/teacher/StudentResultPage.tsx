/**
 * Teacher view: student test result report.
 * Redesigned to match Pencil design E6YZM (Placement Test Report).
 */
import { useParams, Link } from 'react-router-dom';
import { logger } from '../../utils/logger';
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import {
  testService,
  type TestSessionData,
} from '../../services/test';
import { studentService } from '../../services/student';
import { statsService } from '../../services/stats';
import { ArrowLeft, Download, Image, Printer } from 'lucide-react';
import type { User } from '../../types/auth';
import type { EnhancedTestReport } from '../../types/report';

import { ReportHeader } from '../../components/report/ReportHeader';
import { OverallResult } from '../../components/report/OverallResult';
import { RadarChart } from '../../components/report/RadarChart';
import { TimeBreakdown } from '../../components/report/TimeBreakdown';
import { LevelChartTable } from '../../components/report/LevelChartTable';
import { MetricDetailSection } from '../../components/report/MetricDetailSection';
import { WrongAnalysis } from '../../components/result/WrongAnalysis';
import { OXGrid } from '../../components/result/OXGrid';

export function StudentResultPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<User | null>(null);
  const [tests, setTests] = useState<TestSessionData[]>([]);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [report, setReport] = useState<EnhancedTestReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

        // Auto-select latest test
        if (testsData.tests.length > 0) {
          loadReport(studentId, testsData.tests[0].id);
        }
      } catch (error) {
        logger.error('Failed to load data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [studentId]);

  const loadReport = async (sid: string, testId: string) => {
    setSelectedTestId(testId);
    try {
      const data = await statsService.getEnhancedReport(sid, testId);
      setReport(data);
    } catch (error) {
      logger.error('Failed to load report:', error);
    }
  };

  return (
    <TeacherLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-[900px] mx-auto space-y-6 py-6 px-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                to="/students"
                className="w-9 h-9 rounded-[10px] bg-white border border-border-subtle flex items-center justify-center hover:bg-bg-muted transition-colors"
              >
                <ArrowLeft className="w-[18px] h-[18px] text-text-primary" />
              </Link>
              <h1 className="font-display text-lg font-bold text-text-primary">
                학생 리포트
              </h1>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => alert('준비 중입니다')}
                className="h-9 px-[14px] rounded-lg bg-[#CC0000] text-white text-sm font-semibold flex items-center gap-2 hover:bg-[#CC0000]/90 transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>PDF</span>
              </button>
              <button
                onClick={() => alert('준비 중입니다')}
                className="h-9 px-[14px] rounded-lg bg-white border border-border-subtle text-text-secondary text-sm font-semibold flex items-center gap-2 hover:bg-bg-muted transition-colors"
              >
                <Image className="w-4 h-4" />
                <span>이미지</span>
              </button>
              <button
                onClick={() => alert('준비 중입니다')}
                className="h-9 px-[14px] rounded-lg bg-white border border-border-subtle text-text-secondary text-sm font-semibold flex items-center gap-2 hover:bg-bg-muted transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>인쇄</span>
              </button>
            </div>
          </div>

          {report ? (
            <div className="bg-white rounded-2xl border border-border-subtle p-8 space-y-8">
              {/* 1. Header */}
              <ReportHeader student={student} session={report.test_session} />

              {/* 2. Main assessment row (3 columns) */}
              <div className="flex gap-5">
                <OverallResult report={report} />
                <RadarChart metrics={report.radar_metrics} />
                <TimeBreakdown
                  totalTime={report.total_time_seconds}
                  categories={report.category_times}
                />
              </div>

              {/* 3. Level Chart */}
              <LevelChartTable
                currentRank={report.test_session.determined_level}
              />

              {/* 4. Metric Detail Section */}
              <MetricDetailSection details={report.metric_details} />

              {/* 5. Detailed analysis (preserved from original) */}
              <WrongAnalysis answers={report.answers} />
              <OXGrid
                answers={report.answers}
                session={report.test_session}
              />
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

          {/* Test history selector */}
          {tests.length > 1 && (
            <div className="rounded-2xl bg-white border border-border-subtle overflow-hidden">
              <div className="px-5 py-4 border-b border-border-subtle">
                <h3 className="font-display text-sm font-bold text-text-primary">
                  다른 테스트 결과 보기
                </h3>
              </div>
              <div className="divide-y divide-border-subtle max-h-60 overflow-y-auto">
                {tests.map((test) => (
                  <button
                    key={test.id}
                    onClick={() =>
                      studentId && loadReport(studentId, test.id)
                    }
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
      )}
    </TeacherLayout>
  );
}

export default StudentResultPage;
