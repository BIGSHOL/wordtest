/**
 * Student selection card for test assignment.
 */
import { useState } from 'react';
import { Search, Phone } from 'lucide-react';
import type { User } from '../../types/auth';

interface Props {
  students: User[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

const RANK_COLORS: Record<string, string> = {
  Iron: 'bg-gray-200 text-gray-700',
  Bronze: 'bg-amber-100 text-amber-800',
  Silver: 'bg-slate-200 text-slate-700',
  Gold: 'bg-yellow-100 text-yellow-800',
  Platinum: 'bg-cyan-100 text-cyan-800',
  Diamond: 'bg-blue-100 text-blue-800',
  Master: 'bg-purple-100 text-purple-800',
  Challenger: 'bg-red-100 text-red-800',
};

function getRankColor(rank: string | null | undefined): string {
  if (!rank) return 'bg-gray-100 text-gray-500';
  return RANK_COLORS[rank] || 'bg-gray-100 text-gray-500';
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
    <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-border-subtle">
        <h2 className="text-lg font-semibold text-text-primary">학생 선택</h2>
      </div>

      {/* Search */}
      <div className="px-5 pt-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
          <input
            type="text"
            placeholder="이름 또는 학교로 검색..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal focus:border-transparent"
          />
        </div>
      </div>

      {/* Select All */}
      <div className="px-5 py-3 border-b border-border-subtle">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleAll}
            className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal"
          />
          <span className="text-sm font-medium text-text-secondary">전체 선택</span>
        </label>
      </div>

      {/* Student List */}
      <div className="max-h-[420px] overflow-y-auto divide-y divide-border-subtle">
        {filtered.length === 0 ? (
          <div className="p-6 text-center text-sm text-text-tertiary">
            {search ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
          </div>
        ) : (
          filtered.map((student) => (
            <label
              key={student.id}
              className="flex items-center gap-3 px-5 py-3 cursor-pointer hover:bg-bg-muted transition-colors"
            >
              <input
                type="checkbox"
                checked={selectedIds.has(student.id)}
                onChange={() => onToggle(student.id)}
                className="w-4 h-4 rounded border-gray-300 text-teal focus:ring-teal shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {student.name}
                  </span>
                  <span className="text-xs text-text-tertiary">
                    {[student.school_name, student.grade].filter(Boolean).join(' ')}
                  </span>
                </div>
                {student.phone_number && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <Phone className="w-3 h-3 text-text-tertiary" />
                    <span className="text-xs text-text-tertiary">{student.phone_number}</span>
                  </div>
                )}
              </div>
              {student.latest_rank && (
                <span
                  className={`px-2 py-0.5 text-xs rounded-full font-medium shrink-0 ${getRankColor(student.latest_rank)}`}
                >
                  {student.latest_rank}
                  {student.latest_level != null && ` Lv.${student.latest_level}`}
                </span>
              )}
            </label>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-border-subtle bg-bg-muted">
        <span className="text-sm text-text-secondary">
          <span className="font-semibold text-teal">{selectedIds.size}명</span> 선택됨
        </span>
      </div>
    </div>
  );
}

export default StudentSelectionCard;
