/**
 * Assignment status table for test assignment page.
 * Matches Pencil editor design: white card with header badge, purple test codes.
 */
import { Trash2 } from 'lucide-react';
import type { TestAssignmentItem } from '../../services/testAssignment';

interface Props {
  assignments: TestAssignmentItem[];
  onDelete: (id: string) => void;
  onViewResult: (studentId: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function formatQuestionTypes(types: string | null): string {
  if (!types) return '-';
  const labels: Record<string, string> = {
    word_meaning: '1',
    meaning_word: '2',
    sentence_blank: '3',
  };
  const parts = types.split(',').map((t) => t.trim());
  const nums = parts.map((t) => labels[t] || t);
  return `유형${nums.join('+')}`;
}

export function AssignmentStatusTable({ assignments, onDelete, onViewResult }: Props) {
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
          {/* Table Header */}
          <div
            className="flex items-center"
            style={{
              backgroundColor: '#F8F8F6',
              height: 40,
              padding: '0 24px',
              gap: 12,
              borderTop: '1px solid #E8E8E6',
              borderBottom: '1px solid #E8E8E6',
            }}
          >
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 80 }}>학생</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 90 }}>학교</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 45 }}>학년</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 90 }}>테스트코드</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 55 }}>문제수</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 55 }}>제한시간</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 65 }}>유형</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 100 }}>출제범위</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 85 }}>출제일</span>
            <span className="text-[11px] font-semibold text-text-secondary whitespace-nowrap" style={{ width: 60 }}>상태</span>
            <span className="text-[11px] font-semibold text-text-secondary flex-1 whitespace-nowrap">관리</span>
          </div>

          {/* Table Rows */}
          {assignments.map((item) => (
            <div
              key={item.id}
              className="flex items-center"
              style={{
                height: 48,
                padding: '0 24px',
                gap: 12,
                borderBottom: '1px solid #E8E8E6',
              }}
            >
              <span className="text-xs font-semibold text-text-primary truncate" style={{ width: 80 }}>
                {item.student_name}
              </span>
              <span className="text-xs text-text-secondary truncate" style={{ width: 90 }}>
                {item.student_school || '-'}
              </span>
              <span className="text-xs text-text-secondary whitespace-nowrap" style={{ width: 45 }}>
                {item.student_grade || '-'}
              </span>
              <span className="whitespace-nowrap" style={{ width: 90 }}>
                <span className="text-xs font-bold" style={{ color: '#4F46E5', letterSpacing: 1 }}>
                  {item.test_code}
                </span>
              </span>
              <span className="text-xs text-text-secondary whitespace-nowrap" style={{ width: 55 }}>
                {item.question_count}문제
              </span>
              <span className="text-xs text-text-secondary whitespace-nowrap" style={{ width: 55 }}>
                {item.per_question_time_seconds ?? '-'}초
              </span>
              <span className="text-xs text-text-secondary whitespace-nowrap" style={{ width: 65 }}>
                {formatQuestionTypes(item.question_types)}
              </span>
              <span className="text-xs text-text-secondary whitespace-nowrap" style={{ width: 100 }}>
                {item.lesson_range || '-'}
                {item.test_type === 'placement' && (
                  <span
                    className="text-[9px] font-semibold ml-1"
                    style={{ color: '#4F46E5' }}
                  >
                    적응
                  </span>
                )}
              </span>
              <span className="text-[11px] text-text-tertiary whitespace-nowrap" style={{ width: 85 }}>
                {formatDate(item.assigned_at)}
              </span>
              <span className="whitespace-nowrap" style={{ width: 60 }}>
                {item.status === 'pending' && (
                  <span
                    className="text-[10px] font-semibold rounded-full"
                    style={{ backgroundColor: '#FEF2F2', color: '#EF4444', padding: '3px 8px' }}
                  >
                    미응시
                  </span>
                )}
                {item.status === 'in_progress' && (
                  <span
                    className="text-[10px] font-semibold rounded-full"
                    style={{ backgroundColor: '#EEF2FF', color: '#4F46E5', padding: '3px 8px' }}
                  >
                    학습중
                  </span>
                )}
                {item.status === 'completed' && (
                  <span
                    className="text-[10px] font-semibold rounded-full"
                    style={{ backgroundColor: '#E8FAF0', color: '#5A8F6B', padding: '3px 8px' }}
                  >
                    완료
                  </span>
                )}
              </span>
              <span className="flex-1 flex items-center gap-2">
                {item.status === 'pending' && (
                  <button
                    onClick={() => onDelete(item.id)}
                    className="hover:opacity-70 transition-opacity"
                    title="삭제"
                  >
                    <Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                  </button>
                )}
                {item.status === 'completed' && item.test_session_id && (
                  <button
                    onClick={() => onViewResult(item.student_id)}
                    className="text-[11px] font-semibold hover:opacity-70 transition-opacity"
                    style={{ color: '#2D9CAE' }}
                  >
                    보기
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default AssignmentStatusTable;
