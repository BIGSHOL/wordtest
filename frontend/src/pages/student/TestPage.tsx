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
import { playSound, stopSound } from '../../hooks/useSound';
import { preloadWordAudio, preloadSentenceAudio, randomizeTtsVoice } from '../../utils/tts';

const TIMER_SECONDS = 15;
const FEEDBACK_DELAY_MS = 800;

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
      submitAnswer(TIMER_SECONDS);
    }
  };

  const { secondsLeft, fraction, urgency, reset: resetTimer, pause: pauseTimer } = useTimer(TIMER_SECONDS, handleTimeout);

  useEffect(() => {
    randomizeTtsVoice();
    const state = useTestStore.getState();
    if (!state.session || state.questions.length === 0) {
      state.reset();
      state.startTest('placement').catch(() => {});
    }
    // Cleanup: stop all sounds and reset store on unmount
    return () => {
      stopSound('timer');
      stopSound('two');
      stopSound('correct');
      stopSound('wrong');
      useTestStore.getState().reset();
    };
  }, []);

  // Block browser back button during test
  useEffect(() => {
    const blockBack = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, []);

  // Reset timer on new question + preload TTS for current & next word
  useEffect(() => {
    resetTimer();
    timerSoundPlayed.current = false;
    twoSoundPlayed.current = false;
    // Preload current word's pronunciation
    if (questions[currentIndex]) {
      preloadWordAudio(questions[currentIndex].word.english);
      // Preload sentence TTS if this is a sentence question (every 5th)
      if ((currentIndex + 1) % 5 === 0 && questions[currentIndex].word.example_en) {
        preloadSentenceAudio(questions[currentIndex].word.example_en);
      }
    }
    // Preload next word's pronunciation + sentence if needed
    if (questions[currentIndex + 1]) {
      preloadWordAudio(questions[currentIndex + 1].word.english);
      if ((currentIndex + 2) % 5 === 0 && questions[currentIndex + 1].word.example_en) {
        preloadSentenceAudio(questions[currentIndex + 1].word.example_en);
      }
    }
  }, [currentIndex, resetTimer, questions]);

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

  // When answer is submitted: pause timer, stop sounds, play feedback, auto-advance
  useEffect(() => {
    if (!answerResult) return;

    // Immediately pause timer and stop countdown sounds
    pauseTimer();
    stopSound('timer');
    stopSound('two');

    // Play feedback sound
    playSound(answerResult.is_correct ? 'correct' : 'wrong');

    const timer = setTimeout(() => {
      const { session: s, currentIndex: idx } = useTestStore.getState();
      const total = s?.total_questions ?? 0;
      if (s && idx >= total - 1) {
        navigate(`/result/${s.id}`, { replace: true });
      } else {
        nextQuestion();
      }
    }, FEEDBACK_DELAY_MS);
    return () => clearTimeout(timer);
  }, [answerResult, navigate, nextQuestion, pauseTimer]);

  const adaptiveLevel = useTestStore((s) => s.adaptiveLevel);
  const adaptiveLesson = useTestStore((s) => s.adaptiveLesson);

  const currentQuestion = questions[currentIndex];
  const totalToAnswer = session?.total_questions ?? questions.length;
  const isLastQuestion = currentIndex >= totalToAnswer - 1;
  const isFinished = answerResult && isLastQuestion;

  // Every 5th question (5, 10, 15, 20) uses sentence format
  const isSentenceQuestion = (currentIndex + 1) % 5 === 0;

  const handleChoiceClick = (choice: string) => {
    if (answerResult || isSubmitting) return;
    selectAnswer(choice);
    submitAnswer(TIMER_SECONDS - secondsLeft);
  };

  const handleNext = () => {
    if (isFinished && session) {
      navigate(`/result/${session.id}`, { replace: true });
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
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header */}
      <QuizHeader
        level={adaptiveLevel}
        lesson={adaptiveLesson}
        currentIndex={currentIndex}
        totalQuestions={totalToAnswer}
      />

      {/* Progress Bar */}
      <GradientProgressBar current={currentIndex + 1} total={totalToAnswer} />

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6 px-5 py-6 lg:gap-7 lg:px-12 lg:py-5">
        {/* Timer */}
        {!answerResult && (
          <div className="w-full lg:w-[640px]">
            <TimerBar
              secondsLeft={secondsLeft}
              fraction={fraction}
              urgency={urgency}
            />
          </div>
        )}

        {/* Word Card or Sentence Card */}
        <div className="w-full lg:w-[640px]">
          {isSentenceQuestion && currentQuestion.word.example_en ? (
            <SentenceCard
              sentence={currentQuestion.word.example_en}
              word={currentQuestion.word.english}
            />
          ) : (
            <WordCard word={currentQuestion.word.english} />
          )}
        </div>

        {/* Choices: vertical on mobile, 2x2 grid on PC */}
        <div className="flex flex-col gap-3 w-full lg:grid lg:grid-cols-2 lg:gap-3 lg:w-[640px]">
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
      <div className="h-[70px] px-5 flex items-center lg:justify-center" onClick={answerResult ? handleNext : undefined}>
        {answerResult ? (
          <button onClick={handleNext} className="w-full lg:w-[640px]">
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
