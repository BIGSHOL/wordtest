/**
 * Teacher view: student test results.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { LevelBadge } from '../../components/test/LevelBadge';
import { ResultDisplay } from '../../components/test/ResultDisplay';
import testService, { type TestSessionData, type TestResultResponse } from '../../services/test';

export function StudentResultPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestSessionData[]>([]);
  const [selectedResult, setSelectedResult] = useState<TestResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingResult, setIsLoadingResult] = useState(false);

  useEffect(() => {
    if (!studentId) return;
    testService
      .listTests(studentId)
      .then((data) => setTests(data.tests))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [studentId]);

  const viewResult = async (testId: string) => {
    setIsLoadingResult(true);
    try {
      const result = await testService.getTestResult(testId);
      setSelectedResult(result);
    } catch {
      // handle silently
    } finally {
      setIsLoadingResult(false);
    }
  };

  return (
    <Layout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-[#F1F5F9] transition-colors text-text-secondary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-text-primary">테스트 결과</h1>
        </div>

        {/* Result detail modal */}
        {selectedResult && (
          <div className="bg-surface border border-[#E2E8F0] rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">상세 결과</h2>
              <button
                onClick={() => setSelectedResult(null)}
                className="text-sm text-text-secondary hover:text-text-primary"
              >
                닫기
              </button>
            </div>
            <ResultDisplay result={selectedResult} />
          </div>
        )}

        {/* Test list */}
        <div className="bg-surface border border-[#E2E8F0] rounded-xl">
          <div className="px-5 py-4 border-b border-[#E2E8F0]">
            <h2 className="text-lg font-semibold text-text-primary">테스트 이력</h2>
          </div>
          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : tests.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">테스트 기록이 없습니다.</div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {tests.map((test) => (
                <div key={test.id} className="px-5 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {test.determined_level && (
                      <LevelBadge level={test.determined_level} size="sm" />
                    )}
                    <div>
                      <p className="font-medium text-text-primary">
                        {test.correct_count}/{test.total_questions} 정답
                        {test.score !== null && ` (${test.score}점)`}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {new Date(test.started_at).toLocaleDateString('ko-KR')}
                        {' '}
                        {test.test_type === 'placement' ? '배치' : '정기'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => viewResult(test.id)}
                    disabled={isLoadingResult}
                    className="text-sm text-primary hover:underline disabled:opacity-50"
                  >
                    상세보기
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}

export default StudentResultPage;
