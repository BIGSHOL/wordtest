/**
 * Modal for assigning/unassigning students to a test config.
 * Sorted: completed > assigned (pending/in_progress) > unassigned.
 * Supports unassign and report shortcut for completed students.
 */
import { useState, useMemo, useCallback } from 'react';
import { Check, X, Search, Users, UserX, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { testAssignmentService } from '../../services/testAssignment';
import type { TestConfigItem } from '../../services/testAssignment';
import type { User } from '../../types/auth';

export interface ExistingAssignment {
  assignment_id: string;
  student_id: string;
  status: 'pending' | 'in_progress' | 'completed' | 'deactivated';
  learning_session_id?: string | null;
  test_session_id?: string | null;
  assignment_type?: string | null;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: TestConfigItem;
  students: User[];
  existingAssignments?: ExistingAssignment[];
  /** @deprecated Use existingAssignments instead */
  existingAssignmentStudentIds?: Set<string>;
  onAssigned: () => void;
}

const QTYPE_LABELS: Record<string, string> = {
  en_to_ko: '\uC601\u2192\uD55C',
  ko_to_en: '\uD55C\u2192\uC601',
  listen_en: '\uB4E3\uAE30(\uC601)',
  listen_ko: '\uB4E3\uAE30(\uD55C)',
  listen_type: '\uB4E3\uACE0\uD0C0\uC774\uD551',
  ko_type: '\uD55C\uAE00\uD0C0\uC774\uD551',
  emoji: '\uC774\uBAA8\uC9C0',
  sentence: '\uC608\uBB38\uBE48\uCE78',
  sentence_type: '\uC608\uBB38(\uD0C0)',
  antonym_choice: '\uBC18\uC758\uC5B4',
};

function formatTime(config: TestConfigItem): string {
  if (config.total_time_override_seconds) {
    const mins = Math.floor(config.total_time_override_seconds / 60);
    return `${mins}\uBD84`;
  }
  if (config.per_question_time_seconds) {
    return `${config.per_question_time_seconds}\uCD08/\uBB38\uC81C`;
  }
  return '-';
}

function formatTypes(questionTypes: string | null): string {
  if (!questionTypes) return '-';
  return questionTypes
    .split(',')
    .map((t) => QTYPE_LABELS[t.trim()] ?? t.trim())
    .join(', ');
}

type SortGroup = 'completed' | 'assigned' | 'unassigned';

function getSortGroup(assignment: ExistingAssignment | undefined): SortGroup {
  if (!assignment) return 'unassigned';
  if (assignment.status === 'completed') return 'completed';
  if (assignment.status === 'pending' || assignment.status === 'in_progress') return 'assigned';
  return 'unassigned'; // deactivated = treat as unassigned
}

const GROUP_ORDER: Record<SortGroup, number> = { completed: 0, assigned: 1, unassigned: 2 };

export function AssignStudentsModal({
  isOpen,
  onClose,
  config,
  students,
  existingAssignments,
  existingAssignmentStudentIds,
  onAssigned,
}: Props) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [unassigningId, setUnassigningId] = useState<string | null>(null);

  // Build assignment map: studentId → ExistingAssignment
  const assignmentMap = useMemo(() => {
    const map = new Map<string, ExistingAssignment>();
    if (existingAssignments) {
      for (const a of existingAssignments) {
        // Only count active assignments (not deactivated)
        if (a.status !== 'deactivated') {
          map.set(a.student_id, a);
        }
      }
    } else if (existingAssignmentStudentIds) {
      // Fallback for legacy usage
      for (const id of existingAssignmentStudentIds) {
        map.set(id, { assignment_id: '', student_id: id, status: 'pending' });
      }
    }
    return map;
  }, [existingAssignments, existingAssignmentStudentIds]);

  const activeAssignedCount = assignmentMap.size;
  const completedCount = useMemo(
    () => [...assignmentMap.values()].filter(a => a.status === 'completed').length,
    [assignmentMap]
  );
  const pendingCount = activeAssignedCount - completedCount;

  // Filter by search
  const filtered = useMemo(() => {
    const term = search.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(term) ||
        (s.school_name && s.school_name.toLowerCase().includes(term))
    );
  }, [students, search]);

  // Sort: completed > assigned > unassigned
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const ga = getSortGroup(assignmentMap.get(a.id));
      const gb = getSortGroup(assignmentMap.get(b.id));
      if (ga !== gb) return GROUP_ORDER[ga] - GROUP_ORDER[gb];
      return a.name.localeCompare(b.name, 'ko');
    });
  }, [filtered, assignmentMap]);

  const selectableFiltered = useMemo(
    () => filtered.filter((s) => !assignmentMap.has(s.id)),
    [filtered, assignmentMap]
  );

  const allSelectableSelected =
    selectableFiltered.length > 0 &&
    selectableFiltered.every((s) => selectedIds.has(s.id));

  const toggleStudent = (id: string) => {
    if (assignmentMap.has(id)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
      await testAssignmentService.assignStudentsToConfig(config.id, [...selectedIds]);
      onAssigned();
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409) {
        setErrorMsg('\uC774\uBBF8 \uBC30\uC815\uB41C \uD559\uC0DD\uC774 \uD3EC\uD568\uB418\uC5B4 \uC788\uC2B5\uB2C8\uB2E4.');
      } else {
        setErrorMsg('\uBC30\uC815 \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnassign = useCallback(async (assignmentId: string, studentName: string) => {
    if (!assignmentId || unassigningId) return;
    if (!window.confirm(`${studentName} \uD559\uC0DD\uC758 \uBC30\uC815\uC744 \uD574\uC81C\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?\n\uD14C\uC2A4\uD2B8 \uACB0\uACFC\uB294 \uC720\uC9C0\uB418\uC9C0\uB9CC \uCF54\uB4DC\uAC00 \uBE44\uD65C\uC131\uD654\uB429\uB2C8\uB2E4.`)) return;
    setUnassigningId(assignmentId);
    setErrorMsg('');
    try {
      await testAssignmentService.unassignStudent(assignmentId);
      onAssigned(); // refresh
    } catch {
      setErrorMsg('\uBC30\uC815 \uD574\uC81C \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.');
    } finally {
      setUnassigningId(null);
    }
  }, [unassigningId, onAssigned]);

  const handleViewReport = useCallback((assignment: ExistingAssignment, studentId: string) => {
    if ((assignment.assignment_type === 'mastery' || assignment.assignment_type === 'listening') && assignment.learning_session_id) {
      navigate(`/students/${studentId}/mastery/${assignment.learning_session_id}`);
    } else {
      navigate(`/students/${studentId}/results`);
    }
    onClose();
  }, [navigate, onClose]);

  if (!isOpen) return null;

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
        {/* Header */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '18px 24px', borderBottom: '1px solid #E8E8E6' }}
        >
          <div className="min-w-0">
            <h3 className="text-[15px] font-bold text-text-primary truncate">
              {config.name}
            </h3>
            <p className="text-[11px] text-text-secondary mt-0.5">
              {config.question_count}{'\uBB38\uC81C'} &middot; {formatTime(config)} &middot; {formatTypes(config.question_types)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0"
          >
            <X className="w-4 h-4 text-text-tertiary" />
          </button>
        </div>

        {/* Search + stats + select all */}
        <div className="shrink-0" style={{ padding: '14px 24px 0' }}>
          <div
            className="flex items-center gap-2.5 h-10 rounded-[10px] mb-3"
            style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 14px' }}
          >
            <Search className="w-4 h-4 text-text-tertiary shrink-0" />
            <input
              type="text"
              placeholder={'\uC774\uB984 \uB610\uB294 \uD559\uAD50\uB85C \uAC80\uC0C9...'}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-text-secondary">
              {filtered.length}{'\uBA85 \uD45C\uC2DC'}
              {activeAssignedCount > 0 && (
                <span className="ml-1">
                  {completedCount > 0 && (
                    <span style={{ color: '#16A34A' }}>
                      ({'\uC644\uB8CC'} {completedCount})
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="ml-1" style={{ color: '#9C9B99' }}>
                      ({'\uBC30\uC815\uB428'} {pendingCount})
                    </span>
                  )}
                </span>
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
              <span className="text-[11px] font-medium text-text-secondary">{'\uC804\uCCB4'}</span>
            </button>
          </div>
        </div>

        {/* Student list */}
        <div
          className="flex-1 min-h-0 overflow-y-auto space-y-1.5"
          style={{ padding: '0 24px 14px' }}
        >
          {sorted.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-tertiary">
              {search ? '\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : '\uB4F1\uB85D\uB41C \uD559\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
            </div>
          ) : (
            sorted.map((student) => {
              const assignment = assignmentMap.get(student.id);
              const group = getSortGroup(assignment);
              const isCompleted = group === 'completed';
              const isAssigned = group === 'assigned';
              const isActive = isCompleted || isAssigned;
              const isSelected = selectedIds.has(student.id);
              const schoolInfo = [student.school_name, student.grade].filter(Boolean).join(' ');
              const isUnassigning = unassigningId === assignment?.assignment_id;

              return (
                <div
                  key={student.id}
                  className="w-full flex items-center gap-3 rounded-[10px] transition-colors text-left"
                  style={{
                    backgroundColor: isCompleted
                      ? '#F0FDF4'
                      : isAssigned
                        ? '#F3F3F1'
                        : isSelected
                          ? '#EBF8FA'
                          : '#F8F8F6',
                    border: isCompleted
                      ? '1px solid #BBF7D0'
                      : isAssigned
                        ? '1px solid #E8E8E6'
                        : isSelected
                          ? '2px solid #2D9CAE'
                          : '1px solid #E8E8E6',
                    padding: isSelected && !isActive ? '9px 15px' : '10px 16px',
                    cursor: isActive ? 'default' : 'pointer',
                  }}
                  onClick={() => !isActive && toggleStudent(student.id)}
                >
                  {/* Checkbox / status icon */}
                  {isCompleted ? (
                    <span
                      className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#16A34A' }}
                    >
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  ) : isAssigned ? (
                    <span
                      className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
                      style={{ backgroundColor: '#B0AFAD' }}
                    >
                      <Check className="w-3 h-3 text-white" />
                    </span>
                  ) : (
                    <span
                      className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                        border: isSelected ? 'none' : '2px solid #E8E8E6',
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </span>
                  )}

                  {/* Name + school */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[13px] font-semibold block truncate"
                      style={{
                        color: isCompleted
                          ? '#16A34A'
                          : isAssigned
                            ? '#9C9B99'
                            : isSelected
                              ? '#2D9CAE'
                              : '#3D3D3C',
                      }}
                    >
                      {student.name}
                    </span>
                    {schoolInfo && (
                      <span className="text-[10px] block truncate" style={{ color: '#9C9B99' }}>
                        {schoolInfo}
                      </span>
                    )}
                  </div>

                  {/* Status badge + actions */}
                  {isCompleted && assignment && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewReport(assignment, student.id);
                        }}
                        className="flex items-center gap-1 rounded-md text-[9px] font-semibold transition-all hover:opacity-80"
                        style={{ backgroundColor: '#DCFCE7', color: '#16A34A', padding: '3px 8px' }}
                        title={'\uBCF4\uACE0\uC11C \uBCF4\uAE30'}
                      >
                        <FileText className="w-3 h-3" />
                        {'\uBCF4\uACE0\uC11C'}
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnassign(assignment.assignment_id, student.name);
                        }}
                        disabled={isUnassigning}
                        className="p-1 rounded-md transition-all hover:bg-red-50 disabled:opacity-40"
                        title={'\uBC30\uC815 \uD574\uC81C'}
                      >
                        <UserX className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  )}
                  {isAssigned && assignment && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                        style={{ backgroundColor: '#F0F0EE', color: '#9C9B99' }}
                      >
                        {'\uBC30\uC815\uB428'}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnassign(assignment.assignment_id, student.name);
                        }}
                        disabled={isUnassigning}
                        className="p-1 rounded-md transition-all hover:bg-red-50 disabled:opacity-40"
                        title={'\uBC30\uC815 \uD574\uC81C'}
                      >
                        <UserX className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="shrink-0"
          style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
        >
          {errorMsg && (
            <p className="text-[11px] text-red-500 mb-2">{errorMsg}</p>
          )}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5" style={{ color: selectedIds.size > 0 ? '#2D9CAE' : '#9C9B99' }} />
              <span
                className="text-[11px] font-medium"
                style={{ color: selectedIds.size > 0 ? '#2D9CAE' : '#9C9B99' }}
              >
                {selectedIds.size}{'\uBA85 \uC120\uD0DD\uB428'}
              </span>
            </div>
            <button
              onClick={handleAssign}
              disabled={selectedIds.size === 0 || isSubmitting}
              className="flex items-center justify-center rounded-[10px] text-[13px] font-semibold text-white transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
                padding: '8px 20px',
              }}
            >
              {isSubmitting
                ? '\uBC30\uC815 \uC911...'
                : `${selectedIds.size}\uBA85\uC5D0\uAC8C \uBC30\uC815\uD558\uAE30`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AssignStudentsModal;
