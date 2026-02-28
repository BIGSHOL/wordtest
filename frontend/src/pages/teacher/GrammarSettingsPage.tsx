/**
 * Grammar test settings page for teachers.
 * Design unified with TestSettingsPage (3 tabs, config-first workflow, assign modal).
 */
import { useState, useEffect, useMemo } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { studentService } from '../../services/student';
import { grammarTestService } from '../../services/grammarTest';
import type { User } from '../../types/auth';
import type { GrammarBook, GrammarChapter, GrammarConfig, GrammarAssignmentItem, GrammarQuestionType } from '../../types/grammar';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import { logger } from '../../utils/logger';
import {
  BookOpen, Users, Check, ChevronRight, ChevronLeft,
  Clock, Hash, Send, Loader2, Trash2, Copy, CheckCircle2,
  ListChecks, Search, Info, Plus, X,
} from 'lucide-react';

const ALL_QUESTION_TYPES: GrammarQuestionType[] = [
  'grammar_blank', 'grammar_error', 'grammar_common', 'grammar_usage',
  'grammar_transform', 'grammar_order', 'grammar_translate', 'grammar_pair',
];

type Tab = 'create' | 'configs' | 'status';
type Step = 0 | 1 | 2 | 3 | 4;

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: 'create', label: '테스트 출제' },
  { key: 'configs', label: '생성된 테스트' },
  { key: 'status', label: '출제 현황' },
];

const PAGE_META = [
  { title: '학생 선택', icon: <Users className="w-3.5 h-3.5" /> },
  { title: '교재 선택', icon: <BookOpen className="w-3.5 h-3.5" /> },
  { title: '시간 설정', icon: <Clock className="w-3.5 h-3.5" /> },
  { title: '문제 유형', icon: <ListChecks className="w-3.5 h-3.5" /> },
  { title: '완료', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${day}`;
}

const STATUS_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: '대기중', bg: '#FFF7ED', color: '#EA580C' },
  started: { label: '진행중', bg: '#EBF8FA', color: '#2D9CAE' },
  completed: { label: '완료', bg: '#F0FDF4', color: '#16A34A' },
};

export function GrammarSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('create');

  // Data
  const [students, setStudents] = useState<User[]>([]);
  const [books, setBooks] = useState<GrammarBook[]>([]);
  const [chapters, setChapters] = useState<Record<string, GrammarChapter[]>>({});
  const [configs, setConfigs] = useState<GrammarConfig[]>([]);
  const [assignments, setAssignments] = useState<GrammarAssignmentItem[]>([]);

  // Wizard state
  const [step, setStep] = useState<Step>(0);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(20);
  const [timeMode, setTimeMode] = useState<'per_question' | 'total'>('per_question');
  const [perQuestionTime, setPerQuestionTime] = useState(30);
  const [totalTime, setTotalTime] = useState(600);
  const [customPerQuestionTime, setCustomPerQuestionTime] = useState('');
  const [customTotalTime, setCustomTotalTime] = useState('');
  const [customQuestionCount, setCustomQuestionCount] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<GrammarQuestionType>>(new Set(ALL_QUESTION_TYPES));
  const [configName, setConfigName] = useState('');

  // UI
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignResults, setAssignResults] = useState<{ student_name: string; test_code: string; assignment_id: string }[] | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [studentSearch, setStudentSearch] = useState('');

  // Assign modal
  const [assignModalConfig, setAssignModalConfig] = useState<GrammarConfig | null>(null);

  // Load data
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const [studentData, bookData, configData, assignData] = await Promise.all([
          studentService.listStudents(),
          grammarTestService.listBooks(),
          grammarTestService.listConfigs(),
          grammarTestService.listAssignments(),
        ]);
        setStudents(studentData);
        setBooks(bookData);
        setConfigs(configData);
        setAssignments(assignData);
      } catch (error) {
        logger.error('Failed to load data:', error);
      }
      setIsLoading(false);
    };
    load();
  }, []);

  // Load chapters when books are selected
  useEffect(() => {
    const loadChapters = async () => {
      const newChapters: Record<string, GrammarChapter[]> = {};
      for (const bookId of selectedBooks) {
        if (!chapters[bookId]) {
          try {
            newChapters[bookId] = await grammarTestService.listChapters(bookId);
          } catch { /* ignore */ }
        }
      }
      if (Object.keys(newChapters).length > 0) {
        setChapters((prev) => ({ ...prev, ...newChapters }));
      }
    };
    if (selectedBooks.size > 0) loadChapters();
  }, [selectedBooks]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredStudents = useMemo(() => {
    const term = studentSearch.toLowerCase();
    if (!term) return students;
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.school_name && s.school_name.toLowerCase().includes(term))
    );
  }, [students, studentSearch]);

  const allFilteredSelected = filteredStudents.length > 0 && filteredStudents.every((s) => selectedStudents.has(s.id));

  const toggleAllStudents = () => {
    if (allFilteredSelected) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(filteredStudents.map((s) => s.id)));
    }
  };

  const toggleBook = (id: string) => {
    setSelectedBooks((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleChapter = (id: string) => {
    setSelectedChapters((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleType = (t: GrammarQuestionType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(t) ? next.delete(t) : next.add(t);
      return next;
    });
  };

  // Create config (optionally assign students)
  const handleCreateConfig = async () => {
    if (selectedBooks.size === 0 || selectedTypes.size === 0) return;
    setIsSubmitting(true);
    try {
      const name = configName || `문법 테스트 ${new Date().toLocaleDateString('ko-KR')}`;
      const effCount = questionCount === -1 ? (parseInt(customQuestionCount) || 20) : questionCount;
      const config = await grammarTestService.createConfig({
        name,
        book_ids: Array.from(selectedBooks),
        chapter_ids: selectedChapters.size > 0 ? Array.from(selectedChapters) : undefined,
        question_count: effCount,
        time_limit_seconds: timeMode === 'total' ? totalTime : perQuestionTime * effCount,
        per_question_seconds: timeMode === 'per_question' ? perQuestionTime : undefined,
        time_mode: timeMode,
        question_types: Array.from(selectedTypes),
      });

      if (selectedStudents.size > 0) {
        const result = await grammarTestService.assignStudents(config.id, Array.from(selectedStudents));
        setAssignResults(result.assignments);
        // Refresh assignments
        const newAssignments = await grammarTestService.listAssignments();
        setAssignments(newAssignments);
      }

      setConfigs((prev) => [{ ...config, assignment_count: selectedStudents.size }, ...prev]);
      setStep(4);
    } catch (error) {
      logger.error('Failed to create grammar test:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleDeleteConfig = async (configId: string) => {
    if (!window.confirm('이 테스트 설정을 삭제하시겠습니까?')) return;
    try {
      await grammarTestService.deleteConfig(configId);
      setConfigs((prev) => prev.filter((c) => c.id !== configId));
    } catch (error) {
      logger.error('Failed to delete config:', error);
    }
  };

  const refreshData = async () => {
    try {
      const [configData, assignData] = await Promise.all([
        grammarTestService.listConfigs(),
        grammarTestService.listAssignments(),
      ]);
      setConfigs(configData);
      setAssignments(assignData);
    } catch (error) {
      logger.error('Failed to refresh data:', error);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setSelectedStudents(new Set());
    setSelectedBooks(new Set());
    setSelectedChapters(new Set());
    setSelectedTypes(new Set(ALL_QUESTION_TYPES));
    setQuestionCount(20);
    setCustomQuestionCount('');
    setCustomPerQuestionTime('');
    setCustomTotalTime('');
    setConfigName('');
    setAssignResults(null);
    setStudentSearch('');
  };

  // Step 0 allows proceeding without students (config-only mode)
  const canProceed = () => {
    switch (step) {
      case 0: return true; // students optional
      case 1: return selectedBooks.size > 0;
      case 2: return true;
      case 3: return selectedTypes.size > 0;
      default: return false;
    }
  };

  // Preview helpers
  const selectedBookNames = books.filter((b) => selectedBooks.has(b.id)).map((b) => b.title);
  const selectedChapterCount = selectedChapters.size;
  const timeSummary =
    timeMode === 'per_question'
      ? `문제당 ${perQuestionTime}초`
      : `전체 ${Math.floor(totalTime / 60)}분`;
  const effectiveQuestionCount = questionCount === -1 ? (parseInt(customQuestionCount) || 0) : questionCount;
  const totalTimeSeconds =
    timeMode === 'per_question' ? perQuestionTime * effectiveQuestionCount : totalTime;
  const totalMinutes = Math.floor(totalTimeSeconds / 60);
  const totalSec = totalTimeSeconds % 60;
  const estimatedTime = totalMinutes > 0
    ? `${totalMinutes}분${totalSec > 0 ? ` ${totalSec}초` : ''}`
    : `${totalSec}초`;

  return (
    <TeacherLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Tab navigation — unified with TestSettingsPage */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1px solid #E8E8E6', backgroundColor: '#F8F8F6' }}
        >
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key); if (tab.key === 'create') resetWizard(); }}
              className="flex-1 py-3 text-[14px] font-semibold transition-all relative"
              style={{
                backgroundColor: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.key ? '#2D9CAE' : '#9C9B99',
                borderBottom: activeTab === tab.key ? '2px solid #2D9CAE' : '2px solid transparent',
              }}
            >
              {tab.label}
              {tab.key === 'configs' && configs.length > 0 && (
                <span
                  className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                >
                  {configs.length}
                </span>
              )}
              {tab.key === 'status' && assignments.length > 0 && (
                <span
                  className="ml-1.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                >
                  {assignments.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ══ Tab: 테스트 출제 ══ */}
        {activeTab === 'create' && (
          <div className="flex gap-6 items-start">
            {/* Left: Wizard panel */}
            <div className="w-[880px] shrink-0">
              {/* Header + Step indicator */}
              <div className="flex items-center justify-between mb-5">
                <div className="space-y-1">
                  <h2 className="text-base font-bold text-text-primary font-display">문법 테스트 출제</h2>
                  <p className="text-xs text-text-secondary">천일문 GRAMMAR 기반 문법 시험 출제</p>
                </div>
                <div className="flex items-center justify-center gap-1.5 px-4 py-2.5">
                  {PAGE_META.map((_, i) => {
                    const isCompleted = i < step;
                    const isCurrent = i === step;
                    return (
                      <div key={i} className="flex items-center">
                        <div
                          className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all"
                          style={{
                            backgroundColor: isCompleted || isCurrent ? '#2D9CAE' : '#F0F0EE',
                            color: isCompleted || isCurrent ? 'white' : '#9C9B99',
                          }}
                        >
                          {isCompleted ? <Check className="w-3 h-3" /> : i + 1}
                        </div>
                        {i < PAGE_META.length - 1 && (
                          <div
                            className="w-4 h-0.5 mx-1"
                            style={{ backgroundColor: i < step ? '#2D9CAE' : '#E8E8E6' }}
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Wizard card */}
              <div className="bg-white rounded-2xl overflow-hidden flex flex-col" style={{ border: '1px solid #E8E8E6' }}>
                {/* Page title header */}
                <div
                  className="flex items-center gap-2.5"
                  style={{ padding: '16px 28px', borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
                >
                  <span style={{ color: '#2D9CAE' }}>{PAGE_META[step]?.icon}</span>
                  <span className="text-[15px] font-bold text-text-primary">{PAGE_META[step]?.title}</span>
                </div>

                {/* Page content */}
                <div className="overflow-y-auto" style={{ padding: '24px 28px', height: 520 }}>
                  {/* Step 0: Student selection (OPTIONAL) */}
                  {step === 0 && (
                    <div className="flex flex-col" style={{ height: '100%' }}>
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold text-text-secondary">
                          테스트를 출제할 학생을 선택합니다
                        </span>
                        <button onClick={toggleAllStudents} className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: allFilteredSelected ? '#2D9CAE' : 'transparent',
                              border: allFilteredSelected ? 'none' : '2px solid #E8E8E6',
                            }}
                          >
                            {allFilteredSelected && <Check className="w-2.5 h-2.5 text-white" />}
                          </span>
                          <span className="text-[11px] font-medium text-text-secondary">전체</span>
                        </button>
                      </div>

                      {/* Search */}
                      <div
                        className="flex items-center gap-2 h-9 rounded-lg mb-3 shrink-0"
                        style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 12px' }}
                      >
                        <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                        <input
                          type="text"
                          placeholder="이름 또는 학교로 검색..."
                          value={studentSearch}
                          onChange={(e) => setStudentSearch(e.target.value)}
                          className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                        />
                      </div>

                      {/* Student list */}
                      <div className="flex-1 min-h-0 overflow-y-auto grid grid-cols-2 gap-2 content-start">
                        {filteredStudents.length === 0 ? (
                          <div className="col-span-2 py-6 text-center text-[12px] text-text-tertiary">
                            {studentSearch ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
                          </div>
                        ) : (
                          filteredStudents.map((s) => {
                            const isSelected = selectedStudents.has(s.id);
                            const schoolInfo = [s.school_name, s.grade].filter(Boolean).join(' ');
                            return (
                              <button
                                key={s.id}
                                onClick={() => toggleStudent(s.id)}
                                className="flex items-center gap-2.5 rounded-lg transition-colors text-left"
                                style={{
                                  backgroundColor: isSelected ? '#EBF8FA' : '#F8F8F6',
                                  border: isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                                  padding: isSelected ? '7px 11px' : '8px 12px',
                                }}
                              >
                                <span
                                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                                    border: isSelected ? 'none' : '2px solid #E8E8E6',
                                  }}
                                >
                                  {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                </span>
                                <span
                                  className="text-[12px] font-semibold truncate min-w-0 flex-1"
                                  style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                                >
                                  {s.name}{schoolInfo ? ` · ${schoolInfo}` : ''}
                                </span>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Info notice */}
                      {selectedStudents.size === 0 && (
                        <div
                          className="flex items-center gap-2 rounded-lg mt-3 shrink-0"
                          style={{ backgroundColor: '#FFF7ED', padding: '8px 12px', border: '1px solid #FED7AA' }}
                        >
                          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#EA580C' }} />
                          <span className="text-[11px] font-medium" style={{ color: '#EA580C' }}>
                            학생 없이 진행하면 테스트만 먼저 생성되며, 나중에 학생에게 배정할 수 있습니다.
                          </span>
                        </div>
                      )}

                      {/* Selected count */}
                      <div
                        className="flex items-center gap-2 rounded-lg mt-2 shrink-0"
                        style={{
                          backgroundColor: selectedStudents.size > 0 ? '#EBF8FA' : '#F8F8F6',
                          padding: '8px 12px',
                        }}
                      >
                        <Users className="w-3.5 h-3.5" style={{ color: selectedStudents.size > 0 ? '#2D9CAE' : '#9C9B99' }} />
                        <span className="text-[11px] font-medium" style={{ color: selectedStudents.size > 0 ? '#2D9CAE' : '#9C9B99' }}>
                          {selectedStudents.size > 0 ? `${selectedStudents.size}명 선택됨` : '테스트만 생성'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Step 1: Book & Chapter selection */}
                  {step === 1 && (
                    <div className="space-y-3">
                      <span className="text-[11px] font-semibold text-text-secondary">
                        출제할 교재와 챕터를 선택합니다
                      </span>
                      {isLoading ? (
                        <div className="py-8 text-center text-[12px] text-text-tertiary flex items-center justify-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          교재 로딩 중...
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {books.map((book) => (
                            <div key={book.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E8E6' }}>
                              <button
                                onClick={() => toggleBook(book.id)}
                                className="flex items-center gap-3 w-full transition-colors"
                                style={{
                                  padding: '12px 16px',
                                  backgroundColor: selectedBooks.has(book.id) ? '#EBF8FA' : '#F8F8F6',
                                }}
                              >
                                <span
                                  className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                  style={{
                                    backgroundColor: selectedBooks.has(book.id) ? '#2D9CAE' : 'transparent',
                                    border: selectedBooks.has(book.id) ? 'none' : '2px solid #E8E8E6',
                                  }}
                                >
                                  {selectedBooks.has(book.id) && <Check className="w-2.5 h-2.5 text-white" />}
                                </span>
                                <span
                                  className="text-[13px] font-bold"
                                  style={{ color: selectedBooks.has(book.id) ? '#2D9CAE' : '#3D3D3C' }}
                                >
                                  {book.title}
                                </span>
                              </button>
                              {selectedBooks.has(book.id) && chapters[book.id] && (
                                <div style={{ borderTop: '1px solid #E8E8E6', padding: '14px 16px', backgroundColor: '#FAFAF9' }}>
                                  <div className="flex items-center justify-between mb-3">
                                    <p className="text-[11px] text-text-secondary">
                                      챕터를 선택하세요 <span className="opacity-60">(미선택 시 전체 출제)</span>
                                    </p>
                                    {(() => {
                                      const bookChapterIds = chapters[book.id].map((ch) => ch.id);
                                      const allSelected = bookChapterIds.length > 0 && bookChapterIds.every((id) => selectedChapters.has(id));
                                      const someSelected = bookChapterIds.some((id) => selectedChapters.has(id));
                                      return (
                                        <button
                                          onClick={() => {
                                            setSelectedChapters((prev) => {
                                              const next = new Set(prev);
                                              if (allSelected) {
                                                bookChapterIds.forEach((id) => next.delete(id));
                                              } else {
                                                bookChapterIds.forEach((id) => next.add(id));
                                              }
                                              return next;
                                            });
                                          }}
                                          className="flex items-center gap-1.5 text-[10px] font-semibold transition-colors"
                                          style={{ color: someSelected ? '#2D9CAE' : '#9C9B99' }}
                                        >
                                          <span
                                            className="w-3.5 h-3.5 rounded flex items-center justify-center"
                                            style={{
                                              backgroundColor: allSelected ? '#2D9CAE' : 'transparent',
                                              border: allSelected ? 'none' : '1.5px solid #D0D0CE',
                                            }}
                                          >
                                            {allSelected && <Check className="w-2 h-2 text-white" />}
                                          </span>
                                          전체
                                        </button>
                                      );
                                    })()}
                                  </div>
                                  <div className="grid grid-cols-3 gap-1.5">
                                    {chapters[book.id].map((ch) => {
                                      const isChSelected = selectedChapters.has(ch.id);
                                      return (
                                        <button
                                          key={ch.id}
                                          onClick={() => toggleChapter(ch.id)}
                                          className="flex items-center gap-2 rounded-lg text-left transition-all"
                                          style={{
                                            padding: isChSelected ? '7px 10px' : '8px 11px',
                                            backgroundColor: isChSelected ? '#EBF8FA' : '#FFFFFF',
                                            border: isChSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                                          }}
                                        >
                                          <span
                                            className="text-[10px] font-bold shrink-0 w-[18px] h-[18px] rounded flex items-center justify-center"
                                            style={{
                                              backgroundColor: isChSelected ? '#2D9CAE' : '#F0F0EE',
                                              color: isChSelected ? '#FFFFFF' : '#9C9B99',
                                            }}
                                          >
                                            {ch.chapter_num}
                                          </span>
                                          <span
                                            className="text-[11px] font-medium truncate min-w-0 flex-1"
                                            style={{ color: isChSelected ? '#2D9CAE' : '#3D3D3C' }}
                                          >
                                            {ch.title}
                                          </span>
                                          {ch.question_count != null && (
                                            <span
                                              className="text-[9px] font-semibold shrink-0"
                                              style={{ color: isChSelected ? '#2D9CAE' : '#B0AFAD' }}
                                            >
                                              {ch.question_count}
                                            </span>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                          {books.length === 0 && (
                            <div className="py-8 text-center text-[12px] text-text-tertiary">
                              등록된 문법 교재가 없습니다.
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Step 2: Time & Question count — unified with word test design */}
                  {step === 2 && (
                    <div className="space-y-4">
                      {/* Time mode */}
                      <div>
                        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">시간 유형</span>
                        <div className="flex flex-wrap gap-2">
                          <GrammarOptionPill selected={timeMode === 'per_question'} onClick={() => setTimeMode('per_question')}>
                            문제당 시간
                          </GrammarOptionPill>
                          <GrammarOptionPill selected={timeMode === 'total'} onClick={() => setTimeMode('total')}>
                            전체 시간
                          </GrammarOptionPill>
                        </div>
                        <div
                          className="flex items-center gap-2 rounded-lg mt-3"
                          style={{ backgroundColor: '#EBF8FA', padding: '10px 14px' }}
                        >
                          <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#2D9CAE' }} />
                          <span className="text-[11px] font-medium" style={{ color: '#2D9CAE' }}>
                            {timeMode === 'per_question'
                              ? '각 문제마다 제한 시간이 주어집니다. 시간 초과 시 자동으로 다음 문제로 넘어갑니다.'
                              : '전체 시험 시간 내에서 자유롭게 문제를 이동하고 답을 변경할 수 있습니다.'}
                          </span>
                        </div>
                      </div>

                      {/* Time value */}
                      <div>
                        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">
                          {timeMode === 'per_question' ? '문제당 제한 시간' : '전체 제한 시간'}
                        </span>
                        {timeMode === 'per_question' ? (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: '15초', value: 15 },
                                { label: '20초', value: 20 },
                                { label: '30초', value: 30 },
                                { label: '45초', value: 45 },
                                { label: '60초', value: 60 },
                              ].map((opt) => (
                                <GrammarOptionPill
                                  key={opt.value}
                                  selected={perQuestionTime === opt.value && customPerQuestionTime === ''}
                                  onClick={() => { setPerQuestionTime(opt.value); setCustomPerQuestionTime(''); }}
                                >
                                  {opt.label}
                                </GrammarOptionPill>
                              ))}
                              <GrammarOptionPill
                                selected={customPerQuestionTime !== ''}
                                onClick={() => { setCustomPerQuestionTime(String(perQuestionTime || 30)); }}
                              >
                                직접 입력
                              </GrammarOptionPill>
                            </div>
                            {customPerQuestionTime !== '' && (
                              <div className="flex items-center gap-2 mt-3">
                                <input
                                  type="number"
                                  min={1}
                                  max={300}
                                  value={customPerQuestionTime}
                                  onChange={(e) => {
                                    const secs = parseInt(e.target.value) || 0;
                                    setCustomPerQuestionTime(e.target.value);
                                    setPerQuestionTime(secs);
                                  }}
                                  className="w-20 px-3 py-1.5 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#2D9CAE]/30"
                                  style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                                />
                                <span className="text-[13px] text-text-secondary">초</span>
                              </div>
                            )}
                          </>
                        ) : (
                          <>
                            <div className="flex flex-wrap gap-2">
                              {[
                                { label: '10분', value: 600 },
                                { label: '20분', value: 1200 },
                                { label: '30분', value: 1800 },
                                { label: '50분', value: 3000 },
                                { label: '80분', value: 4800 },
                              ].map((opt) => (
                                <GrammarOptionPill
                                  key={opt.value}
                                  selected={totalTime === opt.value && customTotalTime === ''}
                                  onClick={() => { setTotalTime(opt.value); setCustomTotalTime(''); }}
                                >
                                  {opt.label}
                                </GrammarOptionPill>
                              ))}
                              <GrammarOptionPill
                                selected={customTotalTime !== ''}
                                onClick={() => { setCustomTotalTime(String(Math.floor(totalTime / 60) || 10)); }}
                              >
                                직접 입력
                              </GrammarOptionPill>
                            </div>
                            {customTotalTime !== '' && (
                              <div className="flex items-center gap-2 mt-3">
                                <input
                                  type="number"
                                  min={1}
                                  max={120}
                                  value={customTotalTime}
                                  onChange={(e) => {
                                    const mins = parseInt(e.target.value) || 0;
                                    setCustomTotalTime(e.target.value);
                                    setTotalTime(mins * 60);
                                  }}
                                  className="w-20 px-3 py-1.5 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#2D9CAE]/30"
                                  style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                                />
                                <span className="text-[13px] text-text-secondary">분</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Question count */}
                      <div>
                        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">문제 수</span>
                        <div className="flex flex-wrap gap-2">
                          {[10, 15, 20, 25, 30].map((n) => (
                            <GrammarOptionPill
                              key={n}
                              selected={questionCount === n}
                              onClick={() => { setQuestionCount(n); setCustomQuestionCount(''); }}
                            >
                              {n}문제
                            </GrammarOptionPill>
                          ))}
                          <GrammarOptionPill
                            selected={questionCount === -1}
                            onClick={() => setQuestionCount(-1)}
                          >
                            직접 입력
                          </GrammarOptionPill>
                        </div>
                        {questionCount === -1 && (
                          <input
                            type="number"
                            min={1}
                            max={200}
                            value={customQuestionCount}
                            onChange={(e) => setCustomQuestionCount(e.target.value)}
                            placeholder="문제 수 입력"
                            className="mt-3 w-28 px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#2D9CAE]/30"
                            style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                          />
                        )}
                        {/* Time summary */}
                        {(() => {
                          const effCount = questionCount === -1 ? (parseInt(customQuestionCount) || 0) : questionCount;
                          if (effCount <= 0) return null;
                          const summary = timeMode === 'per_question'
                            ? `${effCount}문제 x ${perQuestionTime}초 = 총 ${Math.floor(effCount * perQuestionTime / 60)}분 ${(effCount * perQuestionTime) % 60}초`
                            : `전체 ${Math.floor(totalTime / 60)}분 (문제당 평균 ${(totalTime / effCount).toFixed(1)}초)`;
                          return (
                            <div
                              className="flex items-center gap-2 rounded-lg mt-3"
                              style={{ backgroundColor: '#EBF8FA', padding: '10px 14px' }}
                            >
                              <Info className="w-3.5 h-3.5 shrink-0" style={{ color: '#2D9CAE' }} />
                              <span className="text-[11px] font-medium" style={{ color: '#2D9CAE' }}>{summary}</span>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Config name */}
                      <div>
                        <span className="text-[11px] font-semibold text-text-secondary mb-1.5 block">테스트 이름 (선택)</span>
                        <input
                          type="text"
                          value={configName}
                          onChange={(e) => setConfigName(e.target.value)}
                          placeholder="예: 1학기 중간고사 문법"
                          className="w-full rounded-lg text-[13px] text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#2D9CAE]/30"
                          style={{ padding: '8px 12px', border: '1px solid #E8E8E6', backgroundColor: '#FFFFFF' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Question types — grouped by 객관식/서술형 */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-text-secondary">
                          출제할 문제 유형을 선택합니다
                        </span>
                        <button
                          onClick={() => {
                            if (selectedTypes.size === ALL_QUESTION_TYPES.length) {
                              setSelectedTypes(new Set());
                            } else {
                              setSelectedTypes(new Set(ALL_QUESTION_TYPES));
                            }
                          }}
                          className="flex items-center gap-1.5 text-[10px] font-semibold transition-colors"
                          style={{ color: selectedTypes.size === ALL_QUESTION_TYPES.length ? '#2D9CAE' : '#9C9B99' }}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded flex items-center justify-center"
                            style={{
                              backgroundColor: selectedTypes.size === ALL_QUESTION_TYPES.length ? '#2D9CAE' : 'transparent',
                              border: selectedTypes.size === ALL_QUESTION_TYPES.length ? 'none' : '1.5px solid #D0D0CE',
                            }}
                          >
                            {selectedTypes.size === ALL_QUESTION_TYPES.length && <Check className="w-2 h-2 text-white" />}
                          </span>
                          전체
                        </button>
                      </div>

                      {/* 객관식 그룹 */}
                      {(() => {
                        const GRAMMAR_GROUPS: { title: string; color: string; bg: string; types: { key: GrammarQuestionType; desc: string }[] }[] = [
                          {
                            title: '객관식',
                            color: '#2563EB',
                            bg: '#EFF6FF',
                            types: [
                              { key: 'grammar_blank', desc: '문맥에 맞는 답을 고르세요' },
                              { key: 'grammar_error', desc: '문법 오류가 있는 문장을 찾으세요' },
                              { key: 'grammar_common', desc: '공통으로 들어갈 단어를 고르세요' },
                              { key: 'grammar_usage', desc: '밑줄 친 단어의 올바른 쓰임을 고르세요' },
                              { key: 'grammar_pair', desc: '(A)와 (B)에 들어갈 짝을 고르세요' },
                            ],
                          },
                          {
                            title: '서술형',
                            color: '#9333EA',
                            bg: '#FAF5FF',
                            types: [
                              { key: 'grammar_transform', desc: '주어진 조건에 맞게 문장을 전환하세요' },
                              { key: 'grammar_order', desc: '주어진 단어를 올바른 순서로 배열하세요' },
                              { key: 'grammar_translate', desc: '한국어를 영어로 번역하세요' },
                            ],
                          },
                        ];
                        return GRAMMAR_GROUPS.map((group) => (
                          <div key={group.title} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8E8E6' }}>
                            <div
                              className="flex items-center gap-2 px-4 py-2"
                              style={{ backgroundColor: group.bg, borderBottom: '1px solid #E8E8E6' }}
                            >
                              <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: group.color }}
                              />
                              <span className="text-[11px] font-bold" style={{ color: group.color }}>
                                {group.title}
                              </span>
                              <span className="text-[10px] font-medium" style={{ color: group.color, opacity: 0.6 }}>
                                {group.types.filter((t) => selectedTypes.has(t.key)).length}/{group.types.length}
                              </span>
                            </div>
                            <div className="divide-y divide-[#F0F0EE]">
                              {group.types.map((t) => {
                                const isSelected = selectedTypes.has(t.key);
                                return (
                                  <button
                                    key={t.key}
                                    onClick={() => toggleType(t.key)}
                                    className="flex items-center gap-3 w-full text-left transition-colors"
                                    style={{
                                      padding: '10px 16px',
                                      backgroundColor: isSelected ? '#FAFFFE' : '#FFFFFF',
                                    }}
                                  >
                                    <span
                                      className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                                      style={{
                                        backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                                        border: isSelected ? 'none' : '2px solid #E8E8E6',
                                        borderRadius: 3,
                                      }}
                                    >
                                      {isSelected && <Check className="w-2.5 h-2.5 text-white" />}
                                    </span>
                                    <div className="min-w-0 flex-1">
                                      <p
                                        className="text-[12px] font-bold"
                                        style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                                      >
                                        {GRAMMAR_TYPE_LABELS[t.key]}
                                      </p>
                                      <p className="text-[10px]" style={{ color: '#9C9B99' }}>
                                        {t.desc}
                                      </p>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ));
                      })()}

                      <div
                        className="flex items-center gap-2 rounded-lg"
                        style={{
                          backgroundColor: selectedTypes.size > 0 ? '#EBF8FA' : '#F8F8F6',
                          padding: '8px 12px',
                        }}
                      >
                        <ListChecks className="w-3.5 h-3.5" style={{ color: selectedTypes.size > 0 ? '#2D9CAE' : '#9C9B99' }} />
                        <span className="text-[11px] font-medium" style={{ color: selectedTypes.size > 0 ? '#2D9CAE' : '#9C9B99' }}>
                          {selectedTypes.size}개 유형 선택됨
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Step 4: Results */}
                  {step === 4 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2" style={{ color: '#2D9CAE' }}>
                        <CheckCircle2 className="w-6 h-6" />
                        <h2 className="text-[15px] font-bold">
                          {assignResults ? '출제 완료!' : '테스트 생성 완료!'}
                        </h2>
                      </div>
                      {assignResults ? (
                        <>
                          <p className="text-[12px] text-text-secondary">
                            {assignResults.length}명에게 문법 테스트가 배정되었습니다.
                          </p>
                          <div className="space-y-2 max-h-[320px] overflow-y-auto">
                            {assignResults.map((a) => (
                              <div
                                key={a.assignment_id}
                                className="flex items-center justify-between rounded-lg"
                                style={{ padding: '10px 14px', backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                              >
                                <span className="text-[12px] font-semibold" style={{ color: '#3D3D3C' }}>{a.student_name}</span>
                                <div className="flex items-center gap-2">
                                  <code className="text-[12px] font-mono font-bold tracking-wider" style={{ color: '#2D9CAE' }}>
                                    {a.test_code}
                                  </code>
                                  <button
                                    onClick={() => handleCopyCode(a.test_code)}
                                    className="p-1 rounded hover:bg-white/60 transition-colors"
                                  >
                                    {copiedCode === a.test_code ? (
                                      <Check className="w-3.5 h-3.5" style={{ color: '#2D9CAE' }} />
                                    ) : (
                                      <Copy className="w-3.5 h-3.5 text-text-tertiary" />
                                    )}
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-[12px] text-text-secondary">
                          테스트가 생성되었습니다. &ldquo;생성된 테스트&rdquo; 탭에서 학생에게 배정하세요.
                        </p>
                      )}
                      <button
                        onClick={resetWizard}
                        className="flex items-center justify-center gap-2 rounded-[10px] text-[13px] font-semibold text-white transition-all hover:opacity-90"
                        style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)', padding: '10px 24px' }}
                      >
                        새 테스트 출제하기
                      </button>
                    </div>
                  )}
                </div>

                {/* Navigation */}
                {step < 4 && (
                  <div
                    className="flex items-center justify-between"
                    style={{ padding: '14px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
                  >
                    {step > 0 ? (
                      <button
                        onClick={() => setStep(Math.max(0, step - 1) as Step)}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg text-[13px] font-semibold transition-all"
                        style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', color: '#6D6C6A' }}
                      >
                        <ChevronLeft className="w-4 h-4" />
                        이전
                      </button>
                    ) : (
                      <div />
                    )}

                    {step < 3 ? (
                      <button
                        onClick={() => setStep((step + 1) as Step)}
                        disabled={!canProceed()}
                        className="flex items-center gap-1 px-4 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)' }}
                      >
                        다음
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button
                        onClick={handleCreateConfig}
                        disabled={!canProceed() || isSubmitting}
                        className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                        style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)' }}
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                        {selectedStudents.size > 0 ? '출제하기' : '테스트 생성하기'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Preview panel */}
            <div className="flex-1 min-w-0 sticky top-4">
              <div
                className="rounded-2xl overflow-hidden flex flex-col"
                style={{ border: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <div
                  className="flex items-center gap-2.5 shrink-0"
                  style={{ padding: '16px 28px', borderBottom: '1px solid #E8E8E6' }}
                >
                  <Info className="w-4 h-4" style={{ color: '#2D9CAE' }} />
                  <span className="text-[15px] font-bold text-text-primary">설정 미리보기</span>
                </div>

                <div className="flex-1 overflow-y-auto" style={{ padding: '24px 28px' }}>
                  <div className="space-y-4">
                    <div>
                      <div className="text-[11px] font-semibold text-text-secondary mb-1.5">테스트 이름</div>
                      <input
                        type="text"
                        value={configName}
                        onChange={(e) => setConfigName(e.target.value)}
                        placeholder="테스트 이름 (자동생성)"
                        className="w-full rounded-lg text-[13px] font-semibold text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-[#2D9CAE]/30"
                        style={{ padding: '8px 12px', border: '1px solid #E8E8E6', backgroundColor: '#FFFFFF' }}
                      />
                    </div>
                    <PreviewRow label="선택된 학생" value={selectedStudents.size > 0 ? `${selectedStudents.size}명` : '테스트만 생성'} isEmpty={selectedStudents.size === 0} />
                    <div>
                      <div className="text-[11px] font-semibold text-text-secondary mb-1">교재</div>
                      {selectedBookNames.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {selectedBookNames.map((name) => (
                            <span
                              key={name}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#EEF7F8', color: '#1A7A8A' }}
                            >
                              {name}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[13px] text-text-tertiary">미선택</span>
                      )}
                    </div>
                    <PreviewRow label="챕터" value={selectedChapterCount > 0 ? `${selectedChapterCount}개 선택` : '전체'} isEmpty={false} />
                    <PreviewRow label="문제 수" value={`${questionCount === -1 ? (parseInt(customQuestionCount) || 0) : questionCount}문제`} />
                    <PreviewRow label="시간 설정" value={timeSummary} />
                    <PreviewRow label="예상 소요 시간" value={estimatedTime} />
                    <div>
                      <div className="text-[11px] font-semibold text-text-secondary mb-1">문제 유형</div>
                      {selectedTypes.size > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {Array.from(selectedTypes).map((t) => (
                            <span
                              key={t}
                              className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: '#EEF7F8', color: '#1A7A8A' }}
                            >
                              {GRAMMAR_TYPE_LABELS[t]}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[13px] text-text-tertiary">미선택</span>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className="shrink-0 space-y-3"
                  style={{ padding: '16px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FFFFFF' }}
                >
                  <button
                    onClick={handleCreateConfig}
                    disabled={selectedBooks.size === 0 || selectedTypes.size === 0 || isSubmitting}
                    className="w-full flex items-center justify-center rounded-[10px] text-sm font-semibold text-white transition-all shadow-sm disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90"
                    style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)', padding: '12px 24px' }}
                  >
                    {isSubmitting ? '생성 중...' : selectedStudents.size > 0 ? '테스트 출제하기' : '테스트 생성하기'}
                  </button>
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-text-tertiary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-text-tertiary leading-relaxed">
                      {selectedStudents.size > 0
                        ? '선택한 학생에게 문법 테스트가 즉시 출제됩니다'
                        : '테스트만 먼저 생성하고, 나중에 학생에게 배정할 수 있습니다'}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ══ Tab: 생성된 테스트 ══ */}
        {activeTab === 'configs' && (
          <GrammarConfigList
            configs={configs}
            onAssign={(cfg) => setAssignModalConfig(cfg)}
            onDelete={handleDeleteConfig}
          />
        )}

        {/* ══ Tab: 출제 현황 ══ */}
        {activeTab === 'status' && (
          <GrammarAssignmentTable assignments={assignments} />
        )}

        {/* Assign modal */}
        {assignModalConfig && (
          <GrammarAssignModal
            config={assignModalConfig}
            students={students}
            existingAssignmentStudentIds={
              new Set(assignments.filter(a => a.config_name === assignModalConfig.name).map(a => a.student_id))
            }
            onClose={() => setAssignModalConfig(null)}
            onAssigned={async () => {
              setAssignModalConfig(null);
              await refreshData();
            }}
          />
        )}
      </div>
    </TeacherLayout>
  );
}

// ── Sub-components ─────────────────────────────────────────────

function GrammarOptionPill({
  selected, onClick, children,
}: {
  selected: boolean; onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center justify-center rounded-lg text-[12px] whitespace-nowrap shrink-0 transition-all"
      style={{
        padding: '7px 12px',
        backgroundColor: selected ? '#EBF8FA' : '#F8F8F6',
        border: selected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
        color: selected ? '#2D9CAE' : '#6D6C6A',
        fontWeight: selected ? 700 : 500,
      }}
    >
      {children}
    </button>
  );
}

function PreviewRow({ label, value, isEmpty = false }: { label: string; value: string; isEmpty?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold text-text-secondary">{label}</span>
      <span className={`text-[13px] font-semibold ${isEmpty ? 'text-text-tertiary' : 'text-text-primary'}`}>
        {value}
      </span>
    </div>
  );
}

function GrammarConfigList({
  configs,
  onAssign,
  onDelete,
}: {
  configs: GrammarConfig[];
  onAssign: (cfg: GrammarConfig) => void;
  onDelete: (id: string) => void;
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(0);

  useEffect(() => setPage(0), [configs.length, searchQuery]);

  const filtered = searchQuery.trim()
    ? configs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : configs;

  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = page * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const pageData = filtered.slice(startIdx, endIdx);

  return (
    <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E8E6' }}>
      <div className="flex items-center justify-between" style={{ padding: '20px 28px' }}>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary font-display">생성된 테스트</h2>
          <p className="text-xs text-text-secondary">생성된 테스트 설정을 학생에게 배정할 수 있습니다.</p>
        </div>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 h-9 rounded-lg"
            style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 12px', width: 200 }}
          >
            <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
            <input
              type="text"
              placeholder="테스트 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <span
            className="text-[11px] font-semibold rounded-full shrink-0"
            style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
          >
            {filtered.length}개
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-tertiary">
          {searchQuery ? '검색 결과가 없습니다' : '생성된 테스트가 없습니다'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F8F6', height: 40, borderTop: '1px solid #E8E8E6', borderBottom: '1px solid #E8E8E6' }}>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-6 pr-2 whitespace-nowrap">테스트 이름</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">문제수</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">시간</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">유형</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">배정</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">생성일</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-2 pr-6 whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((config) => (
                  <tr key={config.id} style={{ borderBottom: '1px solid #E8E8E6', height: 48 }}>
                    <td className="text-xs font-semibold text-text-primary pl-6 pr-2 whitespace-nowrap max-w-[200px] truncate">
                      {config.name}
                    </td>
                    <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                      {config.question_count}문제
                    </td>
                    <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                      {config.time_mode === 'per_question'
                        ? `${config.per_question_seconds ?? 30}초/문제`
                        : `${Math.floor(config.time_limit_seconds / 60)}분`}
                    </td>
                    <td className="text-xs text-text-secondary px-2 max-w-[200px]">
                      <div className="flex flex-wrap items-center gap-1">
                        {config.question_types ? (
                          config.question_types.split(',').map((type) => {
                            const t = type.trim() as GrammarQuestionType;
                            return (
                              <span
                                key={t}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: '#EEF7F8', color: '#1A7A8A' }}
                              >
                                {GRAMMAR_TYPE_LABELS[t] ?? t}
                              </span>
                            );
                          })
                        ) : '-'}
                      </div>
                    </td>
                    <td className="px-2 whitespace-nowrap">
                      <span
                        className="text-[10px] font-semibold rounded-full flex items-center gap-1 w-fit"
                        style={{
                          backgroundColor: (config.assignment_count ?? 0) > 0 ? '#EBF8FA' : '#F8F8F6',
                          color: (config.assignment_count ?? 0) > 0 ? '#2D9CAE' : '#9C9B99',
                          padding: '3px 10px',
                        }}
                      >
                        <Users className="w-3 h-3" />
                        {config.assignment_count ?? 0}명
                      </span>
                    </td>
                    <td className="text-[11px] text-text-tertiary px-2 whitespace-nowrap">
                      {formatDate(config.created_at ?? null)}
                    </td>
                    <td className="pl-2 pr-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onAssign(config)}
                          className="flex items-center gap-1 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                          style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)', padding: '5px 12px' }}
                        >
                          <Plus className="w-3 h-3" />
                          배정
                        </button>
                        {(config.assignment_count ?? 0) === 0 && (
                          <button
                            onClick={() => onDelete(config.id)}
                            className="hover:opacity-70 transition-opacity"
                            title="삭제"
                          >
                            <Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
          >
            <span className="text-[11px] text-text-tertiary">
              {startIdx + 1}-{endIdx} / {filtered.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronLeft className="w-4 h-4 text-text-secondary" />
              </button>
              <span className="text-[11px] font-medium text-text-secondary">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GrammarAssignmentTable({ assignments }: { assignments: GrammarAssignmentItem[] }) {
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 10;
  const totalPages = Math.max(1, Math.ceil(assignments.length / PAGE_SIZE));
  const startIdx = page * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, assignments.length);
  const pageData = assignments.slice(startIdx, endIdx);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const handleCopy = async (code: string) => {
    await navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  return (
    <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid #E8E8E6' }}>
      <div className="flex items-center justify-between" style={{ padding: '20px 28px' }}>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary font-display">출제 현황</h2>
          <p className="text-xs text-text-secondary">학생별 문법 테스트 배정 현황을 확인합니다.</p>
        </div>
        <span
          className="text-[11px] font-semibold rounded-full"
          style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
        >
          {assignments.length}건
        </span>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-tertiary">배정된 문법 테스트가 없습니다.</div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 700 }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F8F6', height: 40, borderTop: '1px solid #E8E8E6', borderBottom: '1px solid #E8E8E6' }}>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-6 pr-2 whitespace-nowrap">학생</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">학교</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">테스트</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">코드</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">상태</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">배정일</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-2 pr-6 whitespace-nowrap">완료일</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((a) => {
                  const st = STATUS_LABELS[a.status] ?? { label: a.status, bg: '#F0F0EE', color: '#6D6C6A' };
                  return (
                    <tr key={a.id} style={{ borderBottom: '1px solid #E8E8E6', height: 48 }}>
                      <td className="text-xs font-semibold text-text-primary pl-6 pr-2 whitespace-nowrap">{a.student_name}</td>
                      <td className="text-[11px] text-text-secondary px-2 whitespace-nowrap">
                        {[a.student_school, a.student_grade].filter(Boolean).join(' ') || '-'}
                      </td>
                      <td className="text-xs text-text-secondary px-2 whitespace-nowrap max-w-[150px] truncate">
                        {a.config_name ?? '-'}
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          <code className="text-[12px] font-mono font-bold tracking-wider" style={{ color: '#2D9CAE' }}>
                            {a.test_code}
                          </code>
                          <button
                            onClick={() => handleCopy(a.test_code)}
                            className="p-0.5 rounded hover:bg-gray-100 transition-colors"
                          >
                            {copiedCode === a.test_code ? (
                              <Check className="w-3 h-3" style={{ color: '#2D9CAE' }} />
                            ) : (
                              <Copy className="w-3 h-3 text-text-tertiary" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: st.bg, color: st.color }}
                        >
                          {st.label}
                        </span>
                      </td>
                      <td className="text-[11px] text-text-tertiary px-2 whitespace-nowrap">{formatDate(a.assigned_at)}</td>
                      <td className="text-[11px] text-text-tertiary pl-2 pr-6 whitespace-nowrap">{formatDate(a.completed_at)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
          >
            <span className="text-[11px] text-text-tertiary">
              {startIdx + 1}-{endIdx} / {assignments.length}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(p - 1, 0))}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronLeft className="w-4 h-4 text-text-secondary" />
              </button>
              <span className="text-[11px] font-medium text-text-secondary">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(p + 1, totalPages - 1))}
                disabled={page >= totalPages - 1}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronRight className="w-4 h-4 text-text-secondary" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function GrammarAssignModal({
  config,
  students,
  existingAssignmentStudentIds,
  onClose,
  onAssigned,
}: {
  config: GrammarConfig;
  students: User[];
  existingAssignmentStudentIds: Set<string>;
  onClose: () => void;
  onAssigned: () => void;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const alreadyAssigned = existingAssignmentStudentIds;

  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.school_name && s.school_name.toLowerCase().includes(term))
    );
  }, [students, search]);

  const selectableFiltered = useMemo(
    () => filtered.filter((s) => !alreadyAssigned.has(s.id)),
    [filtered, alreadyAssigned]
  );

  const allSelectableSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((s) => selectedIds.has(s.id));

  const toggleStudent = (id: string) => {
    if (alreadyAssigned.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelectableSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableFiltered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableFiltered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const handleAssign = async () => {
    if (selectedIds.size === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setErrorMsg('');
    try {
      await grammarTestService.assignStudents(config.id, [...selectedIds]);
      onAssigned();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setErrorMsg('이미 배정된 학생이 포함되어 있습니다.');
      } else {
        setErrorMsg('배정 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.4)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg flex flex-col overflow-hidden shadow-xl"
        style={{ maxHeight: '80vh', border: '1px solid #E8E8E6' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '18px 24px', borderBottom: '1px solid #E8E8E6' }}
        >
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-text-primary truncate">{config.name}</h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {config.question_count}문제 &middot;{' '}
              {config.time_mode === 'per_question'
                ? `${config.per_question_seconds ?? 30}초/문제`
                : `${Math.floor(config.time_limit_seconds / 60)}분`}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>

        <div className="shrink-0" style={{ padding: '14px 24px 0' }}>
          <div
            className="flex items-center gap-2.5 h-10 rounded-[10px] mb-3"
            style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 14px' }}
          >
            <Search className="w-4 h-4 text-text-tertiary shrink-0" />
            <input
              type="text"
              placeholder="이름 또는 학교로 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-text-secondary">
              {filtered.length}명 표시
              {alreadyAssigned.size > 0 && (
                <span className="ml-1" style={{ color: '#9C9B99' }}>(배정됨 {alreadyAssigned.size})</span>
              )}
            </span>
            <button onClick={toggleAll} className="flex items-center gap-1.5">
              <span
                className="w-4 h-4 rounded flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: allSelectableSelected ? '#2D9CAE' : 'transparent',
                  border: allSelectableSelected ? 'none' : '2px solid #E8E8E6',
                }}
              >
                {allSelectableSelected && <Check className="w-2.5 h-2.5 text-white" />}
              </span>
              <span className="text-[11px] font-medium text-text-secondary">전체</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5" style={{ padding: '0 24px 14px' }}>
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-tertiary">
              {search ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
            </div>
          ) : (
            filtered.map((student) => {
              const isAlreadyAssigned = alreadyAssigned.has(student.id);
              const isSelected = isAlreadyAssigned || selectedIds.has(student.id);
              const schoolInfo = [student.school_name, student.grade].filter(Boolean).join(' ');
              return (
                <button
                  key={student.id}
                  onClick={() => toggleStudent(student.id)}
                  disabled={isAlreadyAssigned}
                  className="w-full flex items-center gap-3 rounded-[10px] transition-colors text-left"
                  style={{
                    backgroundColor: isAlreadyAssigned ? '#F3F3F1' : isSelected ? '#EBF8FA' : '#F8F8F6',
                    border: isAlreadyAssigned ? '1px solid #E8E8E6' : isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                    padding: isSelected && !isAlreadyAssigned ? '9px 15px' : '10px 16px',
                    opacity: isAlreadyAssigned ? 0.55 : 1,
                    cursor: isAlreadyAssigned ? 'not-allowed' : 'pointer',
                  }}
                >
                  <span
                    className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isSelected ? (isAlreadyAssigned ? '#B0AFAD' : '#2D9CAE') : 'transparent',
                      border: isSelected ? 'none' : '2px solid #E8E8E6',
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[13px] font-semibold block truncate"
                      style={{ color: isAlreadyAssigned ? '#9C9B99' : isSelected ? '#2D9CAE' : '#3D3D3C' }}
                    >
                      {student.name}
                    </span>
                    {schoolInfo && (
                      <span className="text-[10px] block truncate" style={{ color: '#9C9B99' }}>{schoolInfo}</span>
                    )}
                  </div>
                  {isAlreadyAssigned && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: '#F0F0EE', color: '#9C9B99' }}
                    >
                      배정됨
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
        >
          <div>
            {errorMsg && <p className="text-[11px] text-red-500 mb-1">{errorMsg}</p>}
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" style={{ color: selectedIds.size > 0 ? '#2D9CAE' : '#9C9B99' }} />
              <span className="text-[11px] font-medium" style={{ color: selectedIds.size > 0 ? '#2D9CAE' : '#9C9B99' }}>
                {selectedIds.size}명 선택됨
              </span>
            </div>
          </div>
          <button
            onClick={handleAssign}
            disabled={selectedIds.size === 0 || isSubmitting}
            className="flex items-center justify-center rounded-[10px] text-[13px] font-semibold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
            style={{ background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)', padding: '8px 20px' }}
          >
            {isSubmitting ? '배정 중...' : `${selectedIds.size}명에게 배정하기`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default GrammarSettingsPage;
