import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { wordService, type Word, type CreateWordRequest } from '../../services/word';
import { Search, Plus, Pencil, Trash2, X } from 'lucide-react';
import { logger } from '../../utils/logger';

const ITEMS_PER_PAGE = 20;

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
  const [levelFilter, setLevelFilter] = useState<number | undefined>();
  const [bookFilter, setBookFilter] = useState<string>('');
  const [page, setPage] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingWord, setEditingWord] = useState<Word | null>(null);
  const [formData, setFormData] = useState<WordFormData>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const fetchWords = async () => {
    try {
      setIsLoading(true);
      const params: {
        skip: number;
        limit: number;
        search?: string;
        level?: number;
        book_name?: string;
      } = {
        skip: page * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (levelFilter) params.level = levelFilter;
      if (bookFilter) params.book_name = bookFilter;

      const response = await wordService.listWords(params);
      setWords(response.words);
      setTotal(response.total);
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
  }, [page, debouncedSearch, levelFilter, bookFilter]);

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

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  // Extract unique book names for filter
  const [bookOptions, setBookOptions] = useState<string[]>([]);
  useEffect(() => {
    wordService.listBooks().then(setBookOptions).catch((e: unknown) => logger.error('Failed to load books:', e));
  }, []);

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="font-display text-2xl font-bold text-text-primary">
              단어 데이터베이스
            </h1>
            <span className="px-2.5 py-1 bg-teal-light text-teal text-sm font-semibold rounded-full">
              {total}개
            </span>
          </div>
          <button
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 bg-teal text-white rounded-lg px-4 py-2 font-medium hover:bg-teal/90 transition-colors"
          >
            <Plus className="w-4 h-4" />
            단어 추가
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="영단어 또는 뜻 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal"
            />
          </div>
          <select
            value={levelFilter || ''}
            onChange={(e) => {
              setLevelFilter(e.target.value ? Number(e.target.value) : undefined);
              setPage(0);
            }}
            className="px-4 py-2.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal bg-white"
          >
            <option value="">전체 레벨</option>
            {Array.from({ length: 15 }, (_, i) => i + 1).map((level) => (
              <option key={level} value={level}>
                Level {level}
              </option>
            ))}
          </select>
          <select
            value={bookFilter}
            onChange={(e) => {
              setBookFilter(e.target.value);
              setPage(0);
            }}
            className="px-4 py-2.5 border border-border-subtle rounded-lg text-sm focus:outline-none focus:border-teal bg-white min-w-[140px]"
          >
            <option value="">전체 교재</option>
            {bookOptions.map((book) => (
              <option key={book} value={book}>
                {book}
              </option>
            ))}
          </select>
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
                      <th className="text-left px-5">영단어</th>
                      <th className="text-left px-5">뜻(한국어)</th>
                      <th className="text-left px-5">레벨</th>
                      <th className="text-left px-5">교재</th>
                      <th className="text-left px-5">단원</th>
                      <th className="text-left px-5">품사</th>
                      <th className="text-center px-5 w-24">관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {words.map((word) => (
                      <tr
                        key={word.id}
                        className="border-b border-border-subtle h-[52px] hover:bg-bg-muted/50 transition-colors"
                      >
                        <td className="px-5 font-word font-medium text-text-primary">
                          {word.english}
                        </td>
                        <td className="px-5 text-sm text-text-secondary">{word.korean}</td>
                        <td className="px-5">
                          <span
                            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold"
                            style={{
                              backgroundColor: `rgba(45, 156, 174, ${0.1 + word.level * 0.05})`,
                              color: '#2D9CAE',
                            }}
                          >
                            Lv.{word.level}
                          </span>
                        </td>
                        <td className="px-5 text-sm text-text-secondary">
                          {word.book_name || '-'}
                        </td>
                        <td className="px-5 text-sm text-text-secondary">
                          {word.lesson || '-'}
                        </td>
                        <td className="px-5 text-sm text-text-tertiary font-word">
                          {word.part_of_speech || '-'}
                        </td>
                        <td className="px-5">
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
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-5 py-4 border-t border-border-subtle">
                  <div className="text-sm text-text-tertiary">
                    Page {page + 1} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                      className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      이전
                    </button>
                    <button
                      onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                      disabled={page >= totalPages - 1}
                      className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      다음
                    </button>
                  </div>
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
