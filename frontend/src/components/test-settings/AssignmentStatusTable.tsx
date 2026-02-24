/**
 * Assignment status table for test assignment page.
 * Matches Pencil editor design: white card with header badge, purple test codes.
 */
import { Trash2, RotateCcw } from 'lucide-react';
import type { TestAssignmentItem } from '../../services/testAssignment';

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

const QTYPE_LABELS: Record<string, { label: string; bg: string; color: string }> = {
  en_to_ko: { label: '영한', bg: '#DBEAFE', color: '#2563EB' },
  ko_to_en: { label: '한영', bg: '#EDE9FE', color: '#7C3AED' },
  listen_en: { label: '듣기영', bg: '#D1FAE5', color: '#059669' },
  listen_ko: { label: '듣기한', bg: '#CCFBF1', color: '#0D9488' },
  listen_type: { label: '듣기타', bg: '#FEF3C7', color: '#D97706' },
  ko_type: { label: '한영타', bg: '#FEE2E2', color: '#DC2626' },
  emoji: { label: '이모지', bg: '#FCE7F3', color: '#DB2777' },
  sentence: { label: '예문', bg: '#E0E7FF', color: '#4F46E5' },
};

export function AssignmentStatusTable({ assignments, onDelete, onReset, onViewResult }: Props) {
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
        <span
          className="text-[11px] font-semibold rounded-full shrink-0"
          style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
        >
          {assignments.length}명 출제됨
        </span>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-tertiary">
          아직 출제된 테스트가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          {/* Table */}
          <table className="w-full" style={{ minWidth: 920 }}>
            <thead>
              <tr style={{ backgroundColor: '#F8F8F6', height: 40, borderTop: '1px solid #E8E8E6', borderBottom: '1px solid #E8E8E6' }}>
                <th className="text-[11px] font-semibold text-text-secondary text-left pl-6 pr-2 whitespace-nowrap">학생</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">학교</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">학년</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">테스트코드</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">문제수</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">제한시간</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">유형</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">출제범위</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">출제일</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">상태</th>
                <th className="text-[11px] font-semibold text-text-secondary text-left pl-2 pr-6 whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((item) => (
                <tr key={item.id} style={{ borderBottom: '1px solid #E8E8E6', height: 48 }}>
                  <td className="text-xs font-semibold text-text-primary pl-6 pr-2 whitespace-nowrap">
                    {item.student_name}
                  </td>
                  <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                    {item.student_school || '-'}
                  </td>
                  <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                    {item.student_grade || '-'}
                  </td>
                  <td className="px-2 whitespace-nowrap">
                    <span className="text-xs font-bold" style={{ color: '#4F46E5', letterSpacing: 1 }}>
                      {item.test_code}
                    </span>
                  </td>
                  <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                    {item.question_count}문제
                  </td>
                  <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                    {item.per_question_time_seconds ?? '-'}초
                  </td>
                  <td className="text-xs text-text-secondary px-2 max-w-[200px]">
                    <div className="flex flex-wrap items-center gap-1">
                      {item.question_types ? (
                        item.question_types.split(',').map((type) => {
                          const trimmedType = type.trim();
                          const config = QTYPE_LABELS[trimmedType];
                          if (config) {
                            return (
                              <span
                                key={trimmedType}
                                className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                style={{ backgroundColor: config.bg, color: config.color }}
                              >
                                {config.label}
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default AssignmentStatusTable;
