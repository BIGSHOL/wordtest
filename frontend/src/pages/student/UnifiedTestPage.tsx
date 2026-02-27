/**
 * Unified Test Page - dual mode support.
 *
 * per_question mode: per-question timer, immediate feedback, auto-advance, sounds, TTS
 * total (exam) mode: briefing, free navigation, batch submit, no feedback
 *
 * Phase flow: idle -> briefing -> testing -> (submitting) -> complete
 */
import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useUnifiedTestStore,
  useCurrentQuestion,
  useLevelupProgress,
} from '../../stores/unifiedTestStore';
import { useTimer } from '../../hooks/useTimer';
import { playSound, stopSound, unlockAudio } from '../../hooks/useSound';
import { speakWord } from '../../utils/tts';
import { isTypingQuestion, isListenQuestion } from '../../types/mastery';

// Components
import { TotalTimerDisplay } from '../../components/test/TotalTimerDisplay';
import { TimerBar } from '../../components/test/TimerBar';
import { WordCard } from '../../components/test/WordCard';
import { MeaningCard } from '../../components/test/MeaningCard';
import { ChoiceButton } from '../../components/test/ChoiceButton';
import { SentenceBlankCard } from '../../components/mastery/SentenceBlankCard';
import { TypingInput } from '../../components/mastery/TypingInput';
import { EmojiCard } from '../../components/test/EmojiCard';
import { ListeningCard } from '../../components/test/ListeningCard';
import { AntonymCard } from '../../components/test/AntonymCard';
import { FeedbackBanner } from '../../components/test/FeedbackBanner';
import { MasteryHeader } from '../../components/mastery/MasteryHeader';
import { ExamBriefing } from '../../components/test/ExamBriefing';
import { QuestionNavigator } from '../../components/test/QuestionNavigator';
import { SubmitConfirmDialog } from '../../components/test/SubmitConfirmDialog';
import { Loader2, Trophy, LogIn, ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { getLevelRank } from '../../types/rank';

export function UnifiedTestPage() {
  const navigate = useNavigate();
  const store = useUnifiedTestStore();
  const {
    engineType, timeMode, sessionId, phase,
    flatQuestions, currentQuestionIndex,
    localAnswers, localTypedAnswers,
    briefingInfo, studentName,
    questionCount, perQuestionTime, totalTimeSeconds,
    isLoading, isComplete, finalResult,
    selectedAnswer, typedAnswer, answerResult,
    error,
  } = store;

  const currentQuestion = useCurrentQuestion();
  const levelupProgress = useLevelupProgress();

  // ── Exam mode state ────────────────────────────────────────────────
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // ── Per-question mode state ────────────────────────────────────────
  const questionStartTime = useRef(Date.now());
  const prevPhaseRef = useRef<typeof phase>('idle');

  // ══════════════════════════════════════════════════════════════════════
  // ── Timers ─────────────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // Total timer (exam mode)
  const handleTotalTimeout = useCallback(() => {
    const s = useUnifiedTestStore.getState();
    if (s.phase === 'testing' && s.timeMode === 'total') {
      store.submitAllAnswers();
    }
  }, []);

  const totalTimer = useTimer(totalTimeSeconds, handleTotalTimeout);

  // Per-question timer
  const currentTimerSeconds = (currentQuestion?.timer_seconds || perQuestionTime) || 10;

  const handlePerQuestionTimeout = useCallback(() => {
    const s = useUnifiedTestStore.getState();
    if (s.phase === 'testing' && s.timeMode === 'per_question' && !s.answerResult) {
      store.submitAnswer(s.perQuestionTime, true);
    }
  }, []);

  const perQTimer = useTimer(currentTimerSeconds, handlePerQuestionTimeout);

  // ── Timer control ──────────────────────────────────────────────────

  // Total timer: start on testing phase, pause otherwise
  useEffect(() => {
    if (timeMode !== 'total') {
      totalTimer.pause();
      return;
    }
    if (prevPhaseRef.current !== 'testing' && phase === 'testing') {
      totalTimer.reset();
    }
    if (phase === 'complete' || phase === 'submitting') {
      totalTimer.pause();
    }
    prevPhaseRef.current = phase;
  }, [phase, timeMode]);

  // Per-question timer: reset on question change, pause during feedback
  const hasAnswer = !!answerResult;
  useEffect(() => {
    if (timeMode !== 'per_question' || phase !== 'testing') {
      perQTimer.pause();
      return;
    }
    if (hasAnswer) {
      perQTimer.pause();
      return;
    }
    // Active question: reset timer and start tracking time
    perQTimer.reset();
    questionStartTime.current = Date.now();
  }, [currentQuestionIndex, phase, timeMode, hasAnswer]);

  // ── Per-question: timer warning sound ──────────────────────────────
  useEffect(() => {
    if (timeMode !== 'per_question' || phase !== 'testing' || hasAnswer) return;
    if (perQTimer.secondsLeft === 5) {
      playSound('timer', { volume: 0.5 });
    }
  }, [perQTimer.secondsLeft, timeMode, phase, hasAnswer]);

  // ── Per-question: feedback sound + auto-advance ────────────────────
  useEffect(() => {
    if (!answerResult || timeMode !== 'per_question') return;

    stopSound('timer');

    // Feedback sounds
    if (answerResult.is_correct) {
      playSound('correct');
    } else {
      playSound('wrong');
    }

    // Auto-advance after delay
    const timer = setTimeout(() => {
      store.nextQuestion();
    }, 1500);
    return () => clearTimeout(timer);
  }, [answerResult, timeMode]);

  // ── TTS auto-play for listen questions (both modes) ────────────────
  useEffect(() => {
    if (phase !== 'testing') return;
    if (!currentQuestion) return;
    const qt = currentQuestion.question_type || '';
    if (!isListenQuestion(qt)) return;

    // Per-question mode: skip if already answered
    if (timeMode === 'per_question' && hasAnswer) return;
    // Exam mode: skip if this question already has a local answer
    if (timeMode === 'total' && localAnswers[currentQuestionIndex] != null) return;

    let cancelled = false;
    const repeatPlay = async () => {
      while (!cancelled) {
        await speakWord(currentQuestion.word.english);
        // Wait 2 seconds before replaying
        await new Promise(r => setTimeout(r, 2000));
      }
    };
    repeatPlay();
    return () => { cancelled = true; };
  }, [currentQuestionIndex, phase, timeMode, hasAnswer]);

  // ── Keyboard shortcuts ─────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'testing') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const q = flatQuestions[currentQuestionIndex];
      if (!q) return;

      // Arrow keys: exam mode only
      if (timeMode === 'total') {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          store.goPrev();
          return;
        }
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          store.goNext();
          return;
        }
      }

      // Number keys for choice selection (both modes)
      if (q.choices) {
        const num = parseInt(e.key, 10);
        if (num >= 1 && num <= q.choices.length) {
          e.preventDefault();
          if (timeMode === 'total') {
            store.setLocalAnswer(currentQuestionIndex, q.choices[num - 1]);
          } else if (!answerResult) {
            // Per-question: select and auto-submit
            store.selectAnswer(q.choices[num - 1]);
            const timeTaken = (Date.now() - questionStartTime.current) / 1000;
            store.submitAnswer(timeTaken);
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, timeMode, currentQuestionIndex, flatQuestions, answerResult]);

  // ── Handlers ───────────────────────────────────────────────────────

  const handleExit = useCallback(() => {
    if (phase === 'testing') {
      if (!confirm('시험을 종료하시겠습니까? 답변이 저장되지 않습니다.')) return;
    }
    stopSound('timer');
    store.reset();
    navigate('/student', { replace: true });
  }, [phase, navigate]);

  const handleStartExam = useCallback(() => {
    unlockAudio();
    store.startExam();
  }, []);

  // Per-question: choice click -> auto-submit
  const handlePerQuestionChoice = useCallback((choice: string) => {
    if (answerResult) return;
    store.selectAnswer(choice);
    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    store.submitAnswer(timeTaken);
  }, [answerResult]);

  // Per-question: typing submit
  const handleTypingSubmit = useCallback(() => {
    if (answerResult) return;
    const timeTaken = (Date.now() - questionStartTime.current) / 1000;
    store.submitAnswer(timeTaken);
  }, [answerResult]);

  // Exam mode: submit confirmation
  const handleSubmitConfirm = useCallback(() => {
    setShowSubmitDialog(false);
    store.submitAllAnswers();
  }, []);

  // Exam mode: answered indexes for navigator
  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    flatQuestions.forEach((q, i) => {
      if (q.choices) {
        if (localAnswers[i]) set.add(i);
      } else {
        if (localTypedAnswers[i]?.trim()) set.add(i);
      }
    });
    return set;
  }, [flatQuestions, localAnswers, localTypedAnswers]);

  // ══════════════════════════════════════════════════════════════════════
  // ── Shared Phase Rendering ─────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  // Loading
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

  // No session
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

  // Briefing (both modes)
  if (phase === 'briefing') {
    return (
      <ExamBriefing
        studentName={studentName}
        studentSchool={briefingInfo?.studentSchool ?? ''}
        studentGrade={briefingInfo?.studentGrade ?? ''}
        bookName={briefingInfo?.bookName ?? null}
        bookNameEnd={briefingInfo?.bookNameEnd ?? null}
        lessonStart={briefingInfo?.lessonStart ?? null}
        lessonEnd={briefingInfo?.lessonEnd ?? null}
        questionCount={flatQuestions.length || questionCount}
        totalTimeSeconds={totalTimeSeconds}
        timeMode={timeMode}
        perQuestionTime={perQuestionTime}
        questionTypes={briefingInfo?.questionTypes ?? undefined}
        configName={briefingInfo?.configName ?? ''}
        onStart={handleStartExam}
      />
    );
  }

  // Submitting (exam mode batch submit)
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="font-display text-sm text-text-secondary">채점 중...</p>
      </div>
    );
  }

  // Complete (both modes)
  if ((phase === 'complete' || isComplete) && finalResult) {
    const accuracy = Math.round(finalResult.accuracy * 100);
    const isLevelup = engineType === 'levelup';

    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-amber-500" />
          <h2 className="font-display text-2xl font-bold text-text-primary">테스트 완료!</h2>
        </div>

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

  // Idle phase: blank screen while transitioning to briefing (prevents flash)
  if (phase === 'idle') {
    return <div className="min-h-screen bg-bg-cream" />;
  }

  // Loading between phases
  if (isLoading || !currentQuestion || phase !== 'testing') {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
      </div>
    );
  }

  // ══════════════════════════════════════════════════════════════════════
  // ── Testing Phase ──────────────────────────────────────────────────
  // ══════════════════════════════════════════════════════════════════════

  const questionType = currentQuestion.question_type || 'en_to_ko';
  const isTyping = isTypingQuestion(questionType);
  const isListen = isListenQuestion(questionType);
  const isSentence = currentQuestion.context_mode === 'sentence' && currentQuestion.sentence_blank;
  const totalQ = flatQuestions.length || questionCount;

  // Question card renderer (shared between modes)
  // Cards only show the question prompt; TypingInput is rendered separately below.
  // Exception: SentenceBlankCard renders inline letter-boxes when typing props are provided.
  const renderQuestionCard = (sentenceTypingProps?: {
    value: string;
    onChange: (v: string) => void;
    onSubmit: () => void;
    disabled?: boolean;
    hint?: string | null;
  }) => {
    // Listen questions: always use ListeningCard (hides word, shows headphones)
    if (isListen && !isSentence) {
      return <ListeningCard english={currentQuestion.word.english} />;
    }

    if (isSentence) {
      // Sentence typing: pass typing props for inline letter-boxes inside the card
      const tp = isTyping && sentenceTypingProps ? {
        typingValue: sentenceTypingProps.value,
        onTypingChange: sentenceTypingProps.onChange,
        onTypingSubmit: sentenceTypingProps.onSubmit,
        typingDisabled: sentenceTypingProps.disabled,
        typingHint: sentenceTypingProps.hint,
        isListenMode: isListen,
      } : {};
      return (
        <SentenceBlankCard
          sentenceBlank={currentQuestion.sentence_blank!}
          korean={currentQuestion.word.korean || undefined}
          sentenceKo={currentQuestion.word.example_ko || undefined}
          sentenceEn={currentQuestion.word.example_en || undefined}
          stage={currentQuestion.stage}
          {...tp}
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
        return <ListeningCard english={currentQuestion.word.english} />;
      case 'antonym_type':
      case 'antonym_choice':
      case 'antonym_and_type':
      case 'antonym_and_choice':
        return <AntonymCard english={currentQuestion.word.english} korean={currentQuestion.word.korean ?? undefined} />;
      default:
        return <WordCard word={currentQuestion.word.english} />;
    }
  };

  // ── EXAM MODE (total time) ────────────────────────────────────────
  if (timeMode === 'total') {
    const selectedChoice = localAnswers[currentQuestionIndex] ?? null;
    const typedValue = localTypedAnswers[currentQuestionIndex] ?? '';

    return (
      <div className="min-h-screen bg-bg-cream flex flex-col">
        {/* Header */}
        <div
          className="flex items-center justify-between h-14 px-4 shrink-0"
          style={{ borderBottom: '1px solid #E8E8E6', background: '#FFFFFF' }}
        >
          <button
            onClick={handleExit}
            className="flex items-center gap-1.5 h-10 px-3 rounded-xl transition-colors"
            style={{ color: '#6D6C6A' }}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="font-display text-sm font-medium">나가기</span>
          </button>

          {totalTimeSeconds > 0 && (
            <TotalTimerDisplay
              secondsLeft={totalTimer.secondsLeft}
              totalSeconds={totalTimeSeconds}
            />
          )}

          <button
            onClick={() => setShowSubmitDialog(true)}
            className="h-10 px-4 rounded-xl font-display text-sm font-bold text-white transition-opacity active:opacity-80"
            style={{
              background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
              boxShadow: '0 2px 8px #4F46E530',
            }}
          >
            제출하기
          </button>
        </div>

        {/* Question Navigator */}
        <div style={{ borderBottom: '1px solid #E8E8E6', background: '#FFFFFF' }}>
          <QuestionNavigator
            totalQuestions={totalQ}
            currentIndex={currentQuestionIndex}
            answeredIndexes={answeredIndexes}
            onNavigate={store.goToQuestion}
          />
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col justify-center items-center gap-5 px-5 py-6 md:px-8">
          <div className="w-full md:w-[640px]">
            <p className="font-display text-sm font-semibold" style={{ color: '#9C9B99' }}>
              문제 {currentQuestionIndex + 1} / {totalQ}
            </p>
          </div>

          <div className="w-full md:w-[640px]">
            {renderQuestionCard(isTyping && isSentence ? {
              value: typedValue,
              onChange: (text) => store.setLocalTypedAnswer(currentQuestionIndex, text),
              onSubmit: store.goNext,
              disabled: false,
              hint: currentQuestion.hint,
            } : undefined)}
          </div>

          <div className="w-full md:w-[640px]">
            {isTyping && !isSentence ? (
              <TypingInput
                value={typedValue}
                onChange={(text) => store.setLocalTypedAnswer(currentQuestionIndex, text)}
                onSubmit={store.goNext}
                disabled={false}
                isListenMode={isListen}
                hint={currentQuestion.hint}
              />
            ) : !isTyping ? (
              <div className="flex flex-col gap-3 w-full">
                {currentQuestion.choices?.map((choice, i) => (
                  <ChoiceButton
                    key={choice}
                    index={i}
                    text={choice}
                    state={selectedChoice === choice ? 'selected' : 'default'}
                    onClick={() => store.setLocalAnswer(currentQuestionIndex, choice)}
                  />
                ))}
              </div>
            ) : null}
          </div>

          {/* Navigation buttons */}
          <div className="w-full md:w-[640px] flex items-center justify-between pt-2">
            <button
              onClick={store.goPrev}
              disabled={currentQuestionIndex === 0}
              className="flex items-center gap-1 h-10 px-4 rounded-xl font-display text-sm font-semibold transition-all"
              style={{
                background: currentQuestionIndex === 0 ? '#F0EFED' : '#EDECEA',
                color: currentQuestionIndex === 0 ? '#C5C4C2' : '#3D3D3C',
              }}
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </button>

            <button
              onClick={store.goNext}
              disabled={currentQuestionIndex === totalQ - 1}
              className="flex items-center gap-1 h-10 px-4 rounded-xl font-display text-sm font-semibold transition-all"
              style={{
                background: currentQuestionIndex === totalQ - 1 ? '#F0EFED' : '#EEF2FF',
                color: currentQuestionIndex === totalQ - 1 ? '#C5C4C2' : '#4F46E5',
              }}
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Submit confirmation dialog */}
        <SubmitConfirmDialog
          isOpen={showSubmitDialog}
          totalQuestions={totalQ}
          answeredCount={answeredIndexes.size}
          onConfirm={handleSubmitConfirm}
          onCancel={() => setShowSubmitDialog(false)}
        />

        {/* Error toast */}
        {error && (
          <div
            className="fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl font-display text-sm text-white"
            style={{ background: '#EF4444', zIndex: 100 }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  // ── PER-QUESTION MODE ──────────────────────────────────────────────
  const isLevelup = engineType === 'levelup';

  const getPerQChoiceState = (choice: string): 'default' | 'selected' | 'correct' | 'wrong' | 'disabled' => {
    if (!answerResult) {
      return choice === selectedAnswer ? 'selected' : 'default';
    }
    // Feedback showing
    if (choice === answerResult.correct_answer) return 'correct';
    if (choice === selectedAnswer && !answerResult.is_correct) return 'wrong';
    return 'disabled';
  };

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header */}
      {isLevelup ? (
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
        <div
          className="flex items-center justify-between h-14 px-5"
          style={{ borderBottom: '1px solid #E8E8E6' }}
        >
          <button
            onClick={handleExit}
            className="w-10 h-10 rounded-full flex items-center justify-center"
          >
            <ArrowLeft className="w-[22px] h-[22px] text-text-primary" />
          </button>
          <span className="font-display text-[15px] font-semibold text-text-secondary">
            {store.totalAnswered + 1} / {totalQ}
          </span>
        </div>
      )}

      {/* Per-question timer */}
      <div className="px-5 pt-3 md:px-8">
        <TimerBar
          secondsLeft={perQTimer.secondsLeft}
          fraction={perQTimer.fraction}
          urgency={perQTimer.urgency}
        />
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-center items-center gap-5 px-5 py-6 md:px-8">
        <div className="w-full md:w-[640px]">
          {renderQuestionCard(isTyping && isSentence ? {
            value: typedAnswer,
            onChange: (text) => store.setTypedAnswer(text),
            onSubmit: handleTypingSubmit,
            disabled: !!answerResult,
            hint: currentQuestion.hint,
          } : undefined)}
        </div>

        <div className="w-full md:w-[640px]">
          {isTyping && !isSentence ? (
            <TypingInput
              value={typedAnswer}
              onChange={(text) => store.setTypedAnswer(text)}
              onSubmit={handleTypingSubmit}
              disabled={!!answerResult}
              isListenMode={isListen}
              hint={currentQuestion.hint}
            />
          ) : !isTyping ? (
            <div className="flex flex-col gap-3 w-full">
              {currentQuestion.choices?.map((choice, i) => (
                <ChoiceButton
                  key={choice}
                  index={i}
                  text={choice}
                  state={getPerQChoiceState(choice)}
                  onClick={() => handlePerQuestionChoice(choice)}
                />
              ))}
            </div>
          ) : null}
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
      </div>

      {/* Error toast */}
      {error && (
        <div
          className="fixed bottom-20 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl font-display text-sm text-white"
          style={{ background: '#EF4444', zIndex: 100 }}
        >
          {error}
        </div>
      )}
    </div>
  );
}

export default UnifiedTestPage;
