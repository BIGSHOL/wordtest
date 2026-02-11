/**
 * Wrong words list page - matches pencil design screen 9xu1Y.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { WrongWordCard } from '../../components/test/WrongWordCard';
import { useTestStore, type WrongAnswer } from '../../stores/testStore';
import { useAuthStore } from '../../stores/auth';
import testService from '../../services/test';

export function WrongWordsPage() {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const storeWrongAnswers = useTestStore((s) => s.wrongAnswers);
  const user = useAuthStore((s) => s.user);
  const isCodeOnlyUser = !user?.username;
  const homePath = isCodeOnlyUser ? '/test/start' : '/student';
  const [wrongItems, setWrongItems] = useState<WrongAnswer[]>(storeWrongAnswers);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // If store has wrong answers, use them; otherwise fetch from API
    if (storeWrongAnswers.length > 0) {
      setWrongItems(storeWrongAnswers);
      return;
    }
    if (!testId) return;
    setIsLoading(true);
    testService
      .getTestResult(testId)
      .then((result) => {
        const items = result.answers
          .filter((a) => !a.is_correct)
          .map((a) => ({
            english: a.word_english,
            correctAnswer: a.correct_answer,
            selectedAnswer: a.selected_answer || '',
          }));
        setWrongItems(items);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [testId, storeWrongAnswers]);

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-3 h-14 px-4 md:px-8 lg:h-16 lg:px-12 w-full">
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 lg:w-10 lg:h-10 rounded-xl bg-bg-surface flex items-center justify-center shrink-0"
          style={{ border: '1px solid #E5E4E1' }}
        >
          <ArrowLeft className="w-[18px] h-[18px] text-text-primary" />
        </button>
        <span className="font-display text-lg lg:text-xl font-bold text-text-primary">틀린 단어 목록</span>
        <div className="rounded-full bg-wrong-light px-2.5 py-1">
          <span className="font-display text-[13px] font-bold text-wrong">
            {wrongItems.length}개
          </span>
        </div>
      </div>

      {/* Word List */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-2 lg:px-12 flex justify-center">
        <div className="w-full md:max-w-[640px] lg:w-[760px]">
          {isLoading ? (
            <div className="flex items-center justify-center pt-20">
              <div className="w-8 h-8 border-4 border-accent-indigo border-t-transparent rounded-full animate-spin" />
            </div>
          ) : wrongItems.length === 0 ? (
            <div className="flex items-center justify-center pt-20">
              <p className="font-display text-text-tertiary">틀린 단어가 없습니다!</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5 md:px-0 lg:grid lg:grid-cols-2 lg:gap-3">
              {wrongItems.map((item, i) => (
                <WrongWordCard
                  key={i}
                  english={item.english}
                  correctAnswer={item.correctAnswer}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Area */}
      <div className="px-4 md:px-8 pt-3 pb-10 lg:px-12 flex justify-center">
        <button
          onClick={() => navigate(homePath, { replace: true })}
          className="flex items-center justify-center gap-2 w-full md:max-w-[640px] lg:w-[760px] h-[52px] rounded-2xl text-white"
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

export default WrongWordsPage;
