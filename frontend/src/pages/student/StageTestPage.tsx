/**
 * Stage Test page - wave-based word mastery through stages 1→5.
 *
 * Reuses quiz UI components from MasteryPage.
 * Key differences from MasteryPage:
 * - Shows stage progress (mastered/total) instead of XP bar
 * - Shows current word's stage badge (Stage 3/5)
 * - No level-up/down animations
 * - Completion screen shows mastered/skipped/accuracy
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useStageTestStore,
  useCurrentStageQuestion,
  useCurrentStageWord,
} from '../../stores/stageTestStore';
import { useTimer } from '../../hooks/useTimer';
import { isTypingQuestion, isListenQuestion, STAGE_CONFIG } from '../../types/mastery';
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
import { WordCard } from '../../components/test/WordCard';
import { MeaningCard } from '../../components/test/MeaningCard';
import { ChoiceButton } from '../../components/test/ChoiceButton';
import { ListenCard } from '../../components/mastery/ListenCard';
import { TypingInput } from '../../components/mastery/TypingInput';
import { SentenceBlankCard } from '../../components/mastery/SentenceBlankCard';

import { Loader2, Trophy, LogIn, X, Zap } from 'lucide-react';

const MIN_FEEDBACK_CORRECT = 800;
const MIN_FEEDBACK_WRONG = 1800;
const PRONOUNCE_DELAY = 400;

// Stage colors for badge
const STAGE_COLORS = [
  '', // 0 unused
  '#86EFAC', // stage 1
  '#4ADE80', // stage 2
  '#22C55E', // stage 3
  '#16A34A', // stage 4
  '#15803D', // stage 5
];

export function StageTestPage() {
  const navigate = useNavigate();
  const store = useStageTestStore();
  const {
    sessionId,
    words,
    totalWords,
    masteredCount,
    skippedCount,
    totalAnswered,
    correctCount,
    combo,
    bestCombo,
    maxFails,
    selectedAnswer,
    typedAnswer,
    answerResult,
    isLoading,
    isComplete,
    completionResult,
    error,
  } = store;

  const currentQuestion = useCurrentStageQuestion();
  const currentWord = useCurrentStageWord();
  const questionType = currentQuestion?.question_type || 'word_to_meaning';
  const timerSeconds = currentQuestion?.timer_seconds ?? 5;
  const isTyping = isTypingQuestion(questionType);
  const isListen = isListenQuestion(questionType);
  const submittingRef = useRef(false);
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);
  const lastQuestionChangeAt = useRef(0);

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

  // Track question changes
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

      if (currentQuestion?.word.english) {
        preloadWordAudio(currentQuestion.word.english);
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

  // Handle typing submission
  const handleTypingSubmit = useCallback(() => {
    if (answerResult || !typedAnswer.trim() || submittingRef.current) return;
    unlockAudio();
    timer.pause();
    submittingRef.current = true;
    const elapsed = timerSeconds - timer.secondsLeft;
    store.submitAnswer(elapsed).catch(() => {
      submittingRef.current = false;
    });
  }, [answerResult, typedAnswer, timerSeconds, timer.secondsLeft]);

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

    const wordEnglish = currentQuestion?.word?.english;
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
        <p className="font-display text-sm text-text-secondary">스테이지 테스트 준비 중...</p>
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
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const failedWords = words.filter((w) => w.status === 'skipped');

    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-amber-500" />
          <h2 className="font-display text-2xl font-bold text-text-primary">스테이지 테스트 완료!</h2>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-center">
          <div>
            <p className="font-display text-2xl font-bold text-green-600">{masteredCount}</p>
            <p className="font-display text-xs text-text-tertiary">마스터</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-wrong">{skippedCount}</p>
            <p className="font-display text-xs text-text-tertiary">스킵</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{accuracy}%</p>
            <p className="font-display text-xs text-text-tertiary">정답률</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{bestCombo}</p>
            <p className="font-display text-xs text-text-tertiary">최대 콤보</p>
          </div>
        </div>

        {/* Mastery bar */}
        <div className="w-full max-w-[320px]">
          <div className="flex justify-between text-xs font-display text-text-tertiary mb-1">
            <span>마스터 진행률</span>
            <span>{masteredCount}/{totalWords}</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(masteredCount / totalWords) * 100}%`,
                background: 'linear-gradient(90deg, #22C55E, #15803D)',
              }}
            />
          </div>
        </div>

        {/* Skipped words list */}
        {failedWords.length > 0 && (
          <div className="w-full max-w-[400px]">
            <p className="font-display text-sm font-semibold text-text-primary mb-2">
              스킵된 단어 ({failedWords.length}개)
            </p>
            <div className="rounded-xl bg-white border border-[#E5E4E1] divide-y divide-[#E5E4E1]">
              {failedWords.slice(0, 10).map((w) => (
                <div key={w.wordMasteryId} className="flex items-center justify-between px-4 py-2.5">
                  <span className="font-word text-sm font-semibold text-text-primary">{w.english}</span>
                  <span className="font-display text-sm text-text-tertiary">{w.korean}</span>
                </div>
              ))}
              {failedWords.length > 10 && (
                <div className="px-4 py-2 text-center">
                  <span className="font-display text-xs text-text-tertiary">
                    +{failedWords.length - 10}개 더
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        <button
          onClick={handleExit}
          className="flex items-center justify-center gap-2 h-12 px-8 rounded-2xl text-white font-display text-[15px] font-semibold"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: '0 4px 16px #4F46E540',
          }}
        >
          돌아가기
        </button>
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

  // Loading between question fetches
  if (isLoading) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
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

  // Question card
  const isSentence = currentQuestion.context_mode === 'sentence' && currentQuestion.sentence_blank;

  const renderQuestionCard = () => {
    if (isSentence) {
      if (isListen) {
        return (
          <ListenCard
            word={currentQuestion.word.english}
            stage={currentQuestion.stage}
            korean={currentQuestion.word.korean || undefined}
            sentenceKo={currentQuestion.word.example_ko}
            contextMode="sentence"
            sentenceBlank={currentQuestion.sentence_blank}
            sentenceEn={currentQuestion.word.example_en}
          />
        );
      }
      return (
        <SentenceBlankCard
          sentenceBlank={currentQuestion.sentence_blank!}
          korean={currentQuestion.word.korean || undefined}
          sentenceKo={currentQuestion.word.example_ko || undefined}
          sentenceEn={currentQuestion.word.example_en || undefined}
          stage={currentQuestion.stage}
        />
      );
    }

    switch (questionType) {
      case 'word_to_meaning':
        return <WordCard word={currentQuestion.word.english} />;
      case 'meaning_to_word':
      case 'meaning_and_type':
        return <MeaningCard korean={currentQuestion.word.korean || ''} />;
      case 'listen_and_type':
      case 'listen_to_meaning':
        return <ListenCard word={currentQuestion.word.english} stage={currentQuestion.stage} />;
      default:
        return <WordCard word={currentQuestion.word.english} />;
    }
  };

  const wordStage = currentWord?.stage ?? currentQuestion.stage;
  const stageColor = STAGE_COLORS[wordStage] || STAGE_COLORS[1];
  const stageConfig = STAGE_CONFIG[wordStage as keyof typeof STAGE_CONFIG];
  const progressDone = masteredCount + skippedCount;

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

        {/* Center: stage badge + progress */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-1.5 rounded-full px-3 py-1"
            style={{ background: `${stageColor}20`, border: `1.5px solid ${stageColor}` }}
          >
            <Zap className="w-3.5 h-3.5" style={{ color: stageColor }} />
            <span className="font-display text-xs font-bold" style={{ color: stageColor }}>
              Stage {wordStage}/5
            </span>
          </div>
          {stageConfig && (
            <span className="font-display text-xs text-text-tertiary hidden md:inline">
              {stageConfig.name}
            </span>
          )}
        </div>

        {/* Right: mastered count */}
        <div className="flex items-center gap-1.5">
          <span className="font-display text-sm font-bold text-green-600">{masteredCount}</span>
          <span className="font-display text-xs text-text-tertiary">/{totalWords}</span>
        </div>
      </div>

      {/* Progress Bar - based on mastered+skipped / total */}
      <GradientProgressBar current={progressDone} total={totalWords} />

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

        {/* Question card */}
        <div className="w-full md:w-[640px]">
          {renderQuestionCard()}
        </div>

        {/* Answer area */}
        <div className="w-full md:w-[640px]">
          {isTyping ? (
            <TypingInput
              value={typedAnswer}
              onChange={store.setTypedAnswer}
              onSubmit={handleTypingSubmit}
              disabled={!!answerResult}
            />
          ) : (
            <div className="flex flex-col gap-3 w-full">
              {currentQuestion.choices?.map((choice, i) => (
                <ChoiceButton
                  key={choice}
                  index={i}
                  text={choice}
                  state={getChoiceState(choice) as any}
                  onClick={() => handleChoiceClick(choice)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer: feedback banner */}
      <div className="min-h-[70px] px-5 md:px-8 flex items-center">
        {answerResult && (
          <div className="w-full md:w-[640px] md:mx-auto">
            <FeedbackBanner
              isCorrect={answerResult.is_correct}
              correctAnswer={answerResult.correct_answer}
            />
            {answerResult.almost_correct && (
              <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3.5 w-full mt-2">
                <span className="font-display text-sm font-semibold text-amber-700">
                  거의 맞았어요! 정답: &lsquo;{answerResult.correct_answer}&rsquo;
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default StageTestPage;
