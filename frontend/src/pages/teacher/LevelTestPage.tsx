/**
 * Level placement test page for teachers.
 *
 * Tab 1 (출제): Shows existing student list with checkboxes.
 * Tab 2 (출제 현황): Shows level test assignment history with status.
 */
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { studentService } from '../../services/student';
import {
  createLevelTest,
  listLevelTestAssignments,
  deleteLevelTestAssignment,
  type LevelTestCreateResponse,
} from '../../services/levelTest';
import { testAssignmentService } from '../../services/testAssignment';
import type { TestAssignmentItem } from '../../services/testAssignment';
import type { User } from '../../types/auth';
import { QTYPE_BADGES } from '../../constants/engineLabels';
import {
  ClipboardCopy,
  Check,
  RefreshCw,
  Copy,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Trash2,
  RotateCcw,
} from 'lucide-react';

const PAGE_SIZE = 10;

/** Build page numbers with ... ellipsis: always show first, last, and ±2 around current. */
function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  const near = new Set<number>();
  for (let i = current - 2; i <= current + 2; i++) {
    if (i >= 1 && i <= total) near.add(i);
  }
  near.add(1);
  near.add(total);
  const sorted = [...near].sort((a, b) => a - b);
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push('...');
    pages.push(sorted[i]);
  }
  return pages;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${day}`;
}

type Tab = 'create' | 'status';
type Phase = 'select' | 'results';

const TAB_ITEMS: { key: Tab; label: string }[] = [
  { key: 'create', label: '출제' },
  { key: 'status', label: '출제 현황' },
];

export function LevelTestPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [phase, setPhase] = useState<Phase>('select');

  // Student list
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Results
  const [result, setResult] = useState<LevelTestCreateResponse | null>(null);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Status tab
  const [assignments, setAssignments] = useState<TestAssignmentItem[]>([]);
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusSearch, setStatusSearch] = useState('');
  const [statusPage, setStatusPage] = useState(0);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Fetch students on mount
  useEffect(() => {
    studentService
      .listStudents()
      .then(setStudents)
      .catch(() => setStudents([]))
      .finally(() => setIsLoading(false));
  }, []);

  const refreshAssignments = useCallback(async () => {
    setStatusLoading(true);
    try {
      const data = await listLevelTestAssignments();
      setAssignments(data);
    } catch (err) {
      console.error('레벨테스트 목록 조회 실패:', err);
      setAssignments([]);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  // Fetch assignments when status tab is activated
  useEffect(() => {
    if (activeTab === 'status') {
      refreshAssignments();
    }
  }, [activeTab, refreshAssignments]);

  // Filtered & paginated (create tab)
  const filtered = useMemo(() => {
    const base = students.filter((s) => !s.name.startsWith('[DUMMY]'));
    if (!searchQuery.trim()) return base;
    const q = searchQuery.trim().toLowerCase();
    return base.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.grade ?? '').toLowerCase().includes(q) ||
        (s.school_name ?? '').toLowerCase().includes(q),
    );
  }, [students, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pagedStudents = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const noGradeSelected = useMemo(() => {
    return students.filter((s) => selectedIds.has(s.id) && !s.grade);
  }, [students, selectedIds]);

  const toggleStudent = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    const pageIds = pagedStudents.map((s) => s.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;
    if (noGradeSelected.length > 0) {
      setError(
        `학년 정보가 없는 학생: ${noGradeSelected.map((s) => s.name).join(', ')}. 학생 관리에서 학년을 먼저 설정해주세요.`,
      );
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const data = await createLevelTest([...selectedIds]);
      setResult(data);
      setPhase('results');
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail ?? '테스트 생성에 실패했습니다.');
      } else {
        setError(err instanceof Error ? err.message : '테스트 생성에 실패했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyCode = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch { /* ignore */ }
  };

  const handleCopyAll = async () => {
    if (!result) return;
    const text = result.students
      .map((s) => `${s.student_name}\t${s.test_code}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    } catch { /* ignore */ }
  };

  const handleReset = () => {
    setPhase('select');
    setSelectedIds(new Set());
    setResult(null);
    setError(null);
    setCopiedIndex(null);
    setCopiedAll(false);
  };

  // Status tab handlers
  const handleStatusCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 1500);
    } catch { /* ignore */ }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteLevelTestAssignment(id);
      await refreshAssignments();
    } catch { /* ignore */ }
  };

  const handleResetAssignment = async (id: string) => {
    try {
      await testAssignmentService.resetAssignment(id);
      await refreshAssignments();
    } catch { /* ignore */ }
  };

  const handleViewResult = (item: TestAssignmentItem) => {
    if (item.learning_session_id) {
      navigate(`/students/${item.student_id}/mastery/${item.learning_session_id}`);
    } else {
      navigate(`/students/${item.student_id}/results`);
    }
  };

  // Status tab filtered & paginated
  const statusFiltered = useMemo(() => {
    if (!statusSearch.trim()) return assignments;
    const q = statusSearch.trim().toLowerCase();
    return assignments.filter(
      (item) =>
        item.student_name.toLowerCase().includes(q) ||
        (item.test_code && item.test_code.toLowerCase().includes(q)) ||
        (item.student_school && item.student_school.toLowerCase().includes(q)),
    );
  }, [assignments, statusSearch]);

  const statusTotalPages = Math.max(1, Math.ceil(statusFiltered.length / PAGE_SIZE));
  const statusStartIdx = statusPage * PAGE_SIZE;
  const statusEndIdx = Math.min(statusStartIdx + PAGE_SIZE, statusFiltered.length);
  const statusPageData = statusFiltered.slice(statusStartIdx, statusEndIdx);

  useEffect(() => setStatusPage(0), [statusSearch, assignments.length]);

  const allPageSelected =
    pagedStudents.length > 0 && pagedStudents.every((s) => selectedIds.has(s.id));

  return (
    <TeacherLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="font-word text-[26px] font-extrabold text-text-primary mb-1">
            레벨테스트
          </h1>
          <p className="text-sm text-text-secondary">
            학생을 선택하면 학년에 맞는 레벨테스트 코드를 자동 발급합니다
          </p>
        </div>

        {/* Tab navigation */}
        <div
          className="flex rounded-xl overflow-hidden"
          style={{ border: '1px solid #E8E8E6', backgroundColor: '#F8F8F6' }}
        >
          {TAB_ITEMS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex-1 py-3 text-[14px] font-semibold transition-all relative"
              style={{
                backgroundColor: activeTab === tab.key ? '#FFFFFF' : 'transparent',
                color: activeTab === tab.key ? '#2D9CAE' : '#9C9B99',
                borderBottom: activeTab === tab.key ? '2px solid #2D9CAE' : '2px solid transparent',
              }}
            >
              {tab.label}
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

        {/* ─── Tab: 출제 ─── */}
        {activeTab === 'create' && (
          <>
            {/* Phase 1: Student selection */}
            {phase === 'select' && (
              <div className="space-y-4">
                <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
                  {/* Search + selected count */}
                  <div className="px-5 py-3 border-b border-border-subtle flex items-center gap-3">
                    <div className="flex-1 relative">
                      <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary"
                      />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="이름, 학년, 학교로 검색"
                        className="w-full h-9 pl-9 pr-3 rounded-lg border border-border-subtle bg-[#F8F8F6] text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-teal/30 focus:border-teal transition-colors"
                      />
                    </div>
                    {selectedIds.size > 0 && (
                      <div
                        className="px-3 py-1.5 rounded-full text-xs font-semibold shrink-0"
                        style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                      >
                        {selectedIds.size}명 선택
                      </div>
                    )}
                  </div>

                  {/* Table */}
                  {isLoading ? (
                    <div className="flex items-center justify-center py-16">
                      <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="text-center py-16 text-sm text-text-tertiary">
                      {students.length === 0 ? '등록된 학생이 없습니다' : '검색 결과가 없습니다'}
                    </div>
                  ) : (
                    <>
                      <table className="w-full text-sm">
                        <thead>
                          <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6' }}>
                            <th className="w-12 px-4 py-3">
                              <input
                                type="checkbox"
                                checked={allPageSelected}
                                onChange={toggleAllOnPage}
                                className="w-4 h-4 rounded accent-[#2D9CAE]"
                              />
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                              이름
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                              학년
                            </th>
                            <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                              학교
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {pagedStudents.map((student, idx) => {
                            const isSelected = selectedIds.has(student.id);
                            return (
                              <tr
                                key={student.id}
                                onClick={() => toggleStudent(student.id)}
                                className="cursor-pointer transition-colors hover:bg-[#FAFAF8]"
                                style={{
                                  backgroundColor: isSelected ? '#F0FAF8' : undefined,
                                  borderBottom:
                                    idx < pagedStudents.length - 1
                                      ? '1px solid #F0F0EE'
                                      : undefined,
                                }}
                              >
                                <td className="w-12 px-4 py-3">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleStudent(student.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-4 h-4 rounded accent-[#2D9CAE]"
                                  />
                                </td>
                                <td className="px-4 py-3 font-medium text-text-primary">
                                  {student.name}
                                </td>
                                <td className="px-4 py-3 text-text-secondary">
                                  {student.grade ? (
                                    student.grade
                                  ) : (
                                    <span className="text-orange-400 text-xs flex items-center gap-1">
                                      <AlertCircle className="w-3 h-3" />
                                      미설정
                                    </span>
                                  )}
                                </td>
                                <td className="px-4 py-3 text-text-tertiary">
                                  {student.school_name || '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {totalPages > 1 && (
                        <div className="flex items-center justify-between px-5 py-3 border-t border-border-subtle">
                          <span className="text-xs text-text-tertiary whitespace-nowrap">
                            {filtered.length}명 중 {(currentPage - 1) * PAGE_SIZE + 1}-
                            {Math.min(currentPage * PAGE_SIZE, filtered.length)}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className="p-1.5 rounded-lg hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronLeft className="w-4 h-4 text-text-secondary" />
                            </button>
                            {getPageNumbers(currentPage, totalPages).map((page, i) =>
                              page === '...' ? (
                                <span key={`dot-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-text-tertiary">
                                  ...
                                </span>
                              ) : (
                                <button
                                  key={page}
                                  onClick={() => setCurrentPage(page as number)}
                                  className="w-8 h-8 rounded-lg text-xs font-medium transition-colors"
                                  style={{
                                    backgroundColor: page === currentPage ? '#2D9CAE' : 'transparent',
                                    color: page === currentPage ? '#FFFFFF' : '#6D6C6A',
                                  }}
                                >
                                  {page}
                                </button>
                              ),
                            )}
                            <button
                              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                              disabled={currentPage === totalPages}
                              className="p-1.5 rounded-lg hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                            >
                              <ChevronRight className="w-4 h-4 text-text-secondary" />
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Error */}
                {error && (
                  <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600 whitespace-pre-wrap">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleSubmit}
                  disabled={selectedIds.size === 0 || isSubmitting}
                  className="w-full h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: selectedIds.size > 0 ? '#2D9CAE' : '#E8E8E6',
                    color: selectedIds.size > 0 ? '#FFFFFF' : '#9C9B99',
                    cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
                  }}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      생성 중...
                    </>
                  ) : (
                    <>
                      <ClipboardCopy className="w-4 h-4" />
                      테스트 코드 발급 ({selectedIds.size}명)
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Phase 2: Results */}
            {phase === 'results' && result && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="bg-white border border-border-subtle rounded-2xl p-5">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-text-primary">
                      레벨테스트 | {result.question_count}문제
                    </h2>
                    <div
                      className="px-3 py-1.5 rounded-full text-xs font-semibold"
                      style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
                    >
                      {result.students.length}명
                    </div>
                  </div>
                </div>

                {/* Results table */}
                <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ backgroundColor: '#F8F8F6', borderBottom: '1px solid #E8E8E6' }}>
                        <th className="text-left px-5 py-3 text-xs font-semibold text-text-tertiary w-10">
                          #
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                          학생 이름
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                          학년
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                          범위
                        </th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-text-tertiary">
                          테스트 코드
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.students.map((student, idx) => (
                        <tr
                          key={student.student_id}
                          style={{
                            borderBottom:
                              idx < result.students.length - 1 ? '1px solid #F0F0EE' : undefined,
                          }}
                        >
                          <td className="px-5 py-3.5 text-text-tertiary text-xs">{idx + 1}</td>
                          <td className="px-4 py-3.5 font-medium text-text-primary">
                            {student.student_name}
                          </td>
                          <td className="px-4 py-3.5 text-text-secondary text-xs">{student.grade}</td>
                          <td className="px-4 py-3.5 text-text-tertiary text-xs">
                            {student.level_range}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex items-center gap-2">
                              <span
                                className="font-mono text-base font-bold tracking-widest"
                                style={{ color: '#2D9CAE' }}
                              >
                                {student.test_code}
                              </span>
                              <button
                                onClick={() => handleCopyCode(student.test_code, idx)}
                                className="p-1.5 rounded-lg transition-colors hover:bg-teal-light"
                                title="코드 복사"
                              >
                                {copiedIndex === idx ? (
                                  <Check className="w-4 h-4" style={{ color: '#5A8F6B' }} />
                                ) : (
                                  <Copy className="w-4 h-4 text-text-tertiary" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  <button
                    onClick={handleCopyAll}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold border transition-all flex items-center justify-center gap-2"
                    style={{
                      borderColor: '#2D9CAE',
                      color: '#2D9CAE',
                      backgroundColor: copiedAll ? '#EBF8FA' : 'transparent',
                    }}
                  >
                    {copiedAll ? (
                      <>
                        <Check className="w-4 h-4" />
                        복사 완료
                      </>
                    ) : (
                      <>
                        <ClipboardCopy className="w-4 h-4" />
                        전체 복사
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleReset}
                    className="flex-1 h-11 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2"
                    style={{ backgroundColor: '#2D9CAE', color: '#FFFFFF' }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    새 테스트 만들기
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ─── Tab: 출제 현황 ─── */}
        {activeTab === 'status' && (
          <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between" style={{ padding: '20px 28px' }}>
              <div className="space-y-1">
                <h2 className="text-base font-bold text-text-primary font-display">레벨테스트 출제 현황</h2>
                <p className="text-xs text-text-secondary">
                  출제된 레벨테스트 목록입니다. 발급된 코드로 학생이 시험에 접속합니다.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center gap-2 h-9 rounded-lg"
                  style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 12px', width: 200 }}
                >
                  <Search className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
                  <input
                    type="text"
                    placeholder="이름, 코드 검색..."
                    value={statusSearch}
                    onChange={(e) => setStatusSearch(e.target.value)}
                    className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
                  />
                </div>
                <span
                  className="text-[11px] font-semibold rounded-full shrink-0"
                  style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
                >
                  {statusFiltered.length}명
                </span>
              </div>
            </div>

            {statusLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin text-text-tertiary" />
              </div>
            ) : statusFiltered.length === 0 ? (
              <div className="p-8 text-center text-sm text-text-tertiary">
                {statusSearch ? '검색 결과가 없습니다' : '아직 출제된 레벨테스트가 없습니다.'}
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: 760 }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F8F8F6', height: 40, borderTop: '1px solid #E8E8E6', borderBottom: '1px solid #E8E8E6' }}>
                        <th className="text-[11px] font-semibold text-text-secondary text-left pl-6 pr-2 whitespace-nowrap">학생</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">학교/학년</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">테스트코드</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">문제수</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">유형</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">출제범위</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">출제일</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">상태</th>
                        <th className="text-[11px] font-semibold text-text-secondary text-left pl-2 pr-6 whitespace-nowrap">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {statusPageData.map((item) => {
                        const schoolGrade = [item.student_school, item.student_grade].filter(Boolean).join(' ') || '-';
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #E8E8E6', height: 48 }}>
                            <td className="text-xs font-semibold text-text-primary pl-6 pr-2 whitespace-nowrap">
                              {item.student_name}
                            </td>
                            <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                              {schoolGrade}
                            </td>
                            <td className="px-2 whitespace-nowrap">
                              <button
                                onClick={() => item.test_code && handleStatusCopy(item.test_code)}
                                className="flex items-center gap-1.5 group"
                                title="클릭하여 복사"
                              >
                                <span className="text-xs font-bold" style={{ color: '#4F46E5', letterSpacing: 1 }}>
                                  {item.test_code}
                                </span>
                                {copiedCode === item.test_code ? (
                                  <Check className="w-3 h-3" style={{ color: '#2D9CAE' }} />
                                ) : (
                                  <Copy className="w-3 h-3 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
                                )}
                              </button>
                            </td>
                            <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                              {item.question_count}문제
                            </td>
                            <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                              <div className="flex items-center gap-1">
                                {item.question_types ? (() => {
                                  const types = item.question_types!.split(',').map(t => t.trim());
                                  const maxShow = 2;
                                  const visible = types.slice(0, maxShow);
                                  const remaining = types.length - maxShow;
                                  return (
                                    <>
                                      {visible.map((trimmedType) => {
                                        const badge = QTYPE_BADGES[trimmedType];
                                        if (badge) {
                                          return (
                                            <span
                                              key={trimmedType}
                                              className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                              style={{ backgroundColor: badge.bg, color: badge.color }}
                                            >
                                              {badge.label}
                                            </span>
                                          );
                                        }
                                        return <span key={trimmedType} className="text-[9px]">{trimmedType}</span>;
                                      })}
                                      {remaining > 0 && (
                                        <span
                                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                          style={{ backgroundColor: '#F0F0EE', color: '#6D6C6A' }}
                                          title={types.slice(maxShow).map(t => QTYPE_BADGES[t]?.label ?? t).join(', ')}
                                        >
                                          +{remaining}
                                        </span>
                                      )}
                                    </>
                                  );
                                })() : '-'}
                              </div>
                            </td>
                            <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                              {item.lesson_range || '-'}
                            </td>
                            <td className="text-[11px] text-text-tertiary px-2 whitespace-nowrap">
                              {formatDate(item.assigned_at)}
                            </td>
                            <td className="px-2 whitespace-nowrap">
                              {item.status === 'pending' && (
                                <span className="text-[10px] font-semibold rounded-full" style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '3px 8px' }}>미응시</span>
                              )}
                              {item.status === 'in_progress' && (
                                <span className="text-[10px] font-semibold rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '3px 8px' }}>진행중</span>
                              )}
                              {item.status === 'completed' && (
                                <span className="text-[10px] font-semibold rounded-full" style={{ backgroundColor: '#E8FAF0', color: '#5A8F6B', padding: '3px 8px' }}>완료</span>
                              )}
                            </td>
                            <td className="pl-2 pr-6">
                              <div className="flex items-center gap-2">
                                {item.status === 'pending' && (
                                  <button onClick={() => handleDelete(item.id)} className="hover:opacity-70 transition-opacity" title="삭제">
                                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                                  </button>
                                )}
                                {item.status === 'completed' && (item.test_session_id || item.learning_session_id) && (
                                  <button onClick={() => handleViewResult(item)} className="text-[11px] font-semibold hover:opacity-70 transition-opacity" style={{ color: '#2D9CAE' }}>보기</button>
                                )}
                                {item.status !== 'pending' && (
                                  <button onClick={() => handleResetAssignment(item.id)} className="hover:opacity-70 transition-opacity" title="초기화">
                                    <RotateCcw className="w-3.5 h-3.5" style={{ color: '#F59E0B' }} />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {statusTotalPages > 1 && (
                  <div
                    className="flex items-center justify-between"
                    style={{ padding: '12px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
                  >
                    <span className="text-[11px] text-text-tertiary">
                      {statusStartIdx + 1}-{statusEndIdx} / {statusFiltered.length}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setStatusPage(p => Math.max(p - 1, 0))}
                        disabled={statusPage === 0}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                      >
                        <ChevronLeft className="w-4 h-4 text-text-secondary" />
                      </button>
                      <span className="text-[11px] font-medium text-text-secondary">
                        {statusPage + 1} / {statusTotalPages}
                      </span>
                      <button
                        onClick={() => setStatusPage(p => Math.min(p + 1, statusTotalPages - 1))}
                        disabled={statusPage >= statusTotalPages - 1}
                        className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
                      >
                        <ChevronRight className="w-4 h-4 text-text-secondary" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

export default LevelTestPage;
