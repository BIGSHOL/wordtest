/**
 * Listening Test page - hear pronunciation, pick the correct English word.
 *
 * Simplified test: no XP, no stages, no levels.
 * All questions loaded at start, answered sequentially.
 * Completion shows accuracy only.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useListeningTestStore,
  useCurrentListeningQuestion,
  useListeningProgress,
} from '../../stores/listeningTestStore';
import { useTimer } from '../../hooks/useTimer';
import {
  preloadWordAudio,
  speakWord,
  stopAllSounds as stopTtsSounds,
  randomizeTtsVoice,
} from '../../utils/tts';
import { playSound, stopSound, unlockAudio } from '../../hooks/useSound';

// Shared quiz components
import { GradientProgressBar } from '../../components/test/GradientProgressBar';
import { TimerBar } from '../../components/test/TimerBar';
import { FeedbackBanner } from '../../components/test/FeedbackBanner';
import { ChoiceButton } from '../../components/test/ChoiceButton';

import { Loader2, Trophy, LogIn, X, Headphones, Volume2, RefreshCw, BarChart3 } from 'lucide-react';

const MIN_FEEDBACK_CORRECT = 800;
const MIN_FEEDBACK_WRONG = 1800;
const PRONOUNCE_DELAY = 400;

export function ListeningTestPage() {
  const navigate = useNavigate();
  const store = useListeningTestStore();
  const {
    sessionId,
    perQuestionTime,
    totalWords,
    totalAnswered,
    correctCount,
    selectedAnswer,
    answerResult,
    isLoading,
    isComplete,
    error,
    completionResult,
  } = store;

  const currentQuestion = useCurrentListeningQuestion();
  const progress = useListeningProgress();
  const submittingRef = useRef(false);
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);
  const lastQuestionChangeAt = useRef(0);

  const timerSeconds = currentQuestion?.timer_seconds ?? perQuestionTime;

  // Timer warning settings
  const timerWarnAt = timerSeconds <= 5 ? timerSeconds : timerSeconds <= 10 ? 7 : 10;
  const timerAudioStart = Math.max(0, 10 - timerWarnAt);

  // Timer
  const handleTimeout = useCallback(() => {
    if (!answerResult && currentQuestion && !submittingRef.current) {
      submittingRef.current = true;
      store.submitAnswer(timerSeconds).catch(() => {
        submittingRef.current = false;
      });
    }
  }, [answerResult, currentQuestion, timerSeconds]);

  const timer = useTimer(timerSeconds, handleTimeout);

  // Track question changes — auto-play pronunciation
  const prevQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    const qid = currentQuestion?.word_mastery_id;
    if (qid && qid !== prevQuestionRef.current) {
      prevQuestionRef.current = qid;
      lastQuestionChangeAt.current = Date.now();
      timer.reset();
      stopTtsSounds();
      stopSound('timer');
      stopSound('two');
      timerSoundPlayed.current = false;
      twoSoundPlayed.current = false;

      // Preload and auto-play pronunciation
      if (currentQuestion?.english) {
        preloadWordAudio(currentQuestion.english);
        setTimeout(() => speakWord(currentQuestion.english), 300);
      }
    }
  }, [currentQuestion?.word_mastery_id]);

  // Timer warning sounds
  useEffect(() => {
    if (answerResult) return;
    if (timer.fraction > 0.95) return;
    if (Date.now() - lastQuestionChangeAt.current < 600) return;
    if (timer.secondsLeft === timerWarnAt && timer.secondsLeft > 0 && !timerSoundPlayed.current) {
      playSound('timer', { startAt: timerAudioStart });
      timerSoundPlayed.current = true;
    }
    if (timer.secondsLeft === 2 && !twoSoundPlayed.current) {
      playSound('two', { volume: 0.5 });
      twoSoundPlayed.current = true;
    }
  }, [timer.secondsLeft, answerResult]);

  // Initialize
  useEffect(() => {
    randomizeTtsVoice();
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      stopTtsSounds();
      stopSound('timer');
      stopSound('two');
    };
  }, []);

  // Handle choice click
  const handleChoiceClick = useCallback(
    (choice: string) => {
      if (answerResult || submittingRef.current) return;
      unlockAudio();
      store.selectAnswer(choice);
      timer.pause();
      submittingRef.current = true;
      const elapsed = timerSeconds - timer.secondsLeft;
      store.submitAnswer(elapsed).catch(() => {
        submittingRef.current = false;
      });
    },
    [answerResult, timerSeconds, timer.secondsLeft],
  );

  // Replay pronunciation
  const handleReplay = useCallback(() => {
    if (currentQuestion?.english) {
      speakWord(currentQuestion.english);
    }
  }, [currentQuestion?.english]);

  // Auto-advance after answer
  useEffect(() => {
    if (!answerResult) {
      submittingRef.current = false;
      return;
    }
    timer.pause();
    stopTtsSounds();
    stopSound('timer');
    stopSound('two');
    playSound(answerResult.is_correct ? 'correct' : 'wrong');

    const wordEnglish = currentQuestion?.english;
    const minDelay = answerResult.is_correct ? MIN_FEEDBACK_CORRECT : MIN_FEEDBACK_WRONG;
    let cancelled = false;

    (async () => {
      await new Promise((r) => setTimeout(r, PRONOUNCE_DELAY));
      if (cancelled) return;

      const speakDone = wordEnglish ? speakWord(wordEnglish) : Promise.resolve();
      const minWait = new Promise((r) => setTimeout(r, minDelay - PRONOUNCE_DELAY));
      await Promise.all([speakDone, minWait]);
      if (cancelled) return;

      submittingRef.current = false;
      stopSound('timer');
      stopSound('two');
      store.nextQuestion();
    })();

    return () => {
      cancelled = true;
    };
  }, [answerResult]);

  // Handle exit
  const handleExit = useCallback(() => {
    stopTtsSounds();
    stopSound('timer');
    stopSound('two');
    store.reset();
    navigate('/test/start', { replace: true });
  }, [navigate]);

  // --- RENDER ---

  // Loading state
  if (isLoading && !sessionId) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="font-display text-sm text-text-secondary">리스닝 테스트 준비 중...</p>
      </div>
    );
  }

  if (!sessionId && error) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <p className="font-display text-sm text-wrong font-medium">{error}</p>
        <button onClick={handleExit} className="font-display text-sm text-accent-indigo font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  // Test complete screen
  if (isComplete) {
    const accuracy = completionResult?.accuracy
      ?? (totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0);

    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-amber-500" />
          <h2 className="font-display text-2xl font-bold text-text-primary">리스닝 테스트 완료!</h2>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-center">
          <div>
            <p className="font-display text-2xl font-bold text-green-600">{completionResult?.correct_count ?? correctCount}</p>
            <p className="font-display text-xs text-text-tertiary">정답</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-wrong">{(completionResult?.total_answered ?? totalAnswered) - (completionResult?.correct_count ?? correctCount)}</p>
            <p className="font-display text-xs text-text-tertiary">오답</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{accuracy}%</p>
            <p className="font-display text-xs text-text-tertiary">정답률</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-[320px]">
          <div className="flex justify-between text-xs font-display text-text-tertiary mb-1">
            <span>정답률</span>
            <span>{completionResult?.correct_count ?? correctCount}/{completionResult?.total_answered ?? totalAnswered}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${accuracy}%`,
                background: accuracy >= 80
                  ? 'linear-gradient(90deg, #22C55E, #15803D)'
                  : accuracy >= 50
                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                    : 'linear-gradient(90deg, #EF4444, #DC2626)',
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-3 w-full max-w-[320px]">
          {sessionId && (
            <button
              onClick={() => {
                const url = `/mastery-report/${sessionId}`;
                const w = 960;
                const h = 800;
                const left = (window.screen.width - w) / 2;
                const top = (window.screen.height - h) / 2;
                window.open(url, 'report', `width=${w},height=${h},left=${left},top=${top},scrollbars=yes,resizable=yes`);
              }}
              className="flex items-center justify-center gap-2 h-12 rounded-2xl font-display text-[15px] font-semibold"
              style={{
                background: '#F5F4F1',
                border: '1.5px solid #E5E4E1',
              }}
            >
              <BarChart3 className="w-5 h-5 text-text-primary" />
              <span className="text-text-primary">결과 보기</span>
            </button>
          )}

          <button
            onClick={handleExit}
            className="flex items-center justify-center gap-2 h-12 rounded-2xl text-white font-display text-[15px] font-semibold"
            style={{
              background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 16px #4F46E540',
            }}
          >
            돌아가기
          </button>
        </div>

        <button
          onClick={() => navigate('/login', { replace: true })}
          className="flex items-center justify-center gap-2"
        >
          <LogIn className="w-3.5 h-3.5 text-text-tertiary" />
          <span className="font-display text-sm font-medium text-text-tertiary hover:text-text-secondary transition-colors">
            로그인 화면으로
          </span>
        </button>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  // Choice state helper
  const getChoiceState = (choice: string) => {
    if (!answerResult) {
      return choice === selectedAnswer ? 'selected' : 'default';
    }
    if (choice === answerResult.correct_answer) return 'correct';
    if (choice === selectedAnswer) return 'wrong';
    return 'disabled';
  };

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between h-14 px-4 md:px-8">
        {/* Left: exit button */}
        <button
          onClick={handleExit}
          className="w-9 h-9 rounded-xl bg-bg-surface flex items-center justify-center"
          style={{ border: '1px solid #E5E4E1' }}
        >
          <X className="w-4 h-4 text-text-primary" />
        </button>

        {/* Center: listening badge */}
        <div className="flex items-center gap-1.5 rounded-full px-3 py-1"
          style={{ background: '#EEF2FF', border: '1.5px solid #4F46E5' }}
        >
          <Headphones className="w-3.5 h-3.5 text-accent-indigo" />
          <span className="font-display text-xs font-bold text-accent-indigo">
            리스닝 테스트
          </span>
        </div>

        {/* Right: progress count */}
        <div className="flex items-center gap-1.5">
          <span className="font-display text-sm font-bold text-accent-indigo">{totalAnswered}</span>
          <span className="font-display text-xs text-text-tertiary">/{totalWords}</span>
        </div>
      </div>

      {/* Progress Bar */}
      <GradientProgressBar current={totalAnswered} total={totalWords} />

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6 px-5 py-6 md:px-8 md:gap-7">
        {/* Timer */}
        {!answerResult && (
          <div className="w-full md:w-[640px]">
            <TimerBar
              secondsLeft={timer.secondsLeft}
              fraction={timer.fraction}
              urgency={timer.urgency}
            />
          </div>
        )}

        {/* Listen card — speaker icon + replay */}
        <div className="w-full md:w-[640px]">
          <div
            className="flex flex-col items-center justify-center gap-5 rounded-2xl bg-bg-surface px-6 md:px-8 py-10 w-full"
            style={{ borderRadius: 20, boxShadow: '0 4px 24px #1A191812' }}
          >
            <p className="font-display text-sm font-medium text-text-tertiary text-center">
              들리는 영어 단어를 고르세요
            </p>

            {/* Large speaker icon */}
            <button
              onClick={handleReplay}
              className="w-20 h-20 rounded-full flex items-center justify-center transition-transform active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
                boxShadow: '0 4px 20px #4F46E530',
              }}
            >
              <Volume2 className="w-10 h-10 text-white" />
            </button>

            <button
              onClick={handleReplay}
              className="flex items-center gap-1.5 text-accent-indigo font-display text-[13px] font-medium active:scale-95 transition-transform"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              다시 듣기
            </button>
          </div>
        </div>

        {/* Feedback banner */}
        {answerResult && (
          <div className="w-full md:w-[640px]">
            <FeedbackBanner
              isCorrect={answerResult.is_correct}
              correctAnswer={answerResult.correct_answer}
            />
          </div>
        )}

        {/* Choices */}
        <div className="w-full md:w-[640px]">
          <div className="flex flex-col gap-3 w-full">
            {currentQuestion.choices.map((choice, i) => (
              <ChoiceButton
                key={choice}
                index={i}
                text={choice}
                state={getChoiceState(choice) as any}
                onClick={() => handleChoiceClick(choice)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ListeningTestPage;
