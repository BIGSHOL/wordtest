/**
 * Quiz page - matches pencil design screens HyfQX (Type1) and DAXeO (Type2).
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../../components/test/QuizHeader';
import { GradientProgressBar } from '../../components/test/GradientProgressBar';
import { TimerBar } from '../../components/test/TimerBar';
import { WordCard } from '../../components/test/WordCard';
import { SentenceCard } from '../../components/test/SentenceCard';
import { ChoiceButton } from '../../components/test/ChoiceButton';
import { FeedbackBanner } from '../../components/test/FeedbackBanner';
import { useTestStore } from '../../stores/testStore';
import { useTimer } from '../../hooks/useTimer';
import { playSound } from '../../hooks/useSound';

const TIMER_SECONDS = 15;
const FEEDBACK_DELAY_MS = 1200;

export function TestPage() {
  const navigate = useNavigate();
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);
  const session = useTestStore((s) => s.session);
  const questions = useTestStore((s) => s.questions);
  const currentIndex = useTestStore((s) => s.currentIndex);
  const selectedAnswer = useTestStore((s) => s.selectedAnswer);
  const answerResult = useTestStore((s) => s.answerResult);
  const isLoading = useTestStore((s) => s.isLoading);
  const isSubmitting = useTestStore((s) => s.isSubmitting);
  const error = useTestStore((s) => s.error);
  const selectAnswer = useTestStore((s) => s.selectAnswer);
  const submitAnswer = useTestStore((s) => s.submitAnswer);
  const nextQuestion = useTestStore((s) => s.nextQuestion);

  const handleTimeout = () => {
    if (!answerResult && !isSubmitting) {
      submitAnswer();
    }
  };

  const { secondsLeft, fraction, urgency, reset: resetTimer } = useTimer(TIMER_SECONDS, handleTimeout);

  useEffect(() => {
    const state = useTestStore.getState();
    if (!state.session || state.questions.length === 0) {
      state.reset();
      state.startTest('placement').catch(() => {});
    }
    return () => useTestStore.getState().reset();
  }, []);

  // Reset timer on new question
  useEffect(() => {
    resetTimer();
    timerSoundPlayed.current = false;
    twoSoundPlayed.current = false;
  }, [currentIndex, resetTimer]);

  // Timer warning sounds
  useEffect(() => {
    if (answerResult) return;
    if (secondsLeft === 10 && !timerSoundPlayed.current) {
      playSound('timer');
      timerSoundPlayed.current = true;
    }
    if (secondsLeft === 2 && !twoSoundPlayed.current) {
      playSound('two');
      twoSoundPlayed.current = true;
    }
  }, [secondsLeft, answerResult]);

  // Play correct/wrong sound + auto-advance
  useEffect(() => {
    if (!answerResult) return;
    playSound(answerResult.is_correct ? 'correct' : 'wrong');

    const timer = setTimeout(() => {
      const { session: s, currentIndex: idx, questions: qs } = useTestStore.getState();
      if (s && idx >= qs.length - 1) {
        navigate(`/result/${s.id}`);
      } else {
        nextQuestion();
      }
    }, FEEDBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answerResult]);

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;
  const isFinished = answerResult && isLastQuestion;
  const currentLevel = session?.determined_level || 1;

  // Every 5th question (5, 10, 15, 20) uses sentence format
  const isSentenceQuestion = (currentIndex + 1) % 5 === 0;

  const handleChoiceClick = (choice: string) => {
    if (answerResult || isSubmitting) return;
    selectAnswer(choice);
    setTimeout(() => {
      const { selectedAnswer: sel, answerResult: res } = useTestStore.getState();
      if (sel && !res) submitAnswer();
    }, 0);
  };

  const handleNext = () => {
    if (isFinished && session) {
      navigate(`/result/${session.id}`);
    } else {
      nextQuestion();
    }
  };

  const getChoiceState = (choice: string) => {
    if (!answerResult) {
      return selectedAnswer === choice ? 'selected' : 'default';
    }
    if (choice === answerResult.correct_answer) return 'correct';
    if (selectedAnswer === choice) return 'wrong';
    return 'disabled';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-4 border-accent-indigo border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="font-display text-sm text-text-secondary">테스트를 준비하고 있습니다...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-wrong font-display font-medium">{error}</p>
          <button
            onClick={() => navigate('/student')}
            className="px-4 py-2 bg-accent-indigo text-white rounded-lg font-display hover:opacity-90 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  if (!currentQuestion || !session) return null;

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col md:max-w-[640px] md:mx-auto">
      {/* Header */}
      <QuizHeader
        level={currentLevel}
        currentIndex={currentIndex}
        totalQuestions={questions.length}
      />

      {/* Progress Bar */}
      <GradientProgressBar current={currentIndex + 1} total={questions.length} />

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center gap-6 px-5 py-6">
        {/* Timer */}
        {!answerResult && (
          <TimerBar
            secondsLeft={secondsLeft}
            fraction={fraction}
            urgency={urgency}
          />
        )}

        {/* Word Card or Sentence Card */}
        {isSentenceQuestion && currentQuestion.word.example_en ? (
          <SentenceCard
            sentence={currentQuestion.word.example_en}
            word={currentQuestion.word.english}
          />
        ) : (
          <WordCard word={currentQuestion.word.english} />
        )}

        {/* Choices */}
        <div className="flex flex-col gap-3 w-full">
          {currentQuestion.choices.map((choice, i) => (
            <ChoiceButton
              key={i}
              index={i}
              text={choice}
              state={getChoiceState(choice)}
              onClick={() => handleChoiceClick(choice)}
            />
          ))}
        </div>
      </div>

      {/* Footer Area */}
      <div className="h-[70px] px-5 flex items-center" onClick={answerResult ? handleNext : undefined}>
        {answerResult ? (
          <button onClick={handleNext} className="w-full">
            <FeedbackBanner
              isCorrect={answerResult.is_correct}
              correctAnswer={answerResult.correct_answer}
            />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default TestPage;
