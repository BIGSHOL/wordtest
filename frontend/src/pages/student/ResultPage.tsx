/**
 * Test result page - matches pencil design screen ZIBxZ.
 */
import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { List, ChevronRight } from 'lucide-react';
import { RankBadge } from '../../components/test/RankBadge';
import { StatCard } from '../../components/test/StatCard';
import { getLevelRank } from '../../types/rank';
import { useTestStore } from '../../stores/testStore';
import testService, { type TestResultResponse } from '../../services/test';
import { playSound } from '../../hooks/useSound';

export function ResultPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const { wrongAnswers } = useTestStore();
  const [result, setResult] = useState<TestResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const soundPlayed = useRef(false);

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

  // Play result sound once
  useEffect(() => {
    if (!result || soundPlayed.current) return;
    soundPlayed.current = true;
    const { test_session: s } = result;
    const total = s.total_questions;
    const correct = s.correct_count;
    if (total > 0 && correct === total) {
      playSound('perfect');
    } else if (total > 0 && correct / total >= 0.7) {
      playSound('lvlup');
    } else {
      playSound('lvldown');
    }
  }, [result]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-accent-indigo border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-wrong font-display font-medium">{error || '결과를 찾을 수 없습니다.'}</p>
          <button
            onClick={() => navigate('/student', { replace: true })}
            className="px-4 py-2 bg-accent-indigo text-white rounded-lg font-display hover:opacity-90 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const { test_session: session, answers } = result;
  const level = session.determined_level || 1;
  const rank = getLevelRank(level);
  const totalQ = session.total_questions;
  const correctCount = session.correct_count;
  const wrongCount = totalQ - correctCount;
  const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;

  // Wrong answers from store (during session) or from API result
  const wrongItems = wrongAnswers.length > 0
    ? wrongAnswers
    : answers
        .filter((a) => !a.is_correct)
        .map((a) => ({
          english: a.word_english,
          correctAnswer: a.correct_answer,
          selectedAnswer: a.selected_answer || '',
        }));

  const previewWrong = wrongItems.slice(0, 4);

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col md:items-center lg:items-center">
      {/* Scroll Content */}
      <div className="flex-1 overflow-y-auto w-full md:max-w-[600px] lg:max-w-[600px]">
        {/* Result Header */}
        <div className="flex flex-col items-center gap-5 pt-12 pb-6 px-6">
          <span className="font-display text-sm font-semibold text-accent-indigo">테스트 완료!</span>
          <RankBadge rank={rank} size="lg" />
          <h1
            className="font-display text-[28px] font-bold"
            style={{ color: rank.colors[1], letterSpacing: -0.5 }}
          >
            {rank.name}&nbsp;&nbsp;{rank.nameKo}
          </h1>
          <span className="font-display text-base font-semibold text-text-secondary">
            Level {level}
          </span>
        </div>

        {/* Stats Row */}
        <div className="flex gap-3 px-6 w-full">
          <StatCard value={`${accuracy}%`} label="정답률" color="#4F46E5" />
          <StatCard value={String(correctCount)} label="맞힌 문제" color="#10B981" />
          <StatCard value={String(wrongCount)} label="틀린 문제" color="#EF4444" />
        </div>

        {/* Wrong Words Summary */}
        {wrongItems.length > 0 && (
          <div className="flex flex-col gap-3 pt-4 px-6">
            <span className="font-display text-[15px] font-semibold text-text-primary">
              틀린 단어 미리보기
            </span>

            <div
              className="rounded-2xl bg-bg-surface overflow-hidden w-full"
              style={{ boxShadow: '0 2px 8px #1A191808' }}
            >
              {previewWrong.map((item, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-3.5"
                  style={{
                    borderBottom: i < previewWrong.length - 1 ? '1px solid #E5E4E1' : undefined,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-wrong font-bold">✕</span>
                    <span className="font-word text-sm font-semibold text-text-primary">
                      {item.english}
                    </span>
                  </div>
                  <span className="font-display text-sm text-text-tertiary">
                    {item.correctAnswer}
                  </span>
                </div>
              ))}
            </div>

            {/* View All Button */}
            <button
              onClick={() => navigate(`/result/${testId}/wrong`)}
              className="flex items-center justify-center gap-1.5 h-11 rounded-xl bg-wrong-light w-full"
              style={{ border: '1px solid #EF444420' }}
            >
              <List className="w-4 h-4 text-wrong" />
              <span className="font-display text-sm font-semibold text-wrong">틀린 단어 전체보기</span>
              <ChevronRight className="w-4 h-4 text-wrong" />
            </button>
          </div>
        )}
      </div>

      {/* Bottom Buttons */}
      <div className="px-6 pt-3 pb-10 w-full md:max-w-[600px] lg:max-w-[600px]">
        <button
          onClick={() => navigate('/student', { replace: true })}
          className="flex items-center justify-center gap-2 w-full h-[52px] rounded-2xl text-white"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: '0 4px 16px #4F46E540',
          }}
        >
          <span className="font-display text-base font-bold">홈으로 돌아가기</span>
        </button>
      </div>
    </div>
  );
}

export default ResultPage;
