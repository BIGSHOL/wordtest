/**
 * Test result page.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { ResultDisplay } from '../../components/test/ResultDisplay';
import testService, { type TestResultResponse } from '../../services/test';

export function ResultPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [result, setResult] = useState<TestResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    setIsLoading(true);
    testService
      .getTestResult(testId)
      .then(setResult)
      .catch((err) => {
        setError(err.response?.data?.detail || '결과를 불러올 수 없습니다.');
      })
      .finally(() => setIsLoading(false));
  }, [testId]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (error || !result) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-wrong font-medium">{error || '결과를 찾을 수 없습니다.'}</p>
            <button
              onClick={() => navigate('/student')}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              돌아가기
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        <h1 className="text-2xl font-bold text-text-primary text-center">테스트 결과</h1>

        <div className="bg-surface border border-[#E2E8F0] rounded-xl p-6">
          <ResultDisplay result={result} />
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => navigate('/student')}
            className="px-6 py-3 border border-[#E2E8F0] text-text-secondary rounded-xl hover:bg-[#F1F5F9] transition-colors font-medium"
          >
            홈으로
          </button>
          <button
            onClick={() => navigate('/test')}
            className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors font-medium"
          >
            다시 테스트
          </button>
        </div>
      </div>
    </Layout>
  );
}

export default ResultPage;
