/**
 * Mastery learning page - 5-stage word mastery system.
 *
 * Stage 1: English word → pick Korean meaning (5s) + sentence review
 * Stage 2: Korean meaning → pick English word (5s)
 * Stage 3: Listen pronunciation → type English word (15s)
 * Stage 4: Listen pronunciation → pick Korean meaning (10s)
 * Stage 5: Korean meaning → type English word (15s)
 */
import { useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMasteryStore } from '../../stores/masteryStore';
import { useTimer } from '../../hooks/useTimer';
import { STAGE_CONFIG } from '../../types/mastery';
import type { StageNumber } from '../../types/mastery';
import { preloadWordAudio, stopAllSounds, randomizeTtsVoice } from '../../utils/tts';

// Components
import { MasteryHeader } from '../../components/mastery/MasteryHeader';
import { GrowthProgressBar } from '../../components/mastery/GrowthProgressBar';
import { TimerBar } from '../../components/test/TimerBar';
import { FeedbackBanner } from '../../components/test/FeedbackBanner';
import { WordCard } from '../../components/test/WordCard';
import { MeaningCard } from '../../components/test/MeaningCard';
import { ChoiceButton } from '../../components/test/ChoiceButton';
import { ListenCard } from '../../components/mastery/ListenCard';
import { TypingInput } from '../../components/mastery/TypingInput';
import { SentenceReview } from '../../components/mastery/SentenceReview';
import { SentenceBlankCard } from '../../components/mastery/SentenceBlankCard';
import { StageTransition } from '../../components/mastery/StageTransition';
import { Loader2 } from 'lucide-react';

const FEEDBACK_DELAY = 800;
const SENTENCE_REVIEW_DELAY = 3000;

export function MasteryPage() {
  const navigate = useNavigate();
  const store = useMasteryStore();
  const {
    session, stageSummary, totalWords, currentStage, questions,
    currentIndex, selectedAnswer, typedAnswer, answerResult,
    showSentenceReview, combo, isLoading, isTransitioning,
    batchComplete,
  } = store;

  const currentQuestion = questions[currentIndex];
  const stageConfig = STAGE_CONFIG[currentStage as StageNumber];
  const timerSeconds = stageConfig?.timer ?? 5;
  const isTypingStage = currentStage === 3 || currentStage === 5;

  // Timer
  const handleTimeout = useCallback(() => {
    if (!answerResult && currentQuestion) {
      // Auto-submit on timeout
      store.submitAnswer(timerSeconds).catch(() => {});
    }
  }, [answerResult, currentQuestion, timerSeconds]);

  const timer = useTimer(timerSeconds, handleTimeout);

  // Track question changes to reset timer
  const prevQuestionRef = useRef<string | null>(null);
  useEffect(() => {
    const qid = currentQuestion?.word_mastery_id;
    if (qid && qid !== prevQuestionRef.current) {
      prevQuestionRef.current = qid;
      timer.reset();
      stopAllSounds();

      // Preload TTS for current + next questions
      if (currentQuestion?.word.english) {
        preloadWordAudio(currentQuestion.word.english);
      }
      const next = questions[currentIndex + 1];
      if (next?.word.english) {
        preloadWordAudio(next.word.english);
      }
    }
  }, [currentQuestion?.word_mastery_id]);

  // Initialize TTS voice
  useEffect(() => {
    randomizeTtsVoice();
    // Block back button
    window.history.pushState(null, '', window.location.href);
    const onPopState = () => window.history.pushState(null, '', window.location.href);
    window.addEventListener('popstate', onPopState);
    return () => {
      window.removeEventListener('popstate', onPopState);
      stopAllSounds();
    };
  }, []);

  // Handle answer submission for choice stages
  const handleChoiceClick = useCallback(
    (choice: string) => {
      if (answerResult) return;
      store.selectAnswer(choice);
      timer.pause();

      const elapsed = timerSeconds - timer.secondsLeft;
      store.submitAnswer(elapsed).then(() => {
        // Auto-advance after feedback delay
        setTimeout(() => {
          if (useMasteryStore.getState().showSentenceReview) {
            // Wait for sentence review dismissal
            return;
          }
          store.nextQuestion();
        }, FEEDBACK_DELAY);
      }).catch(() => {});
    },
    [answerResult, timerSeconds, timer.secondsLeft],
  );

  // Handle typing submission
  const handleTypingSubmit = useCallback(() => {
    if (answerResult || !typedAnswer.trim()) return;
    timer.pause();

    const elapsed = timerSeconds - timer.secondsLeft;
    store.submitAnswer(elapsed).then(() => {
      setTimeout(() => {
        store.nextQuestion();
      }, FEEDBACK_DELAY);
    }).catch(() => {});
  }, [answerResult, typedAnswer, timerSeconds, timer.secondsLeft]);

  // Sentence review auto-dismiss
  useEffect(() => {
    if (showSentenceReview) {
      const t = setTimeout(() => {
        store.dismissSentenceReview();
        store.nextQuestion();
      }, SENTENCE_REVIEW_DELAY);
      return () => clearTimeout(t);
    }
  }, [showSentenceReview]);

  // Handle batch completion → stage transition or next batch
  useEffect(() => {
    if (batchComplete && !isTransitioning) {
      store.setTransitioning(true);
    }
  }, [batchComplete, isTransitioning]);

  // Handle exit
  const handleExit = useCallback(() => {
    store.reset();
    navigate('/student', { replace: true });
  }, [navigate]);

  // Handle stage transition continue
  const handleTransitionContinue = useCallback(() => {
    // Find next stage with words
    if (!stageSummary) return;

    const stageKeys = ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'] as const;
    let nextStage: number | null = null;

    for (let s = 1; s <= 5; s++) {
      const key = stageKeys[s - 1];
      if ((stageSummary[key] ?? 0) > 0) {
        nextStage = s;
        break;
      }
    }

    if (nextStage) {
      store.loadBatch(nextStage);
    } else {
      // All done - navigate to result
      navigate('/student', { replace: true });
    }
  }, [stageSummary, navigate]);

  // Loading state
  if (isLoading && !session) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-8 h-8 text-accent-indigo animate-spin" />
        <p className="font-display text-sm text-text-secondary">학습 준비 중...</p>
      </div>
    );
  }

  if (!session || !stageSummary) {
    return (
      <div className="min-h-screen bg-bg-cream flex flex-col items-center justify-center gap-4">
        <p className="font-display text-sm text-text-secondary">세션을 찾을 수 없습니다.</p>
        <button onClick={handleExit} className="font-display text-sm text-accent-indigo font-semibold">
          돌아가기
        </button>
      </div>
    );
  }

  // Stage transition screen
  if (isTransitioning) {
    const stageKeys = ['stage_1', 'stage_2', 'stage_3', 'stage_4', 'stage_5'] as const;
    let nextStage: number | null = null;
    for (let s = 1; s <= 5; s++) {
      if ((stageSummary[stageKeys[s - 1]] ?? 0) > 0) {
        nextStage = s;
        break;
      }
    }

    return (
      <div className="min-h-screen bg-bg-cream">
        <StageTransition
          completedStage={currentStage}
          nextStage={nextStage}
          wordsAdvanced={store.wordsAdvanced}
          wordsMastered={store.wordsMastered}
          summary={stageSummary}
          onContinue={handleTransitionContinue}
        />
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

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header */}
      <MasteryHeader
        stage={currentStage}
        currentIndex={currentIndex}
        totalInBatch={questions.length}
        combo={combo}
        onExit={handleExit}
      />

      {/* Growth progress bar */}
      <div className="px-4 md:px-6 pb-2">
        <GrowthProgressBar summary={stageSummary} totalWords={totalWords} />
      </div>

      {/* Timer */}
      <div className="px-4 md:px-6 py-2">
        <TimerBar
          secondsLeft={timer.secondsLeft}
          fraction={timer.fraction}
          urgency={timer.urgency}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-4 md:px-6 py-4 max-w-lg mx-auto w-full">
        {/* Question card - switches between word mode and sentence mode */}
        {currentQuestion.context_mode === 'sentence' && currentQuestion.sentence_blank ? (
          <>
            {/* Sentence mode: stages 1,2,5 use SentenceBlankCard; 3,4 use ListenCard with sentence */}
            {(currentStage === 1 || currentStage === 2 || currentStage === 5) && (
              <SentenceBlankCard
                sentenceBlank={currentQuestion.sentence_blank}
                sentenceKo={currentQuestion.word.example_ko || undefined}
                sentenceEn={currentQuestion.word.example_en || undefined}
                stage={currentStage}
              />
            )}
            {(currentStage === 3 || currentStage === 4) && (
              <ListenCard
                word={currentQuestion.word.english}
                stage={currentStage}
                contextMode="sentence"
                sentenceBlank={currentQuestion.sentence_blank}
                sentenceEn={currentQuestion.word.example_en}
              />
            )}
          </>
        ) : (
          <>
            {/* Word mode (original) */}
            {currentStage === 1 && (
              <WordCard word={currentQuestion.word.english} />
            )}
            {currentStage === 2 && (
              <MeaningCard korean={currentQuestion.word.korean || ''} />
            )}
            {(currentStage === 3 || currentStage === 4) && (
              <ListenCard word={currentQuestion.word.english} stage={currentStage} />
            )}
            {currentStage === 5 && (
              <MeaningCard korean={currentQuestion.word.korean || ''} />
            )}
          </>
        )}

        {/* Sentence review overlay (stage 1 only) */}
        {showSentenceReview && answerResult && (
          <SentenceReview
            english={currentQuestion.word.english}
            word={currentQuestion.word.english}
            exampleEn={answerResult.example_en}
            exampleKo={answerResult.example_ko}
            partOfSpeech={currentQuestion.word.part_of_speech}
            onDismiss={() => {
              store.dismissSentenceReview();
              store.nextQuestion();
            }}
          />
        )}

        {/* Answer area */}
        {!showSentenceReview && (
          <>
            {isTypingStage ? (
              <TypingInput
                value={typedAnswer}
                onChange={store.setTypedAnswer}
                onSubmit={handleTypingSubmit}
                disabled={!!answerResult}
              />
            ) : (
              <div className="flex flex-col gap-2.5 w-full">
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
          </>
        )}

        {/* Feedback banner */}
        {answerResult && !showSentenceReview && (
          <FeedbackBanner
            isCorrect={answerResult.is_correct}
            correctAnswer={answerResult.correct_answer}
            stageStreak={answerResult.stage_streak}
            requiredStreak={answerResult.required_streak}
          />
        )}

        {/* Almost correct feedback for typing */}
        {answerResult?.almost_correct && (
          <div className="flex items-center gap-2.5 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3.5 w-full">
            <span className="font-display text-sm font-semibold text-amber-700">
              거의 맞았어요! 정답: &lsquo;{answerResult.correct_answer}&rsquo;
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default MasteryPage;
