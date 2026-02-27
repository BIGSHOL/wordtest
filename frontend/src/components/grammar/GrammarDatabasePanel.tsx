/** Grammar database browser panel — shows books, chapters, and questions */
import { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, ChevronDown, ChevronRight, GraduationCap,
  FileText, Hash, Loader2,
} from 'lucide-react';
import { grammarTestService } from '../../services/grammarTest';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import type {
  GrammarBook,
  GrammarChapter,
  GrammarQuestionBrowse,
  GrammarQuestionType,
} from '../../types/grammar';

const ITEMS_PER_PAGE = 10;

const DIFFICULTY_LABELS: Record<number, { label: string; color: string; bg: string }> = {
  1: { label: '기본', color: '#16A34A', bg: '#DCFCE7' },
  2: { label: '중급', color: '#D97706', bg: '#FEF3C7' },
  3: { label: '고급', color: '#DC2626', bg: '#FEE2E2' },
};

function QuestionPreview({ q }: { q: GrammarQuestionBrowse }) {
  const d = q.question_data;
  const diff = DIFFICULTY_LABELS[q.difficulty] || DIFFICULTY_LABELS[1];

  let preview = '';
  switch (q.question_type) {
    case 'grammar_blank':
      preview = d.stem || '';
      break;
    case 'grammar_error':
      preview = d.prompt || '';
      break;
    case 'grammar_common':
      preview = d.prompt || '';
      break;
    case 'grammar_usage':
      preview = d.prompt || '';
      break;
    case 'grammar_transform':
      preview = `${d.original} → ${d.instruction}`;
      break;
    case 'grammar_order':
      preview = (d.words || []).join(' / ');
      break;
    case 'grammar_translate':
      preview = d.sentence_ko || '';
      break;
    case 'grammar_pair':
      preview = d.stem || '';
      break;
    default:
      preview = JSON.stringify(d).slice(0, 80);
  }

  return (
    <div className="flex items-start gap-3 px-4 py-3 border-b border-border-subtle last:border-0 hover:bg-bg-muted/50 transition-colors">
      <div className="shrink-0 mt-0.5">
        <span
          className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold"
          style={{ backgroundColor: '#EDE9FE', color: '#7C3AED' }}
        >
          {GRAMMAR_TYPE_LABELS[q.question_type as GrammarQuestionType] || q.question_type}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-text-primary truncate">{preview}</p>
        <div className="flex items-center gap-2 mt-1">
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            style={{ backgroundColor: diff.bg, color: diff.color }}
          >
            {diff.label}
          </span>
          <span className="text-[10px] text-text-tertiary">
            출처: {q.source}
          </span>
        </div>
      </div>
    </div>
  );
}

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
  const [isLoadingBooks, setIsLoadingBooks] = useState(true);
  const [isLoadingChapters, setIsLoadingChapters] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);

  // Load books on mount
  useEffect(() => {
    grammarTestService
      .listBooks()
      .then(setBooks)
      .catch(() => setBooks([]))
      .finally(() => setIsLoadingBooks(false));
  }, []);

  // Load chapters when book expanded
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

  // Load questions when chapter selected or filters change
  const loadQuestions = useCallback(async () => {
    if (!selectedBookId && !selectedChapterId) {
      setQuestions([]);
      setQuestionsTotal(0);
      return;
    }
    setIsLoadingQuestions(true);
    try {
      const res = await grammarTestService.listQuestions({
        book_id: selectedChapterId ? undefined : selectedBookId || undefined,
        chapter_id: selectedChapterId || undefined,
        question_type: typeFilter || undefined,
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
  }, [selectedBookId, selectedChapterId, typeFilter, questionsPage]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const handleSelectChapter = (bookId: string, chapterId: string) => {
    setSelectedBookId(bookId);
    setSelectedChapterId(chapterId);
    setQuestionsPage(0);
    setTypeFilter('');
  };

  const handleSelectBook = (bookId: string) => {
    setSelectedBookId(bookId);
    setSelectedChapterId(null);
    setQuestionsPage(0);
    setTypeFilter('');
  };

  const totalPages = Math.ceil(questionsTotal / ITEMS_PER_PAGE);

  // Compute total questions across all loaded chapters
  const totalAllQuestions = Object.values(chapters)
    .flat()
    .reduce((sum, ch) => sum + (ch.question_count || 0), 0);

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
            천일문 GRAMMAR 교재별 챕터와 문제를 확인합니다
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
                  (sum, ch) => sum + (ch.question_count || 0),
                  0,
                );

                return (
                  <div key={book.id}>
                    <button
                      onClick={() => handleToggleBook(book.id)}
                      className={`flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-bg-muted/50 transition-colors ${
                        selectedBookId === book.id && !selectedChapterId
                          ? 'bg-accent-indigo/5'
                          : ''
                      }`}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-text-tertiary shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-text-primary truncate">
                          Level {book.level}
                        </div>
                        <div className="text-[11px] text-text-tertiary truncate">
                          {book.title}
                        </div>
                      </div>
                      {bookChapters.length > 0 && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-accent-indigo/10 text-accent-indigo shrink-0">
                          {bookQuestionCount}
                        </span>
                      )}
                    </button>

                    {/* Chapters */}
                    {isExpanded && (
                      <div className="bg-[#FAFAF8]">
                        {isLoadingChapters && bookChapters.length === 0 ? (
                          <div className="px-4 py-3 text-xs text-text-tertiary flex items-center gap-2">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            로딩 중...
                          </div>
                        ) : (
                          <>
                            {/* All chapters button */}
                            <button
                              onClick={() => handleSelectBook(book.id)}
                              className={`flex items-center gap-2 w-full pl-10 pr-4 py-2 text-left text-xs transition-colors ${
                                selectedBookId === book.id && !selectedChapterId
                                  ? 'bg-accent-indigo/10 text-accent-indigo font-semibold'
                                  : 'text-text-secondary hover:bg-bg-muted/50'
                              }`}
                            >
                              <Hash className="w-3 h-3 shrink-0" />
                              전체 보기
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
                                <span className="truncate">
                                  Ch.{ch.chapter_num} {ch.title}
                                </span>
                                <span className="text-[10px] text-text-tertiary shrink-0 ml-2">
                                  {ch.question_count || 0}
                                </span>
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
                <div className="flex items-center gap-3">
                  <GraduationCap className="w-4 h-4 text-accent-indigo shrink-0" />
                  <span className="text-[13px] font-semibold text-text-secondary whitespace-nowrap">
                    유형
                  </span>
                  <div className="relative">
                    <select
                      value={typeFilter}
                      onChange={(e) => {
                        setTypeFilter(e.target.value);
                        setQuestionsPage(0);
                      }}
                      className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:border-accent-indigo cursor-pointer"
                      style={{ minWidth: 140 }}
                    >
                      <option value="">전체 유형</option>
                      {(Object.entries(GRAMMAR_TYPE_LABELS) as [string, string][]).map(
                        ([key, label]) => (
                          <option key={key} value={key}>
                            {label}
                          </option>
                        ),
                      )}
                    </select>
                    <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
                  </div>
                </div>
                <span
                  className="text-[11px] font-semibold rounded-full shrink-0"
                  style={{ backgroundColor: '#EDE9FE', color: '#7C3AED', padding: '4px 12px' }}
                >
                  {questionsTotal.toLocaleString()}개 문제
                </span>
              </div>

              {/* Questions list */}
              {isLoadingQuestions ? (
                <div className="py-16 text-center text-text-tertiary flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  로딩 중...
                </div>
              ) : questions.length === 0 ? (
                <div className="py-16 text-center text-text-tertiary">
                  문제가 없습니다.
                </div>
              ) : (
                <>
                  <div>
                    {questions.map((q) => (
                      <QuestionPreview key={q.id} q={q} />
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
