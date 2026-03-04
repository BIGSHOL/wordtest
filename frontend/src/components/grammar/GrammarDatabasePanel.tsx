/** Grammar database browser panel — browse, preview, edit, and validate questions */
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, GraduationCap,
  FileText, Hash, Loader2, Pencil, Eye, EyeOff,
  AlertTriangle, AlertCircle, CheckCircle2,
} from 'lucide-react';
import { grammarTestService } from '../../services/grammarTest';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import type {
  GrammarBook,
  GrammarChapter,
  GrammarQuestionBrowse,
  GrammarQuestionType,
} from '../../types/grammar';
import { validateQuestion, type ValidationResult } from './grammarValidation';
import { GrammarCardPreview } from './GrammarCardPreview';
import { GrammarQuestionEditForm } from './GrammarQuestionEditForm';

const ITEMS_PER_PAGE = 10;

const DIFFICULTY_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '기본', color: '#16A34A', bg: '#DCFCE7' },
  2: { label: '중급', color: '#D97706', bg: '#FEF3C7' },
  3: { label: '고급', color: '#DC2626', bg: '#FEE2E2' },
};

type StatusFilter = '' | 'error' | 'warn' | 'inactive';

// ── Question Row (expandable) ─────────────────────────────────────
function QuestionRow({
  q,
  validation,
  onUpdate,
}: {
  q: GrammarQuestionBrowse;
  validation: ValidationResult;
  onUpdate: (updated: GrammarQuestionBrowse) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const d = q.question_data;
  const diff = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS[1];

  let preview = '';
  switch (q.question_type) {
    case 'grammar_blank': preview = d.stem || ''; break;
    case 'grammar_error': case 'grammar_common': case 'grammar_usage':
      preview = d.prompt || ''; break;
    case 'grammar_transform': preview = `${d.original} → ${d.instruction}`; break;
    case 'grammar_order': preview = (d.words || []).join(' / '); break;
    case 'grammar_translate': preview = d.sentence_ko || ''; break;
    case 'grammar_pair': preview = d.stem || ''; break;
    default: preview = JSON.stringify(d).slice(0, 80);
  }

  const handleToggleActive = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setToggling(true);
    try {
      const updated = await grammarTestService.updateQuestion(q.id, { is_active: !q.is_active });
      onUpdate(updated);
    } catch { /* ignore */ } finally {
      setToggling(false);
    }
  };

  const handleSave = async (patch: { question_type?: string; question_data?: Record<string, any>; difficulty?: number }) => {
    const updated = await grammarTestService.updateQuestion(q.id, patch);
    onUpdate(updated);
    setEditing(false);
  };

  const validationIcon = validation.level === 'error'
    ? <AlertCircle className="w-3.5 h-3.5 text-red-500" />
    : validation.level === 'warn'
    ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
    : <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />;

  return (
    <div className={`border-b border-border-subtle last:border-0 ${!q.is_active ? 'opacity-50 bg-gray-50' : ''}`}>
      {/* Row header */}
      <div
        onClick={() => { setExpanded(!expanded); setEditing(false); }}
        className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-bg-muted/50 transition-colors"
      >
        {/* Validation badge */}
        <div className="shrink-0 mt-1" title={validation.messages.join('\n')}>
          {validationIcon}
        </div>

        {/* Type badge */}
        <div className="shrink-0 mt-0.5">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
            style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }}
          >
            {GRAMMAR_TYPE_LABELS[q.question_type as GrammarQuestionType] || q.question_type}
          </span>
        </div>

        {/* Preview text */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm text-text-primary truncate ${!q.is_active ? 'line-through' : ''}`}>
            {preview || '(내용 없음)'}
          </p>
          <div className="flex items-center gap-2 mt-1">
            <span
              className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: diff.bg, color: diff.color }}
            >
              {diff.label}
            </span>
            {validation.level !== 'ok' && (
              <span className={`text-[10px] ${validation.level === 'error' ? 'text-red-500' : 'text-amber-500'}`}>
                {validation.messages[0]}
              </span>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setExpanded(true); setEditing(!editing); }}
            className="p-1.5 rounded hover:bg-bg-muted text-text-tertiary hover:text-accent-indigo transition-colors"
            title="편집"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleToggleActive}
            disabled={toggling}
            className={`p-1.5 rounded hover:bg-bg-muted transition-colors ${q.is_active ? 'text-text-tertiary hover:text-red-500' : 'text-red-400 hover:text-green-600'}`}
            title={q.is_active ? '비활성화' : '활성화'}
          >
            {q.is_active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded: Preview + Edit */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3">
          {/* Card preview */}
          {!editing && (
            <div className="bg-[#F8F8F6] rounded-xl p-4 border border-border-subtle">
              <div className="text-[10px] font-bold text-text-tertiary mb-2 uppercase">미리보기</div>
              <GrammarCardPreview
                questionType={q.question_type as GrammarQuestionType}
                questionData={q.question_data}
              />
            </div>
          )}

          {/* Edit form */}
          {editing && (
            <GrammarQuestionEditForm
              question={q}
              onSave={handleSave}
              onCancel={() => setEditing(false)}
            />
          )}

          {/* Validation details */}
          {validation.messages.length > 0 && !editing && (
            <div className={`rounded-lg px-3 py-2 text-xs ${
              validation.level === 'error' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
            }`}>
              {validation.messages.map((msg, i) => (
                <div key={i}>• {msg}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────
export function GrammarDatabasePanel() {
  const [books, setBooks] = useState<GrammarBook[]>([]);
  const [expandedBookId, setExpandedBookId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Record<string, GrammarChapter[]>>({});
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [questions, setQuestions] = useState<GrammarQuestionBrowse[]>([]);
  const [questionsTotal, setQuestionsTotal] = useState(0);
  const [questionsPage, setQuestionsPage] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  useEffect(() => {
    grammarTestService
      .listBooks()
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setIsLoadingBooks(false));
  }, []);

  const handleToggleBook = useCallback(async (bookId: string) => {
    if (expandedBookId === bookId) {
      setExpandedBookId(null);
      return;
    }
    setExpandedBookId(bookId);
    if (chapters[bookId]) return;
    setIsLoadingChapters(true);
    try {
      const chs = await grammarTestService.listChapters(bookId);
      setChapters((prev) => ({ ...prev, [bookId]: chs }));
    } catch {
      setChapters((prev) => ({ ...prev, [bookId]: [] }));
    } finally {
      setIsLoadingChapters(false);
    }
  }, [expandedBookId, chapters]);

  const loadQuestions = useCallback(async () => {
    if (!selectedBookId && !selectedChapterId) {
      setQuestions([]);
      setQuestionsTotal(0);
      return;
    }
    setIsLoadingQuestions(true);
    try {
      const isActiveParam = statusFilter === 'inactive' ? false : undefined;
      const res = await grammarTestService.listQuestions({
        book_id: selectedChapterId ? undefined : selectedBookId || undefined,
        chapter_id: selectedChapterId || undefined,
        question_type: typeFilter || undefined,
        is_active: isActiveParam,
        skip: questionsPage * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      });
      setQuestions(res.questions);
      setQuestionsTotal(res.total);
    } catch {
      setQuestions([]);
      setQuestionsTotal(0);
    } finally {
      setIsLoadingQuestions(false);
    }
  }, [selectedBookId, selectedChapterId, typeFilter, statusFilter, questionsPage]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleSelectChapter = (bookId: string, chapterId: string) => {
    setSelectedBookId(bookId);
    setSelectedChapterId(chapterId);
    setQuestionsPage(0);
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    setSelectedChapterId(null);
    setQuestionsPage(0);
  };

  const handleQuestionUpdate = (updated: GrammarQuestionBrowse) => {
    setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
  };

  const totalPages = Math.ceil(questionsTotal / ITEMS_PER_PAGE);

  const totalAllQuestions = Object.values(chapters)
    .flat()
    .reduce((sum, ch) => sum + (ch.question_count || 0), 0);

  // Compute validations for current page
  const validations = new Map<string, ValidationResult>();
  for (const q of questions) {
    validations.set(q.id, validateQuestion(q));
  }

  // Client-side status filtering (for error/warn)
  const filteredQuestions = statusFilter === 'error'
    ? questions.filter((q) => validations.get(q.id)?.level === 'error')
    : statusFilter === 'warn'
    ? questions.filter((q) => validations.get(q.id)?.level === 'warn' || validations.get(q.id)?.level === 'error')
    : questions;

  // Stats for current page
  const errorCount = questions.filter((q) => validations.get(q.id)?.level === 'error').length;
  const warnCount = questions.filter((q) => validations.get(q.id)?.level === 'warn').length;

  if (isLoadingBooks) {
    return (
      <div className="py-16 flex items-center justify-center text-text-tertiary">
        <Loader2 className="w-5 h-5 animate-spin mr-2" />
        로딩 중...
      </div>
    );
  }

  if (books.length === 0) {
    return (
      <div className="py-16 text-center">
        <GraduationCap className="w-12 h-12 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-text-tertiary">
          문법 데이터가 없습니다. 마이그레이션과 시딩을 실행해 주세요.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-text-primary">
            문법 데이터베이스
          </h1>
          <p className="text-[13px] text-text-secondary mt-1">
            문제를 확인하고 프롬프트·보기·정답을 수정할 수 있습니다
          </p>
        </div>
        {totalAllQuestions > 0 && (
          <span
            className="text-[11px] font-semibold rounded-full shrink-0"
            style={{ backgroundColor: '#EDE9FE', color: '#7C3AED', padding: '4px 12px' }}
          >
            총 {totalAllQuestions.toLocaleString()}개 문제
          </span>
        )}
      </div>

      <div className="flex gap-6">
        {/* Left sidebar - Books & Chapters */}
        <div className="w-[280px] shrink-0">
          <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border-subtle">
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-accent-indigo" />
                <span className="text-sm font-semibold text-text-primary">교재 목록</span>
              </div>
            </div>
            <div className="divide-y divide-border-subtle">
              {books.map((book) => {
                const isExpanded = expandedBookId === book.id;
                const bookChapters = chapters[book.id] || [];
                const bookQuestionCount = bookChapters.reduce(
                  (sum, ch) => sum + (ch.question_count || 0), 0,
                );
                return (
                  <div key={book.id}>
                    <button
                      onClick={() => handleToggleBook(book.id)}
                      className={`flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-bg-muted/50 transition-colors ${
                        selectedBookId === book.id && !selectedChapterId ? 'bg-accent-indigo/5' : ''
                      }`}
                    >
                      {isExpanded
                        ? <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                        : <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">Level {book.level}</div>
                        <div className="text-[11px] text-text-tertiary truncate">{book.title}</div>
                      </div>
                      {bookChapters.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-indigo/10 text-accent-indigo shrink-0">
                          {bookQuestionCount}
                        </span>
                      )}
                    </button>
                    {isExpanded && (
                      <div className="bg-[#FAFAF8]">
                        {isLoadingChapters && bookChapters.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-text-tertiary flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" /> 로딩 중...
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleSelectBook(book.id)}
                              className={`flex items-center gap-2 w-full pl-10 pr-4 py-2 text-left text-xs transition-colors ${
                                selectedBookId === book.id && !selectedChapterId
                                  ? 'bg-accent-indigo/10 text-accent-indigo font-semibold'
                                  : 'text-text-secondary hover:bg-bg-muted/50'
                              }`}
                            >
                              <Hash className="w-3 h-3 shrink-0" /> 전체 보기
                            </button>
                            {bookChapters.map((ch) => (
                              <button
                                key={ch.id}
                                onClick={() => handleSelectChapter(book.id, ch.id)}
                                className={`flex items-center justify-between w-full pl-10 pr-4 py-2 text-left text-xs transition-colors ${
                                  selectedChapterId === ch.id
                                    ? 'bg-accent-indigo/10 text-accent-indigo font-semibold'
                                    : 'text-text-secondary hover:bg-bg-muted/50'
                                }`}
                              >
                                <span className="truncate">Ch.{ch.chapter_num} {ch.title}</span>
                                <span className="text-[10px] text-text-tertiary shrink-0 ml-2">{ch.question_count || 0}</span>
                              </button>
                            ))}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right content - Questions */}
        <div className="flex-1 min-w-0">
          {!selectedBookId && !selectedChapterId ? (
            <div className="bg-surface border border-border-subtle rounded-xl py-16 text-center">
              <FileText className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
              <p className="text-sm text-text-tertiary">
                왼쪽에서 교재나 챕터를 선택하면 문제를 확인할 수 있습니다
              </p>
            </div>
          ) : (
            <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
              {/* Filter bar */}
              <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
                <div className="flex items-center gap-3 flex-wrap">
                  <GraduationCap className="w-4 h-4 text-accent-indigo shrink-0" />

                  {/* Type filter */}
                  <div className="relative">
                    <select
                      value={typeFilter}
                      onChange={(e) => { setTypeFilter(e.target.value); setQuestionsPage(0); }}
                      className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:border-accent-indigo cursor-pointer"
                      style={{ minWidth: 130 }}
                    >
                      <option value="">전체 유형</option>
                      {(Object.entries(GRAMMAR_TYPE_LABELS) as [string, string][]).map(
                        ([key, label]) => (
                          <option key={key} value={key}>{label}</option>
                        ),
                      )}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
                  </div>

                  {/* Status filter */}
                  <div className="relative">
                    <select
                      value={statusFilter}
                      onChange={(e) => { setStatusFilter(e.target.value as StatusFilter); setQuestionsPage(0); }}
                      className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:border-accent-indigo cursor-pointer"
                      style={{ minWidth: 110 }}
                    >
                      <option value="">전체 상태</option>
                      <option value="error">오류만</option>
                      <option value="warn">경고+오류</option>
                      <option value="inactive">비활성만</option>
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {errorCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                      {errorCount} 오류
                    </span>
                  )}
                  {warnCount > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
                      {warnCount} 경고
                    </span>
                  )}
                  <span
                    className="text-[11px] font-semibold rounded-full"
                    style={{ backgroundColor: '#EDE9FE', color: '#7C3AED', padding: '4px 12px' }}
                  >
                    {questionsTotal.toLocaleString()}개
                  </span>
                </div>
              </div>

              {/* Questions list */}
              {isLoadingQuestions ? (
                <div className="py-16 text-center text-text-tertiary flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> 로딩 중...
                </div>
              ) : filteredQuestions.length === 0 ? (
                <div className="py-16 text-center text-text-tertiary">
                  {statusFilter ? '해당 상태의 문제가 없습니다.' : '문제가 없습니다.'}
                </div>
              ) : (
                <>
                  <div>
                    {filteredQuestions.map((q) => (
                      <QuestionRow
                        key={q.id}
                        q={q}
                        validation={validations.get(q.id) || { level: 'ok', messages: [] }}
                        onUpdate={handleQuestionUpdate}
                      />
                    ))}
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-border-subtle">
                      <button
                        onClick={() => setQuestionsPage(Math.max(0, questionsPage - 1))}
                        disabled={questionsPage === 0}
                        className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        이전
                      </button>
                      <span className="px-3 text-sm text-text-secondary">
                        {questionsPage + 1} / {totalPages}
                      </span>
                      <button
                        onClick={() => setQuestionsPage(Math.min(totalPages - 1, questionsPage + 1))}
                        disabled={questionsPage >= totalPages - 1}
                        className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
