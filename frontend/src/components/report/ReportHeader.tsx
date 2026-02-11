/**
 * Report header - logo, title, student info table, red divider.
 * Matches Pencil design node 7wxb0.
 */
import type { TestSessionData } from '../../services/test';
import type { User } from '../../types/auth';

interface Props {
  student: User | null;
  session: TestSessionData;
}

export function ReportHeader({ student, session }: Props) {
  const testDate = session.started_at
    ? new Date(session.started_at).toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      })
    : '-';

  return (
    <div className="space-y-3">
      {/* Title row + Info table */}
      <div className="flex items-start justify-between">
        {/* Logo on top, text below */}
        <div className="flex flex-col items-start gap-1">
          <img
            src="/images/logo-joshua.png"
            alt="Logo"
            className="h-10 w-auto"
          />
          <span className="text-[#0D0D0D] text-sm font-medium tracking-tight">
            조슈아 영어 어휘력 테스트
          </span>
        </div>

        {/* Info table */}
        <div className="border border-[#D0D0D0] text-xs">
          <div className="flex">
            <div className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] w-16">
              이름
            </div>
            <div className="px-3 py-1.5 text-[#0D0D0D] w-24 border-r border-[#D0D0D0]">
              {student?.name || '-'}
            </div>
            <div className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] w-16">
              학년
            </div>
            <div className="px-3 py-1.5 text-[#0D0D0D] w-24">
              {student?.grade || '-'}
            </div>
          </div>
          <div className="flex border-t border-[#D0D0D0]">
            <div className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] w-16 whitespace-nowrap">
              소속학원
            </div>
            <div className="px-3 py-1.5 text-[#0D0D0D] w-24 border-r border-[#D0D0D0]">
              {student?.school_name || '-'}
            </div>
            <div className="bg-[#F5F5F5] px-3 py-1.5 font-semibold text-[#333] border-r border-[#D0D0D0] w-16">
              응시일
            </div>
            <div className="px-3 py-1.5 text-[#0D0D0D] w-24">
              {testDate}
            </div>
          </div>
        </div>
      </div>

      {/* Red divider */}
      <div className="h-[2px] bg-[#CC0000]" />
    </div>
  );
}
