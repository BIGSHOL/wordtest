/**
 * Grammar test settings page for teachers.
 * Allows creating grammar test configs, selecting books/chapters, and assigning to students.
 */
import { useState, useEffect } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { studentService } from '../../services/student';
import { grammarTestService } from '../../services/grammarTest';
import type { User } from '../../types/auth';
import type { GrammarBook, GrammarChapter, GrammarConfig, GrammarAssignment, GrammarQuestionType } from '../../types/grammar';
import { GRAMMAR_TYPE_LABELS } from '../../types/grammar';
import { logger } from '../../utils/logger';
import {
  BookOpen, Users, Check, ChevronRight, ChevronLeft,
  Clock, Hash, Send, Loader2, Trash2, Copy, CheckCircle2,
  Settings, ListChecks, GraduationCap,
} from 'lucide-react';

const ALL_QUESTION_TYPES: GrammarQuestionType[] = [
  'grammar_blank', 'grammar_error', 'grammar_common', 'grammar_usage',
  'grammar_transform', 'grammar_order', 'grammar_translate', 'grammar_pair',
];

type Tab = 'create' | 'configs';
type Step = 0 | 1 | 2 | 3 | 4;

export function GrammarSettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('create');

  // Data
  const [students, setStudents] = useState<User[]>([]);
  const [books, setBooks] = useState<GrammarBook[]>([]);
  const [chapters, setChapters] = useState<Record<string, GrammarChapter[]>>({});
  const [configs, setConfigs] = useState<GrammarConfig[]>([]);

  // Wizard state
  const [step, setStep] = useState<Step>(0);
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set());
  const [selectedBooks, setSelectedBooks] = useState<Set<string>>(new Set());
  const [selectedChapters, setSelectedChapters] = useState<Set<string>>(new Set());
  const [questionCount, setQuestionCount] = useState(20);
  const [timeMode, setTimeMode] = useState<'per_question' | 'total'>('per_question');
  const [perQuestionTime, setPerQuestionTime] = useState(30);
  const [totalTime, setTotalTime] = useState(600);
  const [selectedTypes, setSelectedTypes] = useState<Set<GrammarQuestionType>>(new Set(ALL_QUESTION_TYPES));
  const [configName, setConfigName] = useState('');

  // UI
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignResults, setAssignResults] = useState<GrammarAssignment[] | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Load data — each call independent so one failure doesn't block others
  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      // Students (always available)
      try {
        const studentData = await studentService.listStudents();
        setStudents(studentData);
      } catch (error) {
        logger.error('Failed to load students:', error);
      }
      // Books (may fail if grammar tables don't exist yet)
      try {
        const bookData = await grammarTestService.listBooks();
        setBooks(bookData);
      } catch (error) {
        logger.error('Failed to load grammar books:', error);
      }
      // Configs
      try {
        const configData = await grammarTestService.listConfigs();
        setConfigs(configData);
      } catch (error) {
        logger.error('Failed to load grammar configs:', error);
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
          newChapters[bookId] = await grammarTestService.listChapters(bookId);
        }
      }
      if (Object.keys(newChapters).length > 0) {
        setChapters((prev) => ({ ...prev, ...newChapters }));
      }
    };
    if (selectedBooks.size > 0) loadChapters();
  }, [selectedBooks]);

  const toggleStudent = (id: string) => {
    setSelectedStudents((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAllStudents = () => {
    if (selectedStudents.size === students.length) {
      setSelectedStudents(new Set());
    } else {
      setSelectedStudents(new Set(students.map((s) => s.id)));
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

  const handleSubmit = async () => {
    if (selectedStudents.size === 0 || selectedBooks.size === 0 || selectedTypes.size === 0) return;

    setIsSubmitting(true);
    try {
      // 1. Create config
      const name = configName || `문법 테스트 ${new Date().toLocaleDateString('ko-KR')}`;
      const config = await grammarTestService.createConfig({
        name,
        book_ids: Array.from(selectedBooks),
        chapter_ids: selectedChapters.size > 0 ? Array.from(selectedChapters) : undefined,
        question_count: questionCount,
        time_limit_seconds: timeMode === 'total' ? totalTime : perQuestionTime * questionCount,
        per_question_seconds: timeMode === 'per_question' ? perQuestionTime : undefined,
        time_mode: timeMode,
        question_types: Array.from(selectedTypes),
      });

      // 2. Assign to students
      const result = await grammarTestService.assignStudents(
        config.id,
        Array.from(selectedStudents),
      );
      setAssignResults(result.assignments);
      setConfigs((prev) => [config, ...prev]);
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
    try {
      await grammarTestService.deleteConfig(configId);
      setConfigs((prev) => prev.filter((c) => c.id !== configId));
    } catch (error) {
      logger.error('Failed to delete config:', error);
    }
  };

  const resetWizard = () => {
    setStep(0);
    setSelectedStudents(new Set());
    setSelectedBooks(new Set());
    setSelectedChapters(new Set());
    setSelectedTypes(new Set(ALL_QUESTION_TYPES));
    setQuestionCount(20);
    setConfigName('');
    setAssignResults(null);
  };

  const canProceed = () => {
    switch (step) {
      case 0: return selectedStudents.size > 0;
      case 1: return selectedBooks.size > 0;
      case 2: return true;
      case 3: return selectedTypes.size > 0;
      default: return false;
    }
  };

  // Step labels for the progress indicator
  const STEPS = ['학생 선택', '교재 선택', '시간 설정', '문제 유형', '완료'];

  return (
    <TeacherLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-teal" />
              문법 테스트
            </h1>
            <p className="text-sm text-text-secondary mt-1">
              천일문 GRAMMAR 기반 문법 시험 출제
            </p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg-surface rounded-xl p-1 border border-border-subtle w-fit">
          {[
            { key: 'create' as Tab, label: '테스트 출제', icon: Send },
            { key: 'configs' as Tab, label: '생성된 테스트', icon: ListChecks },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => { setActiveTab(key); if (key === 'create') resetWizard(); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === key
                  ? 'bg-teal text-white'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'create' ? (
          <div className="bg-bg-surface rounded-2xl border border-border-subtle overflow-hidden">
            {/* Progress bar */}
            <div className="flex items-center gap-0 px-6 pt-5 pb-4">
              {STEPS.map((label, i) => (
                <div key={i} className="flex items-center">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                        i < step ? 'bg-teal text-white'
                        : i === step ? 'bg-accent-indigo text-white'
                        : 'bg-gray-200 text-text-tertiary'
                      }`}
                    >
                      {i < step ? <Check className="w-4 h-4" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${
                      i <= step ? 'text-text-primary' : 'text-text-tertiary'
                    }`}>
                      {label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`w-8 h-0.5 mx-2 ${i < step ? 'bg-teal' : 'bg-gray-200'}`} />
                  )}
                </div>
              ))}
            </div>

            <div className="px-6 pb-6">
              {/* Step 0: Student selection */}
              {step === 0 && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                      <Users className="w-5 h-5 text-teal" />
                      학생 선택
                    </h2>
                    <button
                      onClick={toggleAllStudents}
                      className="text-sm text-teal hover:text-teal/80 font-medium"
                    >
                      {selectedStudents.size === students.length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-[400px] overflow-y-auto">
                    {students.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => toggleStudent(s.id)}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors text-left ${
                          selectedStudents.has(s.id)
                            ? 'bg-teal/5 border-teal text-text-primary'
                            : 'bg-white border-border-subtle hover:bg-bg-muted'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                          selectedStudents.has(s.id) ? 'bg-teal border-teal' : 'border-gray-300'
                        }`}>
                          {selectedStudents.has(s.id) && <Check className="w-3 h-3 text-white" />}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{s.name}</p>
                          <p className="text-xs text-text-tertiary">{s.school_name || ''} {s.grade || ''}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {selectedStudents.size}명 선택됨
                  </p>
                </div>
              )}

              {/* Step 1: Book & Chapter selection */}
              {step === 1 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-teal" />
                    교재 / 챕터 선택
                  </h2>
                  <div className="space-y-3">
                    {books.map((book) => (
                      <div key={book.id} className="border border-border-subtle rounded-xl overflow-hidden">
                        <button
                          onClick={() => toggleBook(book.id)}
                          className={`flex items-center gap-3 w-full px-4 py-3 transition-colors ${
                            selectedBooks.has(book.id) ? 'bg-teal/5' : 'bg-white hover:bg-bg-muted'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            selectedBooks.has(book.id) ? 'bg-teal border-teal' : 'border-gray-300'
                          }`}>
                            {selectedBooks.has(book.id) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <span className="text-sm font-semibold text-text-primary">{book.title}</span>
                        </button>
                        {selectedBooks.has(book.id) && chapters[book.id] && (
                          <div className="border-t border-border-subtle px-4 py-3 bg-bg-muted/50">
                            <p className="text-xs text-text-secondary mb-2">
                              챕터를 선택하세요 (미선택 시 전체 출제)
                            </p>
                            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
                              {chapters[book.id].map((ch) => (
                                <button
                                  key={ch.id}
                                  onClick={() => toggleChapter(ch.id)}
                                  className={`text-xs px-3 py-2 rounded-lg border transition-colors ${
                                    selectedChapters.has(ch.id)
                                      ? 'bg-accent-indigo/10 border-accent-indigo text-accent-indigo font-semibold'
                                      : 'bg-white border-border-subtle hover:bg-bg-muted text-text-secondary'
                                  }`}
                                >
                                  Ch {ch.chapter_num}. {ch.title}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 2: Time & Question count */}
              {step === 2 && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <Settings className="w-5 h-5 text-teal" />
                    시간 / 문제 수 설정
                  </h2>

                  {/* Question count */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Hash className="w-4 h-4 text-text-tertiary" />
                      문제 수
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {[10, 15, 20, 25, 30].map((n) => (
                        <button
                          key={n}
                          onClick={() => setQuestionCount(n)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                            questionCount === n
                              ? 'bg-teal text-white border-teal'
                              : 'bg-white border-border-subtle hover:bg-bg-muted'
                          }`}
                        >
                          {n}문제
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Time mode */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Clock className="w-4 h-4 text-text-tertiary" />
                      시간 모드
                    </label>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setTimeMode('per_question')}
                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                          timeMode === 'per_question'
                            ? 'bg-teal/5 border-teal text-teal'
                            : 'bg-white border-border-subtle hover:bg-bg-muted'
                        }`}
                      >
                        문제당 시간제한
                      </button>
                      <button
                        onClick={() => setTimeMode('total')}
                        className={`flex-1 px-4 py-3 rounded-xl border text-sm font-medium transition-colors ${
                          timeMode === 'total'
                            ? 'bg-teal/5 border-teal text-teal'
                            : 'bg-white border-border-subtle hover:bg-bg-muted'
                        }`}
                      >
                        전체 시간제한
                      </button>
                    </div>
                  </div>

                  {/* Time value */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary">
                      {timeMode === 'per_question' ? '문제당 시간 (초)' : '전체 시간 (분)'}
                    </label>
                    <div className="flex gap-2 flex-wrap">
                      {timeMode === 'per_question' ? (
                        [15, 20, 30, 45, 60].map((n) => (
                          <button
                            key={n}
                            onClick={() => setPerQuestionTime(n)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              perQuestionTime === n
                                ? 'bg-teal text-white border-teal'
                                : 'bg-white border-border-subtle hover:bg-bg-muted'
                            }`}
                          >
                            {n}초
                          </button>
                        ))
                      ) : (
                        [5, 10, 15, 20, 30].map((n) => (
                          <button
                            key={n}
                            onClick={() => setTotalTime(n * 60)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                              totalTime === n * 60
                                ? 'bg-teal text-white border-teal'
                                : 'bg-white border-border-subtle hover:bg-bg-muted'
                            }`}
                          >
                            {n}분
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Config name */}
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-text-primary">테스트 이름 (선택)</label>
                    <input
                      type="text"
                      value={configName}
                      onChange={(e) => setConfigName(e.target.value)}
                      placeholder="예: 1학기 중간고사 문법"
                      className="w-full px-4 py-2.5 rounded-xl border border-border-subtle text-sm focus:outline-none focus:border-teal"
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Question types */}
              {step === 3 && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                    <ListChecks className="w-5 h-5 text-teal" />
                    문제 유형 선택
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    {ALL_QUESTION_TYPES.map((t) => {
                      const isObj = ['grammar_transform', 'grammar_order', 'grammar_translate'].includes(t);
                      return (
                        <button
                          key={t}
                          onClick={() => toggleType(t)}
                          className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border transition-colors text-left ${
                            selectedTypes.has(t)
                              ? 'bg-teal/5 border-teal'
                              : 'bg-white border-border-subtle hover:bg-bg-muted'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded flex items-center justify-center border ${
                            selectedTypes.has(t) ? 'bg-teal border-teal' : 'border-gray-300'
                          }`}>
                            {selectedTypes.has(t) && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-text-primary">{GRAMMAR_TYPE_LABELS[t]}</p>
                            <p className="text-xs text-text-tertiary">
                              {isObj ? '서술형' : '객관식'}
                            </p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {selectedTypes.size}개 유형 선택됨
                  </p>
                </div>
              )}

              {/* Step 4: Results */}
              {step === 4 && assignResults && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-teal">
                    <CheckCircle2 className="w-6 h-6" />
                    <h2 className="text-lg font-semibold">출제 완료!</h2>
                  </div>
                  <p className="text-sm text-text-secondary">
                    {assignResults.length}명에게 문법 테스트가 배정되었습니다.
                  </p>
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {assignResults.map((a) => (
                      <div
                        key={a.assignment_id}
                        className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-border-subtle"
                      >
                        <span className="text-sm font-medium text-text-primary">{a.student_name}</span>
                        <div className="flex items-center gap-2">
                          <code className="text-sm font-mono font-bold text-accent-indigo tracking-wider">
                            {a.test_code}
                          </code>
                          <button
                            onClick={() => handleCopyCode(a.test_code)}
                            className="p-1 rounded hover:bg-bg-muted transition-colors"
                            title="코드 복사"
                          >
                            {copiedCode === a.test_code ? (
                              <Check className="w-4 h-4 text-teal" />
                            ) : (
                              <Copy className="w-4 h-4 text-text-tertiary" />
                            )}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={resetWizard}
                    className="px-6 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold hover:bg-teal/90 transition-colors"
                  >
                    새 테스트 출제하기
                  </button>
                </div>
              )}

              {/* Navigation */}
              {step < 4 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t border-border-subtle">
                  <button
                    onClick={() => setStep(Math.max(0, step - 1) as Step)}
                    disabled={step === 0}
                    className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary disabled:opacity-30 transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    이전
                  </button>

                  {step < 3 ? (
                    <button
                      onClick={() => setStep((step + 1) as Step)}
                      disabled={!canProceed()}
                      className="flex items-center gap-1 px-6 py-2.5 rounded-xl bg-teal text-white text-sm font-semibold disabled:opacity-40 hover:bg-teal/90 transition-colors"
                    >
                      다음
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={!canProceed() || isSubmitting}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-accent-indigo text-white text-sm font-semibold disabled:opacity-40 hover:bg-accent-indigo/90 transition-colors"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                      출제하기
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Configs tab */
          <div className="bg-bg-surface rounded-2xl border border-border-subtle p-6 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">생성된 테스트 목록</h2>
            {configs.length === 0 ? (
              <p className="text-sm text-text-tertiary py-8 text-center">아직 생성된 테스트가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {configs.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between px-4 py-3 bg-white rounded-xl border border-border-subtle"
                  >
                    <div>
                      <p className="text-sm font-semibold text-text-primary">{c.name}</p>
                      <p className="text-xs text-text-tertiary">
                        {c.question_count}문제 / {c.time_mode === 'per_question' ? `${c.per_question_seconds}초/문제` : `${Math.floor(c.time_limit_seconds / 60)}분`}
                        {c.question_types && ` / ${c.question_types.split(',').length}개 유형`}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteConfig(c.id)}
                      className="p-2 rounded-lg hover:bg-red-50 text-text-tertiary hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

export default GrammarSettingsPage;
