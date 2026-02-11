/**
 * Student selection card for test assignment.
 * Matches Pencil editor design: teal card-style student items with rank badges.
 */
import { useState } from 'react';
import { Search, Check, Users } from 'lucide-react';
import type { User } from '../../types/auth';

interface Props {
  students: User[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

const RANK_BADGE_STYLES: Record<string, { bg: string; text: string }> = {
  Iron: { bg: '#E8E8E8', text: '#6D6C6A' },
  Bronze: { bg: '#CD7F3233', text: '#CD7F32' },
  Silver: { bg: '#C0C0C020', text: '#808080' },
  Gold: { bg: '#FFF8DC', text: '#B8860B' },
  Platinum: { bg: '#EBF8FA', text: '#2D9CAE' },
  Emerald: { bg: '#E8FAF0', text: '#5A8F6B' },
  Diamond: { bg: '#E0F0FF', text: '#4A7AB5' },
  Master: { bg: '#F0E8FF', text: '#7C3AED' },
  Grandmaster: { bg: '#FEF2F2', text: '#DC2626' },
  Challenger: { bg: '#FFF8DC', text: '#D4A843' },
};

function getRankBadgeStyle(rank: string | null | undefined) {
  if (!rank) return { bg: '#F8F8F6', text: '#9C9B99' };
  return RANK_BADGE_STYLES[rank] || { bg: '#F8F8F6', text: '#9C9B99' };
}

export function StudentSelectionCard({ students, selectedIds, onToggle, onToggleAll }: Props) {
  const [search, setSearch] = useState('');

  const filtered = students.filter((s) => {
    const term = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      (s.school_name && s.school_name.toLowerCase().includes(term))
    );
  });

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));

  return (
    <div className="bg-white border border-border-subtle rounded-2xl overflow-hidden" style={{ padding: '24px 28px' }}>
      {/* Header row: title + select all */}
      <div className="flex items-start justify-between mb-4">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-text-primary font-display">학생 선택</h2>
          <p className="text-xs text-text-secondary">테스트를 출제할 학생을 선택합니다 (복수 선택 가능)</p>
        </div>
        <button
          onClick={onToggleAll}
          className="flex items-center gap-2 shrink-0"
        >
          <span
            className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
            style={{
              backgroundColor: allSelected ? '#2D9CAE' : 'transparent',
              border: allSelected ? 'none' : '2px solid #E8E8E6',
            }}
          >
            {allSelected && <Check className="w-3 h-3 text-white" />}
          </span>
          <span className="text-xs font-medium text-text-secondary">전체 선택</span>
        </button>
      </div>

      {/* Search bar */}
      <div
        className="flex items-center gap-2.5 h-10 rounded-[10px] mb-4"
        style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6', padding: '0 14px' }}
      >
        <Search className="w-4 h-4 text-text-tertiary shrink-0" />
        <input
          type="text"
          placeholder="학생 이름 또는 학교로 검색..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 bg-transparent text-[13px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
        />
      </div>

      {/* Student list */}
      <div className="space-y-2 max-h-[420px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-sm text-text-tertiary">
            {search ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
          </div>
        ) : (
          filtered.map((student) => {
            const isSelected = selectedIds.has(student.id);
            const badge = getRankBadgeStyle(student.latest_rank);
            const schoolInfo = [student.school_name, student.grade].filter(Boolean).join(' ');
            return (
              <button
                key={student.id}
                onClick={() => onToggle(student.id)}
                className="w-full flex items-center gap-3 rounded-[10px] transition-colors text-left"
                style={{
                  backgroundColor: isSelected ? '#EBF8FA' : '#F8F8F6',
                  border: isSelected ? '2px solid #2D9CAE' : '1px solid #E8E8E6',
                  padding: isSelected ? '9px 15px' : '10px 16px',
                }}
              >
                {/* Checkbox */}
                <span
                  className="w-[18px] h-[18px] rounded flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: isSelected ? '#2D9CAE' : 'transparent',
                    border: isSelected ? 'none' : '2px solid #E8E8E6',
                  }}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </span>

                {/* Name + school */}
                <span
                  className="text-[13px] font-semibold truncate min-w-0 flex-1"
                  style={{ color: isSelected ? '#2D9CAE' : '#3D3D3C' }}
                >
                  {student.name}{schoolInfo ? ` · ${schoolInfo}` : ''}
                </span>

                {/* Rank badge */}
                {student.latest_rank && (
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap"
                    style={{ backgroundColor: badge.bg, color: badge.text }}
                  >
                    {student.latest_level != null ? `Lv.${student.latest_level} ` : ''}
                    {student.latest_rank}
                  </span>
                )}

                {/* Phone */}
                {student.phone_number && (
                  <span
                    className="text-[11px] shrink-0 whitespace-nowrap"
                    style={{ color: isSelected ? '#2D9CAE' : '#9C9B99', opacity: 0.6 }}
                  >
                    {student.phone_number}
                  </span>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Selected count footer */}
      <div
        className="flex items-center gap-2 rounded-lg mt-4"
        style={{ backgroundColor: '#EBF8FA', padding: '10px 16px' }}
      >
        <Users className="w-4 h-4" style={{ color: '#2D9CAE' }} />
        <span className="text-xs font-medium" style={{ color: '#2D9CAE' }}>
          {selectedIds.size}명 선택됨
        </span>
      </div>
    </div>
  );
}

export default StudentSelectionCard;
