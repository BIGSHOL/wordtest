/**
 * Teacher view: grammar test session report page.
 * Shows score overview, per-type accuracy bars, and wrong answer analysis.
 */
import { useParams, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { statsService } from '../../services/stats';
import { ArrowLeft, Printer, CheckCircle2, XCircle, Clock } from 'lucide-react';
import type { GrammarReport, GrammarAnswerDetail } from '../../types/report';
import { GRAMMAR_TYPE_LABELS, type GrammarQuestionType } from '../../types/grammar';
import { logger } from '../../utils/logger';

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}분 ${s}초`;
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

/** Render question text from question_data JSONB */
function renderQuestionText(answer: GrammarAnswerDetail): string {
  const data = answer.question_data;
  if (!data) return `문제 ${answer.question_order}`;

  // Most types have a "sentence" or "question" field
  if (typeof data.sentence === 'string') return data.sentence;
  if (typeof data.question === 'string') return data.question;

  // grammar_order type has "words" array
  if (Array.isArray(data.words)) return data.words.join(' / ');

  // grammar_pair has sentence_a and sentence_b
  if (typeof data.sentence_a === 'string' && typeof data.sentence_b === 'string') {
    return `(A) ${data.sentence_a} / (B) ${data.sentence_b}`;
  }

  // grammar_translate
  if (typeof data.korean === 'string') return data.korean;

  return `문제 ${answer.question_order}`;
}

/** Type badge colors */
const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  grammar_blank: { bg: '#DBEAFE', text: '#2563EB' },
  grammar_error: { bg: '#FEE2E2', text: '#DC2626' },
  grammar_common: { bg: '#F3E8FF', text: '#9333EA' },
  grammar_usage: { bg: '#FEF3C7', text: '#B45309' },
  grammar_transform: { bg: '#D1FAE5', text: '#059669' },
  grammar_order: { bg: '#E0E7FF', text: '#4338CA' },
  grammar_translate: { bg: '#FCE7F3', text: '#DB2777' },
  grammar_pair: { bg: '#F0FDFA', text: '#0D9488' },
};

export function GrammarReportPage() {
  const { studentId, sessionId } = useParams<{ studentId: string; sessionId: string }>();
  const [report, setReport] = useState<GrammarReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'overview' | 'wrong'>(  'overview');

  useEffect(() => {
    if (!studentId || !sessionId) return;
    setIsLoading(true);
    statsService.getGrammarReport(studentId, sessionId)
      .then(setReport)
      .catch((err) => logger.error('Failed to load grammar report:', err))
      .finally(() => setIsLoading(false));
  }, [studentId, sessionId]);

  const wrongAnswers = report?.answers.filter((a) => !a.is_correct) ?? [];
  const score = report?.session.score ?? (
    report ? Math.round((report.session.correct_count / report.session.total_questions) * 100) : 0
  );

  return (
    <TeacherLayout>
      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-teal border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !report ? (
        <div className="max-w-[760px] mx-auto py-6 px-4">
          <div className="bg-white border border-border-subtle rounded-2xl p-12 text-center">
            <p className="text-text-secondary">리포트를 불러올 수 없습니다.</p>
          </div>
        </div>
      ) : (
        <div className="max-w-[760px] mx-auto py-6 px-4 space-y-5">
          {/* Top bar */}
          <div className="flex items-center justify-between print:hidden">
            <Link
              to="/test-results"
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              전체 결과로
            </Link>
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-text-secondary border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors"
            >
              <Printer className="w-4 h-4" />
              인쇄
            </button>
          </div>

          {/* Header card */}
          <div className="bg-white border border-border-subtle rounded-2xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h1 className="text-xl font-bold text-text-primary">
                  문법 테스트 결과
                </h1>
                {report.session.config_name && (
                  <p className="text-sm text-text-secondary mt-0.5">
                    {report.session.config_name}
                  </p>
                )}
              </div>
              <div className="text-right text-sm text-text-tertiary space-y-0.5">
                <div>{report.session.student_name || '-'} {report.session.student_grade && `(${report.session.student_grade})`}</div>
                <div>{formatDate(report.session.started_at)}</div>
              </div>
            </div>

            {/* Score + Stats */}
            <div className="flex items-center gap-6">
              {/* Score circle */}
              <div
                className="w-[100px] h-[100px] rounded-full flex flex-col items-center justify-center shrink-0"
                style={{
                  background: score >= 80
                    ? 'linear-gradient(180deg, #22C55E, #16A34A)'
                    : score >= 60
                    ? 'linear-gradient(180deg, #F59E0B, #D97706)'
                    : 'linear-gradient(180deg, #EF4444, #DC2626)',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
                }}
              >
                <span className="text-white text-3xl font-bold leading-none">{score}</span>
                <span className="text-white/80 text-xs mt-0.5">점</span>
              </div>

              {/* Stats */}
              <div className="flex-1 grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-text-primary">{report.session.correct_count}</div>
                  <div className="text-xs text-text-tertiary">정답</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-text-primary">{report.session.total_questions}</div>
                  <div className="text-xs text-text-tertiary">총 문제</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-text-primary">
                    {report.total_time_seconds ? formatTime(report.total_time_seconds) : '-'}
                  </div>
                  <div className="text-xs text-text-tertiary">소요시간</div>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-[#F5F4F1] rounded-xl p-1 print:hidden">
            <button
              onClick={() => setTab('overview')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                tab === 'overview' ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary'
              }`}
            >
              유형별 분석
            </button>
            <button
              onClick={() => setTab('wrong')}
              className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                tab === 'wrong' ? 'bg-white text-text-primary shadow-sm' : 'text-text-tertiary'
              }`}
            >
              오답 분석 ({wrongAnswers.length})
            </button>
          </div>

          {/* Tab: 유형별 분석 */}
          {(tab === 'overview' || typeof window !== 'undefined') && (
            <div className={tab !== 'overview' ? 'hidden print:block' : ''}>
              <div className="bg-white border border-border-subtle rounded-2xl p-6 space-y-4">
                <h2 className="text-base font-bold text-text-primary">유형별 정답률</h2>
                {report.type_stats.map((stat) => {
                  const colors = TYPE_COLORS[stat.question_type] || { bg: '#F3F4F6', text: '#4B5563' };
                  return (
                    <div key={stat.question_type} className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {stat.label}
                          </span>
                          <span className="text-xs text-text-tertiary">
                            {stat.correct}/{stat.total}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          {stat.avg_time_sec != null && (
                            <span className="flex items-center gap-1 text-xs text-text-tertiary">
                              <Clock className="w-3 h-3" />
                              {stat.avg_time_sec}초
                            </span>
                          )}
                          <span className="text-sm font-bold text-text-primary w-12 text-right">
                            {stat.accuracy_pct}%
                          </span>
                        </div>
                      </div>
                      {/* Progress bar */}
                      <div className="h-3 bg-[#F3F4F6] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${stat.accuracy_pct}%`,
                            backgroundColor: stat.accuracy_pct >= 80 ? '#22C55E'
                              : stat.accuracy_pct >= 60 ? '#F59E0B'
                              : '#EF4444',
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* All answers overview */}
              <div className="bg-white border border-border-subtle rounded-2xl p-6 mt-5">
                <h2 className="text-base font-bold text-text-primary mb-4">전체 문제 결과</h2>
                <div className="space-y-2">
                  {report.answers.map((answer) => {
                    const colors = TYPE_COLORS[answer.question_type] || { bg: '#F3F4F6', text: '#4B5563' };
                    return (
                      <div
                        key={answer.question_order}
                        className={`flex items-center gap-3 p-3 rounded-xl ${
                          answer.is_correct ? 'bg-green-50/50' : 'bg-red-50/50'
                        }`}
                      >
                        {answer.is_correct ? (
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />
                        ) : (
                          <XCircle className="w-5 h-5 text-red-500 shrink-0" />
                        )}
                        <span className="text-sm font-semibold text-text-primary w-8 shrink-0">
                          #{answer.question_order}
                        </span>
                        <span
                          className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold shrink-0"
                          style={{ backgroundColor: colors.bg, color: colors.text }}
                        >
                          {GRAMMAR_TYPE_LABELS[answer.question_type as GrammarQuestionType] || answer.question_type}
                        </span>
                        <span className="text-sm text-text-secondary truncate flex-1">
                          {renderQuestionText(answer)}
                        </span>
                        {answer.time_taken_seconds != null && (
                          <span className="text-xs text-text-tertiary shrink-0">
                            {answer.time_taken_seconds.toFixed(1)}초
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Tab: 오답 분석 */}
          {(tab === 'wrong' || typeof window !== 'undefined') && (
            <div className={tab !== 'wrong' ? 'hidden print:block' : ''}>
              {wrongAnswers.length === 0 ? (
                <div className="bg-white border border-border-subtle rounded-2xl p-12 text-center">
                  <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
                  <p className="text-text-secondary font-medium">모든 문제를 맞혔습니다!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="print:hidden">
                    <h2 className="text-base font-bold text-text-primary">
                      틀린 문제 ({wrongAnswers.length}개)
                    </h2>
                  </div>
                  <div className="print:block hidden">
                    <h2 className="text-base font-bold text-text-primary mb-4">
                      오답 분석 ({wrongAnswers.length}개)
                    </h2>
                  </div>
                  {wrongAnswers.map((answer) => {
                    const colors = TYPE_COLORS[answer.question_type] || { bg: '#F3F4F6', text: '#4B5563' };
                    return (
                      <div
                        key={answer.question_order}
                        className="bg-white border border-border-subtle rounded-2xl p-5 space-y-3"
                      >
                        {/* Header */}
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-text-primary">
                            #{answer.question_order}
                          </span>
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ backgroundColor: colors.bg, color: colors.text }}
                          >
                            {GRAMMAR_TYPE_LABELS[answer.question_type as GrammarQuestionType] || answer.question_type}
                          </span>
                        </div>

                        {/* Question text */}
                        <p className="text-sm text-text-primary leading-relaxed">
                          {renderQuestionText(answer)}
                        </p>

                        {/* Options if available */}
                        {answer.question_data?.options && Array.isArray(answer.question_data.options) && (
                          <div className="flex flex-wrap gap-2">
                            {(answer.question_data.options as string[]).map((opt, i) => {
                              const isSelected = String(opt) === answer.selected_answer;
                              const isCorrect = String(opt) === answer.correct_answer;
                              return (
                                <span
                                  key={i}
                                  className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                                    isCorrect
                                      ? 'border-green-300 bg-green-50 text-green-700'
                                      : isSelected
                                      ? 'border-red-300 bg-red-50 text-red-700'
                                      : 'border-gray-200 bg-gray-50 text-text-tertiary'
                                  }`}
                                >
                                  {String(i + 1)}. {String(opt)}
                                  {isCorrect && ' ✓'}
                                  {isSelected && !isCorrect && ' ✗'}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Answer comparison */}
                        <div className="flex items-center gap-4 text-sm">
                          <div>
                            <span className="text-text-tertiary">선택: </span>
                            <span className="text-red-600 font-medium">
                              {answer.selected_answer || '미응답'}
                            </span>
                          </div>
                          <div>
                            <span className="text-text-tertiary">정답: </span>
                            <span className="text-green-600 font-medium">
                              {answer.correct_answer}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </TeacherLayout>
  );
}

export default GrammarReportPage;
