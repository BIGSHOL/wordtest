/**
 * Assignment status table for test assignment page.
 * Features: pagination (10/20/50/100), refactored columns with engine + time display.
 */
import { useState, useEffect } from 'react';
import { Trash2, RotateCcw, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { TestAssignmentItem } from '../../services/testAssignment';
import { QTYPE_BADGES, TEST_ENGINE_BADGES } from '../../constants/engineLabels';

interface Props {
  assignments: TestAssignmentItem[];
  onDelete: (id: string) => void;
  onReset: (id: string) => void;
  onViewResult: (item: TestAssignmentItem) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function formatTimeDisplay(item: TestAssignmentItem): string {
  if (item.total_time_override_seconds) {
    const mins = Math.floor(item.total_time_override_seconds / 60);
    return `${mins}분`;
  }
  if (item.per_question_time_seconds) {
    return `${item.per_question_time_seconds}초/문제`;
  }
  return '-';
}

// QTYPE_BADGES, TEST_ENGINE_BADGES
// → imported from '../../constants/engineLabels'

const PAGE_SIZE = 10;

export function AssignmentStatusTable({ assignments, onDelete, onReset, onViewResult }: Props) {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');

  // Reset page when data or search changes
  useEffect(() => setPage(0), [assignments.length, searchQuery]);

  const filtered = searchQuery.trim()
    ? assignments.filter(item => {
        const term = searchQuery.toLowerCase();
        return (
          item.student_name.toLowerCase().includes(term) ||
          (item.test_code && item.test_code.toLowerCase().includes(term)) ||
          (item.student_school && item.student_school.toLowerCase().includes(term))
        );
      })
    : assignments;

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const startIdx = page * PAGE_SIZE;
  const endIdx = Math.min(startIdx + PAGE_SIZE, filtered.length);
  const pageData = filtered.slice(startIdx, endIdx);

  const goPrev = () => setPage(p => Math.max(p - 1, 0));
  const goNext = () => setPage(p => Math.min(p + 1, totalPages - 1));

  return (
    <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between" style={{ padding: '20px 28px' }}>
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary font-display">출제 현황</h2>
          <p className="text-xs text-text-secondary">
            현재 출제된 테스트 목록입니다. 출제된 학생만 테스트에 접속할 수 있습니다.
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
              placeholder="이름, 학교, 코드 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <span
            className="text-[11px] font-semibold rounded-full shrink-0"
            style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
          >
            {filtered.length}명 출제됨
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-tertiary">
          {searchQuery ? '검색 결과가 없습니다' : '아직 출제된 테스트가 없습니다.'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 920 }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F8F6', height: 40, borderTop: '1px solid #E8E8E6', borderBottom: '1px solid #E8E8E6' }}>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-6 pr-2 whitespace-nowrap">학생</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">학교/학년</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">테스트코드</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">엔진</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">문제수</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">시간</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">유형</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">출제범위</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">출제일</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">상태</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-2 pr-6 whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((item) => {
                  const engineStyle = TEST_ENGINE_BADGES[item.engine_type ?? ''] ?? { label: item.engine_type ?? '-', bg: '#F0F0EE', color: '#6D6C6A' };
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
                        <span className="text-xs font-bold" style={{ color: '#4F46E5', letterSpacing: 1 }}>
                          {item.test_code}
                        </span>
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <span
                          className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                          style={{ backgroundColor: engineStyle.bg, color: engineStyle.color }}
                        >
                          {engineStyle.label}
                        </span>
                      </td>
                      <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                        {item.question_count}문제
                      </td>
                      <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                        {formatTimeDisplay(item)}
                      </td>
                      <td className="text-xs text-text-secondary px-2 max-w-[200px]">
                        <div className="flex flex-wrap items-center gap-1">
                          {item.question_types ? (
                            item.question_types.split(',').map((type) => {
                              const trimmedType = type.trim();
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
                            })
                          ) : (
                            '-'
                          )}
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
                          <span className="text-[10px] font-semibold rounded-full" style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '3px 8px' }}>학습중</span>
                        )}
                        {item.status === 'completed' && (
                          <span className="text-[10px] font-semibold rounded-full" style={{ backgroundColor: '#E8FAF0', color: '#5A8F6B', padding: '3px 8px' }}>완료</span>
                        )}
                      </td>
                      <td className="pl-2 pr-6">
                        <div className="flex items-center gap-2">
                          {item.status === 'pending' && (
                            <button onClick={() => onDelete(item.id)} className="hover:opacity-70 transition-opacity" title="삭제">
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                            </button>
                          )}
                          {item.status === 'completed' && (item.test_session_id || item.learning_session_id) && (
                            <button onClick={() => onViewResult(item)} className="text-[11px] font-semibold hover:opacity-70 transition-opacity" style={{ color: '#2D9CAE' }}>보기</button>
                          )}
                          {item.status !== 'pending' && (
                            <button onClick={() => onReset(item.id)} className="hover:opacity-70 transition-opacity" title="초기화">
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
          <div
            className="flex items-center justify-between"
            style={{ padding: '12px 28px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
          >
            <span className="text-[11px] text-text-tertiary">
              {startIdx + 1}-{endIdx} / {filtered.length}
            </span>

            <div className="flex items-center gap-2">
              <button
                onClick={goPrev}
                disabled={page === 0}
                className="p-1 rounded hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-opacity"
              >
                <ChevronLeft className="w-4 h-4 text-text-secondary" />
              </button>
              <span className="text-[11px] font-medium text-text-secondary">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={goNext}
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

export default AssignmentStatusTable;
