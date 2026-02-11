import type { TestSessionData } from '../../services/test';
import type { User } from '../../types/auth';

function InfoPill({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-0.5 ${className}`}>
      <span className="text-[10px] lg:text-[11px] text-text-tertiary font-display font-medium">
        {label}
      </span>
      <span className="text-[13px] lg:text-sm font-display font-semibold text-text-primary">
        {value}
      </span>
    </div>
  );
}

export function StudentInfoCard({
  student,
  session,
}: {
  student: User | null;
  session: TestSessionData;
}) {
  const initial = student?.name?.charAt(0) || '?';
  const schoolGrade = [student?.school_name, student?.grade ? `${student.grade}` : null]
    .filter(Boolean)
    .join(' · ');
  const testDate = session.started_at
    ? new Date(session.started_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '-';

  return (
    <div className="rounded-2xl bg-white border border-border-subtle p-5 lg:p-6 w-full">
      <div className="flex items-center gap-3 lg:gap-4">
        <div
          className="w-11 h-11 lg:w-14 lg:h-14 rounded-full flex items-center justify-center shrink-0"
          style={{
            background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
          }}
        >
          <span className="text-white font-display text-lg lg:text-[22px] font-bold">
            {initial}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-base lg:text-xl font-bold text-text-primary truncate">
            {student?.name || '학생'}
          </h2>
          {schoolGrade && (
            <p className="text-xs lg:text-sm text-text-secondary truncate">{schoolGrade}</p>
          )}
        </div>
        <div className="hidden lg:flex items-center gap-6">
          <InfoPill label="응시일" value={testDate} />
          <InfoPill label="문제수" value={`${session.total_questions}문제`} />
        </div>
      </div>
      <div className="lg:hidden flex items-center gap-0 mt-3 pt-3 border-t border-[#E5E4E1]">
        <InfoPill label="응시일" value={testDate} className="flex-1" />
        <InfoPill label="문제수" value={`${session.total_questions}문제`} className="flex-1" />
      </div>
    </div>
  );
}
