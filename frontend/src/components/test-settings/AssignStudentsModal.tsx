/**
 * Modal for assigning students to a test config.
 * Fixed-position overlay with student selection, search, and batch assignment.
 */
import { useState, useMemo } from 'react';
import { Check, X, Search, Users } from 'lucide-react';
import { testAssignmentService } from '../../services/testAssignment';
import type { TestConfigItem } from '../../services/testAssignment';
import type { User } from '../../types/auth';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  config: TestConfigItem;
  students: User[];
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

export function AssignStudentsModal({
  isOpen,
  onClose,
  config,
  students,
  existingAssignmentStudentIds,
  onAssigned,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const alreadyAssigned = existingAssignmentStudentIds ?? new Set<string>();

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
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelectableSelected) {
      // Deselect all visible selectable
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableFiltered.forEach((s) => next.delete(s.id));
        return next;
      });
    } else {
      // Select all visible selectable
      setSelectedIds((prev) => {
        const next = new Set(prev);
        selectableFiltered.forEach((s) => next.add(s.id));
        return next;
      });
    }
  };

  const [errorMsg, setErrorMsg] = useState('');

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
        setErrorMsg('이미 배정된 학생이 포함되어 있습니다.');
      } else {
        setErrorMsg('배정 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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

        {/* Search + select all */}
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
              {alreadyAssigned.size > 0 && (
                <span className="ml-1" style={{ color: '#9C9B99' }}>
                  ({'\uBC30\uC815\uB428'} {alreadyAssigned.size})
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
          {filtered.length === 0 ? (
            <div className="py-8 text-center text-[12px] text-text-tertiary">
              {search ? '\uAC80\uC0C9 \uACB0\uACFC\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.' : '\uB4F1\uB85D\uB41C \uD559\uC0DD\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.'}
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
                    backgroundColor: isAlreadyAssigned
                      ? '#F3F3F1'
                      : isSelected
                        ? '#EBF8FA'
                        : '#F8F8F6',
                    border: isAlreadyAssigned
                      ? '1px solid #E8E8E6'
                      : isSelected
                        ? '2px solid #2D9CAE'
                        : '1px solid #E8E8E6',
                    padding: isSelected && !isAlreadyAssigned ? '9px 15px' : '10px 16px',
                    opacity: isAlreadyAssigned ? 0.55 : 1,
                    cursor: isAlreadyAssigned ? 'not-allowed' : 'pointer',
                  }}
                >
                  {/* Checkbox */}
                  <span
                    className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: isSelected ? (isAlreadyAssigned ? '#B0AFAD' : '#2D9CAE') : 'transparent',
                      border: isSelected ? 'none' : '2px solid #E8E8E6',
                    }}
                  >
                    {isSelected && <Check className="w-3 h-3 text-white" />}
                  </span>

                  {/* Name + school */}
                  <div className="flex-1 min-w-0">
                    <span
                      className="text-[13px] font-semibold block truncate"
                      style={{
                        color: isAlreadyAssigned
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

                  {/* Already assigned tag */}
                  {isAlreadyAssigned && (
                    <span
                      className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ backgroundColor: '#F0F0EE', color: '#9C9B99' }}
                    >
                      {'\uBC30\uC815\uB428'}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between shrink-0"
          style={{ padding: '14px 24px', borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
        >
          {errorMsg && (
            <p className="text-[11px] text-red-500 mb-1" style={{ marginBottom: 4 }}>{errorMsg}</p>
          )}
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
  );
}

export default AssignStudentsModal;
