/**
 * Student grammar test page.
 * Renders 8 grammar question types with navigation and submission.
 */
import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGrammarTestStore } from '../../stores/grammarTestStore';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import type { GrammarQuestion } from '../../types/grammar';
import { useTimer } from '../../hooks/useTimer';
import { TotalTimerDisplay } from '../../components/test/TotalTimerDisplay';
import { TimerBar } from '../../components/test/TimerBar';
import { QuestionNavigator } from '../../components/test/QuestionNavigator';
import { SubmitConfirmDialog } from '../../components/test/SubmitConfirmDialog';
import { ExamBriefing } from '../../components/test/ExamBriefing';
import {
  ChevronLeft, ChevronRight, ArrowLeft, Loader2,
  CheckCircle2, XCircle,
} from 'lucide-react';

// Card components
import { GrammarBlankCard } from '../../components/grammar/GrammarBlankCard';
import { GrammarErrorCard } from '../../components/grammar/GrammarErrorCard';
import { GrammarCommonCard } from '../../components/grammar/GrammarCommonCard';
import { GrammarUsageCard } from '../../components/grammar/GrammarUsageCard';
import { GrammarTransformCard } from '../../components/grammar/GrammarTransformCard';
import { GrammarOrderCard } from '../../components/grammar/GrammarOrderCard';
import { GrammarTranslateCard } from '../../components/grammar/GrammarTranslateCard';
import { GrammarPairCard } from '../../components/grammar/GrammarPairCard';

function renderCard(
  question: GrammarQuestion,
  selected: string | undefined,
  onSelect: (answer: string) => void,
) {
  const d = question.question_data;
  switch (question.question_type) {
    case 'grammar_blank':
      return <GrammarBlankCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_error':
      return <GrammarErrorCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_common':
      return <GrammarCommonCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_usage':
      return <GrammarUsageCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_transform':
      return <GrammarTransformCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_order':
      return <GrammarOrderCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_translate':
      return <GrammarTranslateCard data={d as any} selected={selected} onSelect={onSelect} />;
    case 'grammar_pair':
      return <GrammarPairCard data={d as any} selected={selected} onSelect={onSelect} />;
    default:
      return <div className="text-text-tertiary">알 수 없는 문제 유형입니다.</div>;
  }
}

export function GrammarTestPage() {
  const navigate = useNavigate();
  const store = useGrammarTestStore();
  const {
    phase, questions, currentIndex, answers, results,
    studentName, totalQuestions, timeLimitSeconds, perQuestionSeconds, timeMode,
    questionTypes, questionTypeCounts, configName,
    setAnswer, goToQuestion, goNext, goPrev, startExam, submitAll, reset,
  } = store;

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  // Compute answered indexes for QuestionNavigator
  const answeredIndexes = useMemo(() => {
    const set = new Set<number>();
    questions.forEach((q, i) => { if (answers[q.id] !== undefined) set.add(i); });
    return set;
  }, [questions, answers]);

  // Timer — auto-submit on timeout
  const autoSubmitRef = useRef(false);
  const handleTimeout = useCallback(async () => {
    if (autoSubmitRef.current) return;
    autoSubmitRef.current = true;
    await submitAll();
  }, [submitAll]);

  const isPerQuestion = timeMode === 'per_question';
  const timerSeconds = isPerQuestion
    ? (perQuestionSeconds || 30)
    : timeLimitSeconds;

  const timer = useTimer(timerSeconds, isPerQuestion ? undefined : handleTimeout);

  // Per-question mode: auto-advance on timeout
  const handlePerQuestionTimeout = useCallback(() => {
    const { currentIndex: idx, questions: qs } = store;
    if (idx < qs.length - 1) {
      store.goNext();
    } else {
      handleTimeout();
    }
  }, [store, handleTimeout]);

  const perQuestionTimer = useTimer(
    isPerQuestion ? (perQuestionSeconds || 30) : 0,
    isPerQuestion ? handlePerQuestionTimeout : undefined,
  );

  // Reset per-question timer when question changes
  const prevIndexRef = useRef(currentIndex);
  useEffect(() => {
    if (isPerQuestion && prevIndexRef.current !== currentIndex) {
      perQuestionTimer.reset();
      prevIndexRef.current = currentIndex;
    }
  }, [currentIndex, isPerQuestion, perQuestionTimer]);

  // Redirect if no session
  useEffect(() => {
    if (phase === 'idle') {
      navigate('/test/start', { replace: true });
    }
  }, [phase, navigate]);

  const handleSubmit = useCallback(() => {
    setShowSubmitDialog(true);
  }, []);

  const handleSubmitConfirm = useCallback(async () => {
    setShowSubmitDialog(false);
    await submitAll();
  }, [submitAll]);

  // Briefing phase — reuse ExamBriefing (same as word test)
  if (phase === 'briefing') {
    return (
      <ExamBriefing
        studentName={studentName}
        bookName={null}
        bookNameEnd={null}
        lessonStart={null}
        lessonEnd={null}
        questionCount={totalQuestions}
        totalTimeSeconds={timeLimitSeconds}
        timeMode={timeMode as 'per_question' | 'total'}
        perQuestionTime={perQuestionSeconds || 30}
        questionTypes={questionTypes || undefined}
        questionTypeCounts={questionTypeCounts || undefined}
        configName={configName || '문법 테스트'}
        onStart={startExam}
      />
    );
  }

  // Submitting phase
  if (phase === 'submitting') {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-accent-indigo animate-spin" />
          <p className="text-lg font-semibold text-text-primary">채점 중...</p>
        </div>
      </div>
    );
  }

  // Complete phase
  if (phase === 'complete' && results) {
    const scoreColor = results.score >= 80 ? 'text-teal' : results.score >= 60 ? 'text-amber-500' : 'text-wrong';
    return (
      <div className="min-h-screen bg-bg-cream py-10 px-4">
        <div className="max-w-lg mx-auto">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
              style={{
                background: results.score >= 80
                  ? 'linear-gradient(180deg, #22C55E, #16A34A)'
                  : 'linear-gradient(180deg, #F59E0B, #D97706)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
              }}
            >
              <CheckCircle2 className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-[26px] font-bold text-text-primary">시험 완료!</h1>
            <div className={`text-5xl font-extrabold ${scoreColor}`}>
              {results.score}점
            </div>
            <p className="text-sm text-text-secondary">
              {results.total_questions}문제 중 {results.correct_count}문제 정답
            </p>
          </div>

          {/* Result details */}
          <div className="bg-bg-surface rounded-2xl border border-border-subtle p-5 space-y-3 mb-6">
            <h2 className="text-sm font-semibold text-text-primary">문제별 결과</h2>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {results.results.map((r, i) => (
                <div
                  key={i}
                  className={`flex items-center justify-between px-4 py-2.5 rounded-xl border ${
                    r.is_correct ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {r.is_correct ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                    <span className="text-sm font-medium text-text-primary">
                      {i + 1}번 — {GRAMMAR_TYPE_LABELS[r.question_type as keyof typeof GRAMMAR_TYPE_LABELS] || r.question_type}
                    </span>
                  </div>
                  {!r.is_correct && (
                    <span className="text-xs text-text-tertiary">정답: {r.correct_answer}</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={() => { reset(); navigate('/test/start', { replace: true }); }}
            className="w-full h-12 rounded-xl bg-accent-indigo text-white font-semibold text-sm hover:bg-accent-indigo/90 transition-colors"
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  // Testing phase
  if (phase !== 'testing' || !currentQuestion) return null;

  return (
    <div className="min-h-screen bg-bg-cream flex flex-col">
      {/* Header — unified style */}
      <div
        className="flex items-center justify-between h-14 px-4 shrink-0"
        style={{ borderBottom: '1px solid #E8E8E6', background: '#FFFFFF' }}
      >
        <button
          onClick={() => navigate('/test/start', { replace: true })}
          className="flex items-center gap-1.5 h-10 px-3 rounded-xl transition-colors"
          style={{ color: '#6D6C6A' }}
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="font-display text-sm font-medium">나가기</span>
        </button>

        {!isPerQuestion && timeLimitSeconds > 0 && (
          <TotalTimerDisplay secondsLeft={timer.secondsLeft} totalSeconds={timeLimitSeconds} />
        )}

        <button
          onClick={handleSubmit}
          className="h-10 px-4 rounded-xl font-display text-sm font-bold text-white transition-opacity active:opacity-80"
          style={{
            background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
            boxShadow: '0 2px 8px #4F46E530',
          }}
        >
          제출하기
        </button>
      </div>

      {/* QuestionNavigator */}
      <div style={{ borderBottom: '1px solid #E8E8E6', background: '#FFFFFF' }}>
        <QuestionNavigator
          totalQuestions={totalQuestions}
          currentIndex={currentIndex}
          answeredIndexes={answeredIndexes}
          onNavigate={goToQuestion}
        />
      </div>

      {/* Per-question timer bar */}
      {isPerQuestion && (
        <div className="px-4 py-2 bg-bg-surface border-b border-border-subtle">
          <TimerBar
            secondsLeft={perQuestionTimer.secondsLeft}
            fraction={perQuestionTimer.fraction}
            urgency={perQuestionTimer.urgency}
          />
        </div>
      )}

      {/* Question area */}
      <div className="flex-1 flex flex-col justify-center items-center gap-5 px-5 py-6 md:px-8">
        {/* Question header — number badge + type label */}
        <div className="w-full md:w-[640px] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-full bg-accent-indigo text-white flex items-center justify-center text-sm font-bold">
              {currentIndex + 1}
            </span>
            <span className="text-xs text-text-tertiary">
              / {totalQuestions}
            </span>
          </div>
          <span className="text-xs px-3 py-1 rounded-full bg-accent-indigo/10 text-accent-indigo font-medium">
            {GRAMMAR_TYPE_LABELS[currentQuestion.question_type] || currentQuestion.question_type}
          </span>
        </div>

        {/* Card */}
        <div className="w-full md:w-[640px]">
          <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6">
            {renderCard(
              currentQuestion,
              answers[currentQuestion.id],
              (answer) => setAnswer(currentQuestion.id, answer),
            )}
          </div>
        </div>

        {/* Navigation — prev/next only */}
        <div className="w-full md:w-[640px] flex items-center justify-between pt-2">
          <button
            onClick={goPrev}
            disabled={currentIndex === 0}
            className="flex items-center gap-1 h-10 px-4 rounded-xl font-display text-sm font-semibold transition-all"
            style={{
              background: currentIndex === 0 ? '#F0EFED' : '#EDECEA',
              color: currentIndex === 0 ? '#C5C4C2' : '#3D3D3C',
            }}
          >
            <ChevronLeft className="w-4 h-4" />
            이전
          </button>

          <button
            onClick={goNext}
            disabled={currentIndex === questions.length - 1}
            className="flex items-center gap-1 h-10 px-4 rounded-xl font-display text-sm font-semibold transition-all"
            style={{
              background: currentIndex === questions.length - 1 ? '#F0EFED' : '#EEF2FF',
              color: currentIndex === questions.length - 1 ? '#C5C4C2' : '#4F46E5',
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
        totalQuestions={totalQuestions}
        answeredCount={answeredCount}
        onConfirm={handleSubmitConfirm}
        onCancel={() => setShowSubmitDialog(false)}
      />
    </div>
  );
}

export default GrammarTestPage;
