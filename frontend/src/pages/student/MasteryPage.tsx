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
import { wordLevelToRank } from '../../types/rank';
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
import { SentenceReview } from '../../components/mastery/SentenceReview';
import { SentenceBlankCard } from '../../components/mastery/SentenceBlankCard';
import { StageTransition } from '../../components/mastery/StageTransition';
import { Loader2 } from 'lucide-react';

const FEEDBACK_DELAY_CORRECT = 800;
const FEEDBACK_DELAY_WRONG = 1800;
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
  const submittingRef = useRef(false);
  const timerSoundPlayed = useRef(false);
  const twoSoundPlayed = useRef(false);

  // Timer warning: 15s→10초부터, 10s→7초부터, 5s→바로 재생
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
      timer.reset();
      stopTtsSounds();
      stopSound('timer');
      stopSound('two');
      timerSoundPlayed.current = false;
      twoSoundPlayed.current = false;

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

  // Timer warning sounds
  useEffect(() => {
    if (answerResult) return;
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
    };
  }, []);

  // Handle answer submission for choice stages
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

  // Central auto-advance: play feedback sound and advance after delay
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

    // If sentence review is shown, let that handler manage advancement
    if (useMasteryStore.getState().showSentenceReview) return;

    const delay = answerResult.is_correct ? FEEDBACK_DELAY_CORRECT : FEEDBACK_DELAY_WRONG;
    const t = setTimeout(() => {
      submittingRef.current = false;
      store.nextQuestion();
    }, delay);
    return () => clearTimeout(t);
  }, [answerResult]);

  // Sentence review auto-dismiss
  useEffect(() => {
    if (showSentenceReview) {
      const t = setTimeout(() => {
        submittingRef.current = false;
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
        level={currentQuestion ? wordLevelToRank(currentQuestion.word.level) : 1}
        lesson={currentQuestion?.word.lesson}
        stage={currentStage}
        currentIndex={currentIndex}
        totalInBatch={questions.length}
        combo={combo}
        onExit={handleExit}
      />

      {/* Progress Bar */}
      <GradientProgressBar current={currentIndex + 1} total={questions.length} />

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
          {currentQuestion.context_mode === 'sentence' && currentQuestion.sentence_blank ? (
            <>
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
        </div>

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
          <div className="w-full md:w-[640px]">
            {isTypingStage ? (
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
        )}
      </div>

      {/* Footer: feedback banner (matches original design - fixed at bottom) */}
      <div className="h-[70px] px-5 md:px-8 flex items-center">
        {answerResult && !showSentenceReview && (
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
