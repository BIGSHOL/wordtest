/**
 * Unified Test Page - handles both Level-Up (adaptive) and Legacy (fixed) engines.
 *
 * Level-Up: XP-based adaptive difficulty within teacher's book range.
 * Legacy: Fixed difficulty, all questions served in easy->hard order.
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useUnifiedTestStore,
  useCurrentQuestion,
  useLevelupProgress,
  useLegacyProgress,
} from '../../stores/unifiedTestStore';
import { useTimer } from '../../hooks/useTimer';
import { isTypingQuestion, isListenQuestion } from '../../types/mastery';
import { preloadWordAudio, speakWord, stopAllSounds as stopTtsSounds, randomizeTtsVoice } from '../../utils/tts';
import { playSound, stopSound, unlockAudio } from '../../hooks/useSound';

// Components
import { MasteryHeader } from '../../components/mastery/MasteryHeader';
import { GradientProgressBar } from '../../components/test/GradientProgressBar';
import { TimerBar } from '../../components/test/TimerBar';
import { FeedbackBanner } from '../../components/test/FeedbackBanner';
import { WordCard } from '../../components/test/WordCard';
import { MeaningCard } from '../../components/test/MeaningCard';
import { ChoiceButton } from '../../components/test/ChoiceButton';
import { ListenCard } from '../../components/mastery/ListenCard';
import { TypingInput } from '../../components/mastery/TypingInput';
import { SentenceBlankCard } from '../../components/mastery/SentenceBlankCard';
import { EmojiCard } from '../../components/test/EmojiCard';
import { Loader2, Trophy, LogIn, ArrowLeft } from 'lucide-react';
import { getLevelRank } from '../../types/rank';

const MIN_FEEDBACK_CORRECT = 800;
const MIN_FEEDBACK_WRONG = 1800;
const PRONOUNCE_DELAY = 400;

export function UnifiedTestPage() {
  const navigate = useNavigate();
  const store = useUnifiedTestStore();
  const {
    engineType, sessionId, questionCount,
    selectedAnswer, typedAnswer, answerResult, feedbackQuestion,
    isLoading, isComplete, finalResult,
    totalAnswered,
    error,
  } = store;

  const currentQuestion = useCurrentQuestion();
  const levelupProgress = useLevelupProgress();
  const legacyProgress = useLegacyProgress();

  const questionType = currentQuestion?.question_type || 'en_to_ko';
  const timerSeconds = currentQuestion?.timer_seconds ?? 10;
  const isTyping = isTypingQuestion(questionType);
  const isListen = isListenQuestion(questionType);
  const submittingRef = useRef(false);
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);
  const lastQuestionChangeAt = useRef(0);

  // Timer warning thresholds
  const timerWarnAt = timerSeconds <= 5 ? timerSeconds : timerSeconds <= 10 ? 7 : 10;
  const timerAudioStart = Math.max(0, 10 - timerWarnAt);

  // Timer
  const handleTimeout = useCallback(() => {
    if (!answerResult && currentQuestion && !submittingRef.current) {
      submittingRef.current = true;
      store.submitAnswer(timerSeconds, true).catch(() => {
        submittingRef.current = false;
      });
    }
  }, [answerResult, currentQuestion, timerSeconds]);

  const timer = useTimer(timerSeconds, handleTimeout);

  // Track question changes to reset timer
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

  // Initialize TTS voice + block back button
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

  // Handle choice selection
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

    const wordEnglish = feedbackQuestion?.word?.english;
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

    return () => { cancelled = true; };
  }, [answerResult]);

  // Handle exit
  const handleExit = useCallback(() => {
    stopTtsSounds();
    stopSound('timer');
    stopSound('two');
    store.reset();
    navigate('/student', { replace: true });
  }, [navigate]);

  // ── Loading state ──────────────────────────────────────────────────────
  if (isLoading && !sessionId) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="font-display text-sm text-text-secondary">
          {engineType === 'levelup' ? '레벨업 테스트 준비 중...' : '테스트 준비 중...'}
        </p>
      </div>
    );
  }

  if (!sessionId && !isComplete) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <p className="font-display text-sm text-text-secondary">세션을 찾을 수 없습니다.</p>
        {error && <p className="font-display text-xs text-red-500">{error}</p>}
        <button onClick={handleExit} className="font-display text-sm text-accent-indigo font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  // ── Completion screen ──────────────────────────────────────────────────
  if (isComplete && finalResult) {
    const accuracy = Math.round(finalResult.accuracy * 100);
    const isLevelup = engineType === 'levelup';

    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-amber-500" />
          <h2 className="font-display text-2xl font-bold text-text-primary">테스트 완료!</h2>
        </div>

        {/* Level-Up: rank badge */}
        {isLevelup && finalResult.finalLevel && (
          <div
            className="flex items-center gap-2 rounded-full px-5 py-2.5"
            style={{
              background: `linear-gradient(90deg, ${getLevelRank(finalResult.finalLevel).colors[0]}, ${getLevelRank(finalResult.finalLevel).colors[1]})`,
            }}
          >
            <span className="font-display text-lg font-bold text-white">
              {getLevelRank(finalResult.finalLevel).name} (Level {finalResult.finalLevel})
            </span>
          </div>
        )}

        {/* Stats */}
        <div className="flex gap-6 text-center">
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{accuracy}%</p>
            <p className="font-display text-xs text-text-tertiary">정답률</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">
              {finalResult.correctCount}/{finalResult.totalAnswered}
            </p>
            <p className="font-display text-xs text-text-tertiary">정답</p>
          </div>
          {isLevelup && finalResult.bestCombo != null && (
            <div>
              <p className="font-display text-2xl font-bold text-accent-indigo">{finalResult.bestCombo}</p>
              <p className="font-display text-xs text-text-tertiary">최대 콤보</p>
            </div>
          )}
        </div>

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

  // ── Loading between fetches ────────────────────────────────────────────
  if (isLoading || !currentQuestion) {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  // ── Choice button states ───────────────────────────────────────────────
  const getChoiceState = (choice: string) => {
    if (!answerResult) {
      return choice === selectedAnswer ? 'selected' : 'default';
    }
    if (choice === answerResult.correct_answer) return 'correct';
    if (choice === selectedAnswer) return 'wrong';
    return 'disabled';
  };

  // ── Question card rendering ────────────────────────────────────────────
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
      case 'emoji_to_word':
      case 'emoji':
        return <EmojiCard emoji={currentQuestion.emoji || ''} />;
      case 'word_to_meaning':
      case 'en_to_ko':
        return <WordCard word={currentQuestion.word.english} />;
      case 'meaning_to_word':
      case 'meaning_and_type':
      case 'ko_to_en':
      case 'ko_type':
        return <MeaningCard korean={currentQuestion.word.korean || ''} />;
      case 'listen_and_type':
      case 'listen_to_meaning':
      case 'listen_en':
      case 'listen_ko':
      case 'listen_type':
        return <ListenCard word={currentQuestion.word.english} stage={currentQuestion.stage} />;
      default:
        return <WordCard word={currentQuestion.word.english} />;
    }
  };

  // ── Main render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header */}
      {engineType === 'levelup' ? (
        <MasteryHeader
          level={levelupProgress.currentBook}
          currentIndex={levelupProgress.totalAnswered}
          totalInBatch={levelupProgress.questionCount}
          combo={levelupProgress.combo}
          xp={levelupProgress.xp}
          lessonXp={levelupProgress.lessonXp}
          levelLabel={String(levelupProgress.currentBook)}
          lastXpChange={levelupProgress.lastXpChange?.total ?? 0}
          lastXpBreakdown={levelupProgress.lastXpChange}
          onExit={handleExit}
        />
      ) : (
        <LegacyHeader
          totalAnswered={legacyProgress.totalAnswered}
          totalQuestions={legacyProgress.totalQuestions}
          combo={legacyProgress.combo}
          onExit={handleExit}
        />
      )}

      {/* Progress Bar */}
      <GradientProgressBar
        current={totalAnswered + 1}
        total={questionCount}
      />

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
              isListenMode={isListen}
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

// ── Legacy Header (simple progress display) ──────────────────────────────────

function LegacyHeader({
  totalAnswered,
  totalQuestions,
  combo,
  onExit,
}: {
  totalAnswered: number;
  totalQuestions: number;
  combo: number;
  onExit: () => void;
}) {
  return (
    <div className="flex items-center justify-between h-14 px-5 md:h-[60px] md:px-8 lg:h-16 lg:px-12 w-full">
      {/* Left: back button */}
      <button
        onClick={onExit}
        className="w-10 h-10 rounded-full flex items-center justify-center"
      >
        <ArrowLeft className="w-[22px] h-[22px] text-text-primary" />
      </button>

      {/* Center: progress + combo */}
      <div className="flex items-center gap-3">
        <span className="font-display text-[15px] font-bold text-text-primary">
          {totalAnswered + 1} / {totalQuestions}
        </span>
        {combo >= 2 && (
          <span className="font-display text-xs font-bold text-amber-500">
            {combo} combo
          </span>
        )}
      </div>

      {/* Right: spacer for alignment */}
      <div className="w-10 h-10" />
    </div>
  );
}

export default UnifiedTestPage;
