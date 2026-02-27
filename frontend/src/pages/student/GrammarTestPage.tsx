/**
 * Student grammar test page.
 * Renders 8 grammar question types with navigation and submission.
 */
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGrammarTestStore } from '../../stores/grammarTestStore';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import type { GrammarQuestion } from '../../types/grammar';
import {
  ChevronLeft, ChevronRight, Send, Loader2,
  CheckCircle2, XCircle, GraduationCap, BookOpen,
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
    studentName, totalQuestions,
    setAnswer, goToQuestion, goNext, goPrev, startExam, submitAll, reset,
  } = store;

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;

  // Redirect if no session
  useEffect(() => {
    if (phase === 'idle') {
      navigate('/test/start', { replace: true });
    }
  }, [phase, navigate]);

  const handleSubmit = useCallback(async () => {
    if (answeredCount < totalQuestions) {
      const unanswered = totalQuestions - answeredCount;
      if (!window.confirm(`${unanswered}개 문제가 미답입니다. 제출하시겠습니까?`)) return;
    }
    await submitAll();
  }, [answeredCount, totalQuestions, submitAll]);

  // Briefing phase
  if (phase === 'briefing') {
    return (
      <div className="min-h-screen bg-bg-cream flex items-center justify-center">
        <div className="w-full max-w-md mx-auto px-6">
          <div className="flex flex-col items-center gap-4 mb-8">
            <div
              className="w-[72px] h-[72px] rounded-full flex items-center justify-center"
              style={{
                background: 'linear-gradient(180deg, #4F46E5, #7C3AED)',
                boxShadow: '0 4px 20px #4F46E530',
              }}
            >
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="font-display text-[26px] font-bold text-text-primary">
              문법 테스트
            </h1>
            <p className="text-sm text-text-secondary text-center">
              {studentName}님, 준비되셨나요?
            </p>
          </div>

          <div className="bg-bg-surface rounded-2xl border border-border-subtle p-5 space-y-3 mb-6">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-accent-indigo" />
              <span className="text-sm font-semibold text-text-primary">시험 안내</span>
            </div>
            <div className="space-y-2">
              {[
                `총 ${totalQuestions}문제`,
                '빈칸, 오류탐지, 문장전환 등 다양한 유형',
                '모든 문제를 풀고 제출 버튼을 누르세요',
                '이전/다음 문제로 자유롭게 이동 가능',
              ].map((text, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary mt-1.5 shrink-0" />
                  <span className="text-[13px] text-text-secondary">{text}</span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={startExam}
            className="flex items-center justify-center gap-2.5 w-full h-14 rounded-2xl text-white"
            style={{
              background: 'linear-gradient(90deg, #4F46E5, #7C3AED)',
              boxShadow: '0 4px 16px #4F46E540',
            }}
          >
            <span className="text-[17px] font-bold">시험 시작하기</span>
          </button>
        </div>
      </div>
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
      {/* Top bar */}
      <div className="bg-bg-surface border-b border-border-subtle px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GraduationCap className="w-5 h-5 text-accent-indigo" />
          <span className="text-sm font-semibold text-text-primary">
            문법 테스트
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-text-secondary">
            {answeredCount}/{totalQuestions} 답변
          </span>
          <button
            onClick={handleSubmit}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-accent-indigo text-white text-sm font-semibold hover:bg-accent-indigo/90 transition-colors"
          >
            <Send className="w-4 h-4" />
            제출
          </button>
        </div>
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center py-6 px-4">
        <div className="w-full max-w-2xl">
          {/* Question header */}
          <div className="flex items-center justify-between mb-4">
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
          <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 mb-6">
            {renderCard(
              currentQuestion,
              answers[currentQuestion.id],
              (answer) => setAnswer(currentQuestion.id, answer),
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <button
              onClick={goPrev}
              disabled={currentIndex === 0}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              이전
            </button>

            {/* Question dots */}
            <div className="flex gap-1.5 flex-wrap justify-center max-w-[300px]">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  onClick={() => goToQuestion(i)}
                  className={`w-6 h-6 rounded-full text-[10px] font-bold transition-colors ${
                    i === currentIndex
                      ? 'bg-accent-indigo text-white'
                      : answers[q.id]
                        ? 'bg-teal/20 text-teal'
                        : 'bg-gray-200 text-text-tertiary'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={goNext}
              disabled={currentIndex === questions.length - 1}
              className="flex items-center gap-1 px-4 py-2.5 rounded-xl text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
            >
              다음
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default GrammarTestPage;
