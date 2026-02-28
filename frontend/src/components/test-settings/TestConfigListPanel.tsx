/**
 * Test config list panel - displays created test configurations.
 * Features: pagination (10/20/50/100), assign students, delete unused configs.
 */
import { useState, useEffect } from 'react';
import { Users, Trash2, Plus, ChevronLeft, ChevronRight, Search } from 'lucide-react';
import type { TestConfigItem } from '../../services/testAssignment';
import { QTYPE_BADGES, TEST_ENGINE_BADGES } from '../../constants/engineLabels';

interface Props {
  configs: TestConfigItem[];
  onAssign: (configId: string) => void;
  onDelete: (configId: string) => void;
}

// QTYPE_BADGES, TEST_ENGINE_BADGES
// → imported from '../../constants/engineLabels'

const PAGE_SIZE = 10;

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}.${m}.${day}`;
}

function formatTime(config: TestConfigItem): string {
  if (config.total_time_override_seconds) {
    const mins = Math.floor(config.total_time_override_seconds / 60);
    return `${mins}분`;
  }
  if (config.per_question_time_seconds) {
    return `${config.per_question_time_seconds}초/문제`;
  }
  return '-';
}

export function TestConfigListPanel({ configs, onAssign, onDelete }: Props) {
  const [page, setPage] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // Reset page when data or search changes
  useEffect(() => setPage(0), [configs.length, searchQuery]);

  const filtered = searchQuery.trim()
    ? configs.filter(c => c.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : configs;

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
          <h2 className="text-base font-bold text-text-primary font-display">
            생성된 테스트
          </h2>
          <p className="text-xs text-text-secondary">
            생성된 테스트 설정을 학생에게 배정할 수 있습니다.
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
              placeholder="테스트 이름 검색..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-[12px] text-text-primary placeholder:text-text-tertiary focus:outline-none"
            />
          </div>
          <span
            className="text-[11px] font-semibold rounded-full shrink-0"
            style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
          >
            {filtered.length}개
          </span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-8 text-center text-sm text-text-tertiary">
          {searchQuery ? '검색 결과가 없습니다' : '생성된 테스트가 없습니다'}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full" style={{ minWidth: 780 }}>
              <thead>
                <tr style={{ backgroundColor: '#F8F8F6', height: 40, borderTop: '1px solid #E8E8E6', borderBottom: '1px solid #E8E8E6' }}>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-6 pr-2 whitespace-nowrap">테스트 이름</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">엔진</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">문제수</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">시간</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">유형</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">배정</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left px-2 whitespace-nowrap">생성일</th>
                  <th className="text-[11px] font-semibold text-text-secondary text-left pl-2 pr-6 whitespace-nowrap">관리</th>
                </tr>
              </thead>
              <tbody>
                {pageData.map((config) => {
                  const engineStyle = TEST_ENGINE_BADGES[config.test_type] ?? { label: config.test_type, bg: '#F0F0EE', color: '#6D6C6A' };
                  return (
                    <tr key={config.id} style={{ borderBottom: '1px solid #E8E8E6', height: 48 }}>
                      <td className="text-xs font-semibold text-text-primary pl-6 pr-2 whitespace-nowrap max-w-[200px] truncate">
                        {config.name}
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
                        {config.question_count}문제
                      </td>
                      <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                        {formatTime(config)}
                      </td>
                      <td className="text-xs text-text-secondary px-2 whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {config.question_types ? (() => {
                            const types = config.question_types!.split(',').map(t => t.trim());
                            const maxShow = 2;
                            const visible = types.slice(0, maxShow);
                            const remaining = types.length - maxShow;
                            return (
                              <>
                                {visible.map((trimmedType) => {
                                  const style = QTYPE_BADGES[trimmedType];
                                  if (style) {
                                    return (
                                      <span
                                        key={trimmedType}
                                        className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                        style={{ backgroundColor: style.bg, color: style.color }}
                                      >
                                        {style.label}
                                      </span>
                                    );
                                  }
                                  return <span key={trimmedType} className="text-[9px]">{trimmedType}</span>;
                                })}
                                {remaining > 0 && (
                                  <span
                                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded"
                                    style={{ backgroundColor: '#F0F0EE', color: '#6D6C6A' }}
                                    title={types.slice(maxShow).map(t => QTYPE_BADGES[t]?.label ?? t).join(', ')}
                                  >
                                    +{remaining}
                                  </span>
                                )}
                              </>
                            );
                          })() : (
                            '-'
                          )}
                        </div>
                      </td>
                      <td className="px-2 whitespace-nowrap">
                        <span
                          className="text-[10px] font-semibold rounded-full flex items-center gap-1 w-fit"
                          style={{
                            backgroundColor: config.assignment_count > 0 ? '#EBF8FA' : '#F8F8F6',
                            color: config.assignment_count > 0 ? '#2D9CAE' : '#9C9B99',
                            padding: '3px 10px',
                          }}
                        >
                          <Users className="w-3 h-3" />
                          {config.assignment_count}명
                        </span>
                      </td>
                      <td className="text-[11px] text-text-tertiary px-2 whitespace-nowrap">
                        {formatDate(config.created_at)}
                      </td>
                      <td className="pl-2 pr-6">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onAssign(config.id)}
                            className="flex items-center gap-1 rounded-lg text-[11px] font-semibold text-white transition-all hover:opacity-90"
                            style={{
                              background: 'linear-gradient(135deg, #2D9CAE, #3DBDC8)',
                              padding: '5px 12px',
                            }}
                          >
                            <Plus className="w-3 h-3" />
                            배정
                          </button>
                          {config.assignment_count === 0 && (
                            <button
                              onClick={() => onDelete(config.id)}
                              className="hover:opacity-70 transition-opacity"
                              title="삭제"
                            >
                              <Trash2 className="w-3.5 h-3.5" style={{ color: '#EF4444' }} />
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

export default TestConfigListPanel;
