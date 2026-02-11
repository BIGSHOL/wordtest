/**
 * Adaptive Mastery learning page.
 *
 * - 50 questions total, XP-based level progression
 * - Mixed question types based on word's internal mastery stage
 * - Real-time adaptive level display
 * - No visible stage transitions
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMasteryStore, useCurrentQuestion, useLessonXp, useLevelLabel } from '../../stores/masteryStore';
import { useTimer } from '../../hooks/useTimer';
import { isTypingQuestion, isListenQuestion } from '../../types/mastery';
import { preloadWordAudio, stopAllSounds as stopTtsSounds, randomizeTtsVoice } from '../../utils/tts';
import { playSound, stopSound } from '../../hooks/useSound';

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
import { Loader2, Trophy } from 'lucide-react';
import { getLevelRank } from '../../types/rank';

const FEEDBACK_DELAY_CORRECT = 800;
const FEEDBACK_DELAY_WRONG = 1800;

export function MasteryPage() {
  const navigate = useNavigate();
  const store = useMasteryStore();
  const {
    session, globalIndex, questionCount,
    selectedAnswer, typedAnswer, answerResult,
    combo, isLoading, isComplete, finalResult,
    currentBook, displayRank, correctCount, totalAnswered,
    xp, lastXpChange,
  } = store;

  const currentQuestion = useCurrentQuestion();
  const lessonXp = useLessonXp();
  const levelLabel = useLevelLabel();
  const questionType = currentQuestion?.question_type || 'word_to_meaning';
  const timerSeconds = currentQuestion?.timer_seconds ?? 5;
  const isTyping = isTypingQuestion(questionType);
  const isListen = isListenQuestion(questionType);
  const submittingRef = useRef(false);
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);
  const lastQuestionChangeAt = useRef(0);

  // Timer warning: 15s->10초부터, 10s->7초부터, 5s->바로 재생
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

      // Preload TTS for current question
      if (currentQuestion?.word.english) {
        preloadWordAudio(currentQuestion.word.english);
      }
    }
  }, [currentQuestion?.word_mastery_id]);

  // Timer warning sounds (skip during question transition)
  useEffect(() => {
    if (answerResult) return;
    if (timer.fraction > 0.95) return; // timer just reset, skip
    if (Date.now() - lastQuestionChangeAt.current < 600) return; // skip during transition
    if (timer.secondsLeft === timerWarnAt && timer.secondsLeft > 0 && !timerSoundPlayed.current) {
      playSound('timer', { startAt: timerAudioStart });
      timerSoundPlayed.current = true;
    }
    if (timer.secondsLeft === 2 && !twoSoundPlayed.current) {
      playSound('two', { volume: 0.5 });
      twoSoundPlayed.current = true;
    }
  }, [timer.secondsLeft, answerResult]);

  // Initialize TTS voice
  useEffect(() => {
    randomizeTtsVoice();
    // Block back button
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

  // Handle answer submission for choice questions
  const handleChoiceClick = useCallback(
    (choice: string) => {
      if (answerResult || submittingRef.current) return;
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

    const delay = answerResult.is_correct ? FEEDBACK_DELAY_CORRECT : FEEDBACK_DELAY_WRONG;
    const t = setTimeout(() => {
      submittingRef.current = false;
      stopSound('timer');
      stopSound('two');
      store.nextQuestion();
    }, delay);
    return () => clearTimeout(t);
  }, [answerResult]);

  // Handle exit
  const handleExit = useCallback(() => {
    stopTtsSounds();
    stopSound('timer');
    stopSound('two');
    store.reset();
    navigate('/student', { replace: true });
  }, [navigate]);

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="font-display text-sm text-text-secondary">학습 준비 중...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <p className="font-display text-sm text-text-secondary">세션을 찾을 수 없습니다.</p>
        <button onClick={handleExit} className="font-display text-sm text-accent-indigo font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  // Test complete screen
  if (isComplete) {
    const rank = getLevelRank(displayRank);
    const accuracy = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;

    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-6 px-6">
        <div className="flex items-center gap-3">
          <Trophy className="w-10 h-10 text-amber-500" />
          <h2 className="font-display text-2xl font-bold text-text-primary">학습 완료!</h2>
        </div>

        {/* Level result */}
        <div
          className="flex items-center gap-2 rounded-full px-5 py-2.5"
          style={{ background: `linear-gradient(90deg, ${rank.colors[0]}, ${rank.colors[1]})` }}
        >
          <span className="font-display text-lg font-bold text-white">
            {rank.name} (Level {currentBook})
          </span>
        </div>

        {/* Stats */}
        <div className="flex gap-6 text-center">
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{accuracy}%</p>
            <p className="font-display text-xs text-text-tertiary">정답률</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{correctCount}/{totalAnswered}</p>
            <p className="font-display text-xs text-text-tertiary">정답</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-accent-indigo">{store.bestCombo}</p>
            <p className="font-display text-xs text-text-tertiary">최대 콤보</p>
          </div>
        </div>

        {finalResult && finalResult.level_changed && (
          <p className="font-display text-sm text-text-secondary">
            레벨 {finalResult.previous_level} → {finalResult.current_level}
            {finalResult.current_level > finalResult.previous_level ? ' 레벨 업!' : ' 레벨 다운'}
          </p>
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
      </div>
    );
  }

  // Loading between pool fetches
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

  // Determine choice button states
  const getChoiceState = (choice: string) => {
    if (!answerResult) {
      return choice === selectedAnswer ? 'selected' : 'default';
    }
    if (choice === answerResult.correct_answer) return 'correct';
    if (choice === selectedAnswer) return 'wrong';
    return 'disabled';
  };

  // Determine which card to show based on question_type
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

    // Word-based question
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

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header - adaptive level display */}
      <MasteryHeader
        level={displayRank}
        currentIndex={globalIndex}
        totalInBatch={questionCount}
        combo={combo}
        xp={xp}
        lessonXp={lessonXp}
        levelLabel={levelLabel}
        lastXpChange={lastXpChange}
        onExit={handleExit}
      />

      {/* Progress Bar - global 1-50 */}
      <GradientProgressBar current={globalIndex + 1} total={questionCount} />

      {/* Content Area */}
      <div className="flex-1 flex flex-col justify-center items-center gap-6 px-5 py-6 md:px-8 md:gap-7">
        {/* Timer - hide after answer */}
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
      <div className="h-[70px] px-5 md:px-8 flex items-center">
        {answerResult && (
          <div className="w-full md:w-[640px] md:mx-auto">
            <FeedbackBanner
              isCorrect={answerResult.is_correct}
              correctAnswer={answerResult.correct_answer}
              stageStreak={answerResult.stage_streak}
              requiredStreak={answerResult.required_streak}
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

export default MasteryPage;
