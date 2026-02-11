/**
 * Assignment status table for test assignment page.
 */
import { Trash2, Eye } from 'lucide-react';
import type { TestAssignmentItem } from '../../services/testAssignment';

interface Props {
  assignments: TestAssignmentItem[];
  onDelete: (id: string) => void;
  onViewResult: (testSessionId: string) => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours().toString().padStart(2, '0');
  const min = d.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hour}:${min}`;
}

function formatQuestionTypes(types: string | null): string {
  if (!types) return '-';
  const labels: Record<string, string> = {
    word_meaning: '단어>뜻',
    sentence_blank: '예문빈칸',
  };
  return types.split(',').map((t) => labels[t.trim()] || t.trim()).join(', ');
}

export function AssignmentStatusTable({ assignments, onDelete, onViewResult }: Props) {
  return (
    <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle flex items-center justify-between">
        <h2 className="text-lg font-semibold text-text-primary">출제 현황</h2>
        <span className="px-2.5 py-1 text-xs font-medium bg-teal-light text-teal rounded-full">
          {assignments.length}명 출제됨
        </span>
      </div>

      {assignments.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-tertiary">
          아직 출제된 테스트가 없습니다.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-muted text-text-secondary text-left">
                <th className="px-4 py-3 font-medium">학생</th>
                <th className="px-4 py-3 font-medium">학교</th>
                <th className="px-4 py-3 font-medium">학년</th>
                <th className="px-4 py-3 font-medium">테스트코드</th>
                <th className="px-4 py-3 font-medium">문제수</th>
                <th className="px-4 py-3 font-medium">제한시간</th>
                <th className="px-4 py-3 font-medium">유형</th>
                <th className="px-4 py-3 font-medium">출제범위</th>
                <th className="px-4 py-3 font-medium">출제일</th>
                <th className="px-4 py-3 font-medium">상태</th>
                <th className="px-4 py-3 font-medium">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {assignments.map((item) => (
                <tr key={item.id} className="hover:bg-bg-muted/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-text-primary whitespace-nowrap">
                    {item.student_name}
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {item.student_school || '-'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {item.student_grade || '-'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs bg-bg-muted px-1.5 py-0.5 rounded">
                      {item.test_code}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">{item.question_count}</td>
                  <td className="px-4 py-3 text-text-secondary">{item.per_question_time_seconds ?? '-'}초</td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {formatQuestionTypes(item.question_types)}
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {item.lesson_range || '-'}
                  </td>
                  <td className="px-4 py-3 text-text-secondary whitespace-nowrap">
                    {formatDate(item.assigned_at)}
                  </td>
                  <td className="px-4 py-3">
                    {item.status === 'pending' ? (
                      <span className="px-2 py-0.5 text-xs font-medium bg-red-50 text-red-600 rounded-full">
                        미응시
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 text-xs font-medium bg-green-50 text-green-600 rounded-full">
                        완료
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {item.status === 'pending' && (
                        <button
                          onClick={() => onDelete(item.id)}
                          className="p-1.5 text-text-tertiary hover:text-wrong hover:bg-wrong-light rounded-lg transition-colors"
                          title="삭제"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                      {item.status === 'completed' && item.test_session_id && (
                        <button
                          onClick={() => onViewResult(item.test_session_id!)}
                          className="p-1.5 text-text-tertiary hover:text-teal hover:bg-teal-light rounded-lg transition-colors"
                          title="결과 보기"
                        >
                          <Eye className="w-4 h-4" />
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
