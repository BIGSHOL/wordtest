/**
 * Quiz page - matches pencil design screens HyfQX (Type1) and DAXeO (Type2).
 */
import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { QuizHeader } from '../../components/test/QuizHeader';
import { GradientProgressBar } from '../../components/test/GradientProgressBar';
import { TimerBar } from '../../components/test/TimerBar';
import { WordCard } from '../../components/test/WordCard';
import { MeaningCard } from '../../components/test/MeaningCard';
import { SentenceCard } from '../../components/test/SentenceCard';
import { ChoiceButton } from '../../components/test/ChoiceButton';
import { FeedbackBanner } from '../../components/test/FeedbackBanner';
import { useTestStore } from '../../stores/testStore';
import { useAuthStore } from '../../stores/auth';
import { useTimer } from '../../hooks/useTimer';
import { playSound, stopSound, stopAllSounds, unlockAudio } from '../../hooks/useSound';
import { preloadWordAudio, preloadSentenceAudio, batchPreloadPool, randomizeTtsVoice } from '../../utils/tts';

const TIMER_SECONDS = 15;
const FEEDBACK_DELAY_MS = 800;

export function TestPage() {
  const navigate = useNavigate();
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);
  const poolPreloaded = useRef(false);
  const session = useTestStore((s) => s.session);
  const questionPool = useTestStore((s) => s.questionPool);
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
      stopAllSounds();
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

  // Batch preload entire question pool TTS on test start
  useEffect(() => {
    if (poolPreloaded.current || questionPool.length === 0) return;
    poolPreloaded.current = true;
    batchPreloadPool(questionPool.map((q) => q.word));
  }, [questionPool]);

  // Block browser back button during test
  useEffect(() => {
    const blockBack = () => {
      window.history.pushState(null, '', window.location.href);
    };
    window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, []);

  // Reset timer on new question + stop lingering sounds + preload TTS
  useEffect(() => {
    stopAllSounds();
    resetTimer();
    timerSoundPlayed.current = false;
    twoSoundPlayed.current = false;
    const current = questions[currentIndex];
    if (current) {
      preloadWordAudio(current.word.english);
      if (current.word.example_en) {
        preloadSentenceAudio(current.word.example_en);
      }
    }
    // Preload next 2 questions' audio (for sequential mode)
    for (let i = 1; i <= 2; i++) {
      const next = questions[currentIndex + i];
      if (next) {
        preloadWordAudio(next.word.english);
        const exEn = next.word.example_en;
        if (exEn) preloadSentenceAudio(exEn);
      }
    }
  }, [currentIndex, resetTimer, questions]);

  // Adaptive mode: preload newly added question's audio immediately
  const prevQLen = useRef(questions.length);
  useEffect(() => {
    if (questions.length > prevQLen.current) {
      const newest = questions[questions.length - 1];
      if (newest) {
        preloadWordAudio(newest.word.english);
        if (newest.word.example_en) {
          preloadSentenceAudio(newest.word.example_en);
        }
      }
    }
    prevQLen.current = questions.length;
  }, [questions.length]);

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

    // Immediately pause timer and stop all lingering sounds
    pauseTimer();
    stopAllSounds();

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

  const questionType = currentQuestion?.question_type || 'word_meaning';

  const handleChoiceClick = (choice: string) => {
    if (answerResult || isSubmitting) return;
    unlockAudio();
    stopAllSounds();
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
    const user = useAuthStore.getState().user;
    const errorHomePath = !user?.username ? '/test/start' : '/student';
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-wrong font-display font-medium">{error}</p>
          <button
            onClick={() => navigate(errorHomePath)}
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
      <div className="flex-1 flex flex-col justify-center items-center gap-6 px-5 py-6 md:px-8 md:gap-7 lg:gap-7 lg:px-12 lg:py-5">
        {/* Timer */}
        {!answerResult && (
          <div className="w-full md:w-[640px] lg:w-[640px]">
            <TimerBar
              secondsLeft={secondsLeft}
              fraction={fraction}
              urgency={urgency}
            />
          </div>
        )}

        {/* Word Card or Sentence Card */}
        <div className="w-full md:w-[640px] lg:w-[640px]">
          {questionType === 'sentence_blank' && currentQuestion.word.example_en ? (
            <SentenceCard
              sentence={currentQuestion.word.example_en}
              word={currentQuestion.word.english}
            />
          ) : questionType === 'meaning_word' && currentQuestion.word.korean ? (
            <MeaningCard korean={currentQuestion.word.korean} />
          ) : (
            <WordCard word={currentQuestion.word.english} />
          )}
        </div>

        {/* Choices: vertical on mobile, 2x2 grid on PC */}
        <div className="flex flex-col gap-3 w-full md:grid md:grid-cols-2 md:gap-3 md:w-[640px] lg:grid lg:grid-cols-2 lg:gap-3 lg:w-[640px]">
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
      <div className="min-h-[70px] px-5 md:px-8 flex items-center lg:justify-center" onClick={answerResult ? handleNext : undefined}>
        {answerResult ? (
          <button onClick={handleNext} className="w-full md:w-[640px] md:mx-auto lg:w-[640px]">
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
