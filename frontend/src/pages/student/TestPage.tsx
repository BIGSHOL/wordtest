/**
 * Level test taking page.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../../components/layout/Layout';
import { ProgressBar } from '../../components/test/ProgressBar';
import { TTSButton } from '../../components/test/TTSButton';
import { AnswerCard } from '../../components/test/AnswerCard';
import { useTestStore } from '../../stores/testStore';

export function TestPage() {
  const navigate = useNavigate();
  const {
    session,
    questions,
    currentIndex,
    selectedAnswer,
    answerResult,
    isLoading,
    isSubmitting,
    error,
    startTest,
    selectAnswer,
    submitAnswer,
    nextQuestion,
    reset,
  } = useTestStore();

  useEffect(() => {
    reset();
    startTest('placement').catch(() => {});
    return () => reset();
  }, []);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;
  const isFinished = answerResult && isLastQuestion;

  const handleSubmit = async () => {
    if (!selectedAnswer || answerResult) return;
    await submitAnswer();
  };

  const handleNext = () => {
    if (isFinished && session) {
      navigate(`/result/${session.id}`);
    } else {
      nextQuestion();
    }
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-3">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-text-secondary">테스트를 준비하고 있습니다...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <p className="text-wrong font-medium">{error}</p>
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

  if (!currentQuestion || !session) return null;

  return (
    <Layout>
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Progress */}
        <ProgressBar current={currentIndex + 1} total={questions.length} />

        {/* Question */}
        <div className="bg-surface border border-[#E2E8F0] rounded-xl p-6 space-y-6">
          <div className="text-center space-y-2">
            <p className="text-sm text-text-secondary">다음 단어의 뜻을 고르세요</p>
            <div className="flex items-center justify-center gap-2">
              <h2 className="text-3xl font-bold text-text-primary">
                {currentQuestion.word.english}
              </h2>
              <TTSButton word={currentQuestion.word.english} />
            </div>
          </div>

          {/* Choices */}
          <div className="space-y-3">
            {currentQuestion.choices.map((choice, i) => (
              <AnswerCard
                key={i}
                text={choice}
                index={i}
                selected={selectedAnswer === choice}
                correct={
                  answerResult
                    ? choice === answerResult.correct_answer
                      ? true
                      : selectedAnswer === choice
                        ? false
                        : null
                    : null
                }
                disabled={!!answerResult}
                onClick={() => selectAnswer(choice)}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex justify-center">
            {!answerResult ? (
              <button
                onClick={handleSubmit}
                disabled={!selectedAnswer || isSubmitting}
                className="px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-default"
              >
                {isSubmitting ? '확인 중...' : '정답 확인'}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-8 py-3 bg-primary text-white rounded-xl font-medium hover:bg-primary/90 transition-colors"
              >
                {isFinished ? '결과 보기' : '다음 문제'}
              </button>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default TestPage;
