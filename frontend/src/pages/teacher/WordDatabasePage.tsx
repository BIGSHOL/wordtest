import { useState, useEffect, useCallback, useRef } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { wordService, type Word, type CreateWordRequest, type LessonInfo } from '../../services/word';
import { Search, Plus, Pencil, Trash2, X, Upload, Volume2, BookOpen, ChevronDown } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getLevelRank } from '../../types/rank';
import { speakWord, speakSentence } from '../../utils/tts';

const ITEMS_PER_PAGE = 20;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

async function checkTtsCache(text: string): Promise<boolean> {
  try {
    const resp = await fetch(`${API_BASE}/api/v1/tts/check?text=${encodeURIComponent(text)}`);
    if (!resp.ok) return false;
    const data = await resp.json();
    return data.cached;
  } catch {
    return false;
  }
}

interface WordFormData {
  english: string;
  korean: string;
  level: number;
  book_name: string;
  lesson: string;
  part_of_speech: string;
  category: string;
}

const emptyForm: WordFormData = {
  english: '',
  korean: '',
  level: 1,
  book_name: '',
  lesson: '',
  part_of_speech: '',
  category: '',
};

export function WordDatabasePage() {
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [bookFilter, setBookFilter] = useState<string>('');
  const [lessonFilter, setLessonFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [formData, setFormData] = useState<WordFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);
  const [bookOptions, setBookOptions] = useState<string[]>([]);
  const [lessonOptions, setLessonOptions] = useState<LessonInfo[]>([]);

  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const params: {
        skip: number;
        limit: number;
        search?: string;
        book_name?: string;
      } = {
        skip: page * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (bookFilter) params.book_name = bookFilter;

      const response = await wordService.listWords(params);

      // Filter by lesson on client side if needed
      let filteredWords = response.words;
      if (lessonFilter) {
        filteredWords = filteredWords.filter(w => w.lesson === lessonFilter);
      }

      setWords(filteredWords);
      setTotal(lessonFilter ? filteredWords.length : response.total);
    } catch (error) {
      logger.error('Failed to fetch words:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchWords();
  }, [page, debouncedSearch, bookFilter, lessonFilter]);

  // Load books on mount
  useEffect(() => {
    wordService.listBooks().then(setBookOptions).catch((e: unknown) => logger.error('Failed to load books:', e));
  }, []);

  // Load lessons when book changes
  useEffect(() => {
    if (bookFilter) {
      wordService.listLessons(bookFilter)
        .then(setLessonOptions)
        .catch((e: unknown) => logger.error('Failed to load lessons:', e));
    } else {
      setLessonOptions([]);
    }
    setLessonFilter(''); // Reset lesson filter when book changes
  }, [bookFilter]);

  const handleOpenForm = (word?: Word) => {
    if (word) {
      setEditingWord(word);
      setFormData({
        english: word.english,
        korean: word.korean,
        level: word.level,
        book_name: word.book_name || '',
        lesson: word.lesson || '',
        part_of_speech: word.part_of_speech || '',
        category: word.category || '',
      });
    } else {
      setEditingWord(null);
      setFormData(emptyForm);
    }
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingWord(null);
    setFormData(emptyForm);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const payload: CreateWordRequest = {
        english: formData.english,
        korean: formData.korean,
        level: formData.level,
        book_name: formData.book_name || undefined,
        lesson: formData.lesson || undefined,
        part_of_speech: formData.part_of_speech || undefined,
        category: formData.category || undefined,
      };

      if (editingWord) {
        await wordService.updateWord(editingWord.id, payload);
      } else {
        await wordService.createWord(payload);
      }

      handleCloseForm();
      await fetchWords();
    } catch (error) {
      logger.error('Failed to save word:', error);
      alert('단어 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      await wordService.deleteWord(id);
      await fetchWords();
    } catch (error) {
      logger.error('Failed to delete word:', error);
      alert('단어 삭제에 실패했습니다.');
    }
  };

  const handlePlayWord = useCallback(async (english: string) => {
    const cached = await checkTtsCache(english);
    if (cached) {
      speakWord(english);
      return;
    }
    if (confirm(`"${english}" 발음이 아직 생성되지 않았습니다.\nGemini TTS로 생성하시겠습니까?`)) {
      speakWord(english);
    }
  }, []);

  const handlePlaySentence = useCallback(async (sentence: string) => {
    const cached = await checkTtsCache(sentence);
    if (cached) {
      speakSentence(sentence);
      return;
    }
    if (confirm(`예문 발음이 아직 생성되지 않았습니다.\nGemini TTS로 생성하시겠습니까?`)) {
      speakSentence(sentence);
    }
  }, []);

  const [popoverWordId, setPopoverWordId] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!popoverWordId) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setPopoverWordId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popoverWordId]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const handleExcelImport = () => {
    alert('엑셀 가져오기 기능은 준비 중입니다.');
  };

  const filteredTotal = lessonFilter
    ? words.length
    : (bookFilter ? words.length : total);

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              단어 데이터베이스
            </h1>
            <p className="text-[13px] text-text-secondary mt-1">
              레슨별 단어를 관리하고 새로운 단어를 추가합니다
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-[220px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="단어 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border-subtle rounded-[10px] text-sm bg-white focus:outline-none focus:border-teal"
              />
            </div>
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center gap-2 px-4 py-2 rounded-[10px] text-white font-medium text-sm transition-all"
              style={{
                background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
              }}
            >
              <Plus className="w-4 h-4" />
              단어 추가
            </button>
            <button
              onClick={handleExcelImport}
              className="flex items-center gap-2 px-4 py-2 border border-border-subtle rounded-[10px] bg-white text-text-primary font-medium text-sm hover:bg-bg-muted transition-colors"
            >
              <Upload className="w-4 h-4" />
              엑셀 가져오기
            </button>
          </div>
        </div>

        {/* Add/Edit Form */}
        {showForm && (
          <div className="bg-surface border border-teal rounded-xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-semibold text-text-primary">
                {editingWord ? '단어 수정' : '단어 추가'}
              </h2>
              <button
                onClick={handleCloseForm}
                className="text-text-tertiary hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  영단어 *
                </label>
                <input
                  type="text"
                  value={formData.english}
                  onChange={(e) => setFormData({ ...formData, english: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal font-word"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  뜻(한국어) *
                </label>
                <input
                  type="text"
                  value={formData.korean}
                  onChange={(e) => setFormData({ ...formData, korean: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  레벨 *
                </label>
                <select
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal bg-white"
                >
                  {Array.from({ length: 15 }, (_, i) => i + 1).map((level) => (
                    <option key={level} value={level}>
                      Level {level}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  교재
                </label>
                <input
                  type="text"
                  value={formData.book_name}
                  onChange={(e) => setFormData({ ...formData, book_name: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  단원
                </label>
                <input
                  type="text"
                  value={formData.lesson}
                  onChange={(e) => setFormData({ ...formData, lesson: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-1.5">
                  품사
                </label>
                <input
                  type="text"
                  value={formData.part_of_speech}
                  onChange={(e) => setFormData({ ...formData, part_of_speech: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal"
                  placeholder="e.g. noun, verb, adj"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                onClick={handleCloseForm}
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary border border-border-subtle rounded-lg transition-colors"
                disabled={isSaving}
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving || !formData.english || !formData.korean}
                className="px-4 py-2 text-sm font-medium bg-teal text-white rounded-lg hover:bg-teal/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        )}

        {/* Word Table */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {/* Row 1: Book Filter */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-text-tertiary shrink-0" />
              <span className="text-[13px] font-semibold text-text-secondary whitespace-nowrap">교재</span>
              <div className="relative">
                <select
                  value={bookFilter}
                  onChange={(e) => {
                    setBookFilter(e.target.value);
                    setLessonFilter('');
                    setPage(0);
                  }}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal cursor-pointer"
                  style={{ minWidth: 180 }}
                >
                  <option value="">전체 교재</option>
                  {bookOptions.map((book) => (
                    <option key={book} value={book}>{book}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              </div>
            </div>
            <span
              className="text-[11px] font-semibold rounded-full shrink-0"
              style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
            >
              총 {filteredTotal.toLocaleString()}개 단어
            </span>
          </div>

          {/* Row 2: Lesson Filter (only when book selected) */}
          {bookFilter && lessonOptions.length > 0 && (
            <div className="flex items-center gap-1.5 px-5 py-2.5 border-b border-border-subtle bg-[#FAFAF8] overflow-x-auto">
              <span className="text-[11px] font-semibold text-text-tertiary whitespace-nowrap mr-1">레슨</span>
              <button
                onClick={() => {
                  setLessonFilter('');
                  setPage(0);
                }}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                  !lessonFilter
                    ? 'bg-teal text-white shadow-sm'
                    : 'bg-white text-text-secondary border border-border-subtle hover:bg-bg-muted'
                }`}
              >
                전체
              </button>
              {lessonOptions.map((lesson) => {
                const shortName = lesson.lesson.replace(/^Lesson\s*/i, '');
                return (
                  <button
                    key={lesson.lesson}
                    onClick={() => {
                      setLessonFilter(lesson.lesson);
                      setPage(0);
                    }}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors whitespace-nowrap ${
                      lessonFilter === lesson.lesson
                        ? 'bg-teal text-white shadow-sm'
                        : 'bg-white text-text-secondary border border-border-subtle hover:bg-bg-muted'
                    }`}
                  >
                    {shortName}
                    <span className="ml-1 text-[10px] opacity-60">({lesson.word_count})</span>
                  </button>
                );
              })}
            </div>
          )}

          {isLoading ? (
            <div className="py-16 text-center text-text-tertiary">로딩 중...</div>
          ) : words.length === 0 ? (
            <div className="py-16 text-center text-text-tertiary">
              검색 결과가 없습니다.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8F8F6] h-11 text-xs text-text-tertiary font-semibold">
                      <th className="text-center px-3 w-[50px] whitespace-nowrap">No.</th>
                      <th className="text-left px-3 whitespace-nowrap">영어 단어</th>
                      <th className="text-left px-3 whitespace-nowrap">품사</th>
                      <th className="text-left px-3 whitespace-nowrap">한국어 뜻</th>
                      <th className="text-left px-3">예문</th>
                      <th className="text-left px-3 whitespace-nowrap">레슨</th>
                      <th className="text-center px-3 whitespace-nowrap">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {words.map((word, index) => {
                      const rankInfo = getLevelRank(word.level);
                      return (
                        <tr
                          key={word.id}
                          className="border-b border-border-subtle h-[52px] hover:bg-bg-muted/50 transition-colors"
                        >
                          <td className="px-3 text-center text-sm text-text-tertiary">
                            {page * ITEMS_PER_PAGE + index + 1}
                          </td>
                          <td className="px-4">
                            <div className="flex items-center gap-2">
                              <span className="font-word font-medium text-text-primary">{word.english}</span>
                              <button
                                onClick={() => handlePlayWord(word.english)}
                                className="p-1 text-text-tertiary hover:text-teal rounded transition-colors"
                                title="발음"
                              >
                                <Volume2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 text-xs text-text-tertiary whitespace-nowrap">{word.part_of_speech || '-'}</td>
                          <td className="px-3 text-sm text-text-secondary">
                            <span className="truncate block max-w-[160px]">{word.korean}</span>
                          </td>
                          <td className="px-3 text-sm text-text-secondary">
                            {(() => {
                              const examples = word.examples || [];
                              const primaryEn = examples.length > 0 ? examples[0].example_en : word.example_en;
                              const extraCount = Math.max(0, examples.length - 1);

                              if (!primaryEn) return '-';

                              return (
                                <div className="relative flex items-center gap-1 max-w-[280px]">
                                  <span className="truncate">{primaryEn}</span>
                                  <button
                                    onClick={() => handlePlaySentence(primaryEn)}
                                    className="p-1 text-text-tertiary hover:text-teal rounded shrink-0 transition-colors"
                                    title="예문 발음"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                  </button>
                                  {extraCount > 0 && (
                                    <button
                                      onClick={() => setPopoverWordId(popoverWordId === word.id ? null : word.id)}
                                      className="shrink-0 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-teal/10 text-teal hover:bg-teal/20 transition-colors"
                                      title={`예문 ${examples.length}개`}
                                    >
                                      +{extraCount}
                                    </button>
                                  )}
                                  {popoverWordId === word.id && examples.length > 0 && (
                                    <div
                                      ref={popoverRef}
                                      className="absolute left-0 top-full mt-1 z-50 w-[400px] bg-white border border-border-subtle rounded-xl shadow-lg p-3 space-y-2"
                                    >
                                      <div className="text-xs font-semibold text-text-tertiary mb-1">
                                        예문 목록 ({examples.length}개)
                                      </div>
                                      {examples.map((ex, idx) => (
                                        <div key={ex.id} className="text-xs space-y-0.5 pb-2 border-b border-border-subtle last:border-0 last:pb-0">
                                          <div className="flex items-center gap-1">
                                            <span className="text-text-tertiary font-medium w-4">{idx + 1}.</span>
                                            <span className="text-text-primary font-word">{ex.example_en}</span>
                                            <button
                                              onClick={() => handlePlaySentence(ex.example_en)}
                                              className="p-0.5 text-text-tertiary hover:text-teal rounded shrink-0 transition-colors"
                                              title="예문 발음"
                                            >
                                              <Volume2 className="w-3 h-3" />
                                            </button>
                                          </div>
                                          <div className="pl-5 text-text-secondary">{ex.example_ko}</div>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                          <td className="px-3 whitespace-nowrap">
                            <span
                              className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap"
                              style={{
                                backgroundColor: rankInfo.colors[0] + '20',
                                color: rankInfo.colors[1],
                              }}
                            >
                              {word.lesson || `Lesson ${word.level}`}
                            </span>
                          </td>
                          <td className="px-3">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handleOpenForm(word)}
                                className="p-1.5 text-text-tertiary hover:text-teal hover:bg-teal-light rounded transition-colors"
                                title="수정"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(word.id)}
                                className="p-1.5 text-text-tertiary hover:text-wrong hover:bg-wrong-light rounded transition-colors"
                                title="삭제"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-border-subtle">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="px-3 text-sm text-text-secondary">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default WordDatabasePage;
