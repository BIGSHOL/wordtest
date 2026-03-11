import { useState, useEffect, useCallback } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { errorLogService, type ErrorLogItem, type ErrorLogFilters } from '../../services/errorLogs';
import {
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Search,
  Trash2,
  RotateCcw,
  FileWarning,
} from 'lucide-react';
import { logger } from '../../utils/logger';

const PAGE_LIMIT = 25;

// --- Badge helpers ---

function LevelBadge({ level }: { level: string }) {
  let bg = '#EFF6FF';
  let color = '#2563EB';
  let label = level;

  if (level === 'error') {
    bg = '#FEE2E2';
    color = '#DC2626';
    label = 'error';
  } else if (level === 'warning') {
    bg = '#FEF3C7';
    color = '#D97706';
    label = 'warning';
  } else if (level === 'info') {
    bg = '#EFF6FF';
    color = '#2563EB';
    label = 'info';
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {label}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  let bg = '#F3E8FF';
  let color = '#7C3AED';

  if (source === 'frontend') {
    bg = '#EBF8FA';
    color = '#2D9CAE';
  }

  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{ backgroundColor: bg, color }}
    >
      {source}
    </span>
  );
}

// --- Time formatter ---

function formatTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return isoStr;
  return d.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\. /g, '-').replace('.', '').trim();
}

// --- Expanded row detail ---

function ExpandedDetail({ log }: { log: ErrorLogItem }) {
  return (
    <tr>
      <td colSpan={8} style={{ backgroundColor: '#F8F8F6', padding: '0 24px 16px' }}>
        <div className="space-y-3 pt-3">
          {/* Meta row */}
          <div className="flex flex-wrap gap-x-8 gap-y-1 text-[12px]">
            {log.method && (
              <div className="flex gap-1.5">
                <span style={{ color: '#9C9B99' }}>Method:</span>
                <span className="font-medium" style={{ color: '#3D3D3C' }}>{log.method}</span>
              </div>
            )}
            {log.status_code !== null && log.status_code !== undefined && (
              <div className="flex gap-1.5">
                <span style={{ color: '#9C9B99' }}>Status:</span>
                <span
                  className="font-semibold"
                  style={{ color: log.status_code >= 500 ? '#DC2626' : log.status_code >= 400 ? '#D97706' : '#16A34A' }}
                >
                  {log.status_code}
                </span>
              </div>
            )}
            {log.ip_address && (
              <div className="flex gap-1.5">
                <span style={{ color: '#9C9B99' }}>IP:</span>
                <span className="font-medium" style={{ color: '#3D3D3C' }}>{log.ip_address}</span>
              </div>
            )}
            {log.user_agent && (
              <div className="flex gap-1.5">
                <span style={{ color: '#9C9B99' }}>User-Agent:</span>
                <span className="font-medium truncate max-w-xs" style={{ color: '#6D6C6A' }}>
                  {log.user_agent}
                </span>
              </div>
            )}
          </div>

          {/* Detail */}
          {log.detail && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: '#9C9B99' }}>상세 메시지</p>
              <pre
                className="text-[12px] rounded-lg p-4 overflow-x-auto whitespace-pre-wrap break-words"
                style={{ backgroundColor: '#F8F8F6', color: '#3D3D3C', border: '1px solid #E8E8E6' }}
              >
                {log.detail}
              </pre>
            </div>
          )}

          {/* Stack trace */}
          {log.stack_trace && (
            <div>
              <p className="text-[11px] font-semibold mb-1" style={{ color: '#9C9B99' }}>Stack Trace</p>
              <pre
                className="text-[11px] rounded-lg p-4 overflow-x-auto"
                style={{
                  backgroundColor: '#1E1E1E',
                  color: '#D4D4D4',
                  fontFamily: "'Fira Code', 'Cascadia Code', 'Consolas', monospace",
                  lineHeight: 1.6,
                  maxHeight: 320,
                }}
              >
                {log.stack_trace}
              </pre>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// --- Main Page ---

export default function ErrorLogPage() {
  const [logs, setLogs] = useState<ErrorLogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filter states
  const [levelFilter, setLevelFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchText, setSearchText] = useState('');

  // Applied filters (only applied on "검색" click or reset)
  const [appliedFilters, setAppliedFilters] = useState<ErrorLogFilters>({});

  const totalPages = Math.max(1, Math.ceil(total / PAGE_LIMIT));

  const fetchLogs = useCallback(async (filters: ErrorLogFilters, currentPage: number) => {
    setLoading(true);
    try {
      const params: ErrorLogFilters = {
        ...filters,
        page: currentPage,
        limit: PAGE_LIMIT,
      };
      const res = await errorLogService.list(params);
      setLogs(res.items);
      setTotal(res.total);
    } catch (err) {
      logger.error('Failed to fetch error logs:', err);
      setLogs([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(appliedFilters, page);
  }, [appliedFilters, page, fetchLogs]);

  const handleSearch = () => {
    const filters: ErrorLogFilters = {};
    if (levelFilter) filters.level = levelFilter;
    if (sourceFilter) filters.source = sourceFilter;
    if (dateFrom) filters.date_from = dateFrom;
    if (dateTo) filters.date_to = dateTo;
    if (searchText.trim()) filters.search = searchText.trim();
    setPage(1);
    setExpandedId(null);
    setAppliedFilters(filters);
  };

  const handleReset = () => {
    setLevelFilter('');
    setSourceFilter('');
    setDateFrom('');
    setDateTo('');
    setSearchText('');
    setPage(1);
    setExpandedId(null);
    setAppliedFilters({});
  };

  const handleCleanup = async () => {
    const confirmed = window.confirm('30일 이상 된 로그를 삭제하시겠습니까?');
    if (!confirmed) return;
    try {
      const res = await errorLogService.cleanup(30);
      alert(`${res.deleted_count}개의 로그가 삭제되었습니다.`);
      setPage(1);
      setExpandedId(null);
      fetchLogs(appliedFilters, 1);
    } catch (err) {
      logger.error('Cleanup failed:', err);
      alert('정리 중 오류가 발생했습니다.');
    }
  };

  const handleRowClick = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const selectStyle: React.CSSProperties = {
    height: 36,
    border: '1px solid #E8E8E6',
    borderRadius: 8,
    padding: '0 10px',
    fontSize: 13,
    color: '#3D3D3C',
    backgroundColor: '#fff',
    outline: 'none',
    cursor: 'pointer',
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    border: '1px solid #E8E8E6',
    borderRadius: 8,
    padding: '0 10px',
    fontSize: 13,
    color: '#3D3D3C',
    backgroundColor: '#fff',
    outline: 'none',
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-[#3D3D3C] mb-1">에러 로그</h1>
            <p className="text-[13px] text-[#6D6C6A]">시스템 에러 로그를 확인합니다</p>
          </div>
          <button
            onClick={handleCleanup}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{
              backgroundColor: '#FEE2E2',
              color: '#DC2626',
              border: '1px solid #FECACA',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FECACA';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#FEE2E2';
            }}
          >
            <Trash2 className="w-4 h-4" />
            정리
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white border border-[#E8E8E6] rounded-2xl p-5">
          <div className="flex flex-wrap items-center gap-3">
            {/* Level dropdown */}
            <select
              value={levelFilter}
              onChange={e => setLevelFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">전체 레벨</option>
              <option value="error">error</option>
              <option value="warning">warning</option>
              <option value="info">info</option>
            </select>

            {/* Source dropdown */}
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">전체 소스</option>
              <option value="backend">backend</option>
              <option value="frontend">frontend</option>
            </select>

            {/* Date from */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[#9C9B99] shrink-0">시작일</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...inputStyle, width: 140 }}
              />
            </div>

            {/* Date to */}
            <div className="flex items-center gap-1.5">
              <span className="text-[12px] text-[#9C9B99] shrink-0">종료일</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                onKeyDown={handleKeyDown}
                style={{ ...inputStyle, width: 140 }}
              />
            </div>

            {/* Search input */}
            <div className="flex items-center gap-0 flex-1 min-w-[200px]">
              <input
                type="text"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="메시지, 엔드포인트, 사용자 검색..."
                style={{
                  ...inputStyle,
                  flex: 1,
                  borderTopRightRadius: 0,
                  borderBottomRightRadius: 0,
                  borderRight: 'none',
                }}
              />
              <button
                onClick={handleSearch}
                className="flex items-center gap-1.5 px-3 text-sm font-medium transition-colors"
                style={{
                  height: 36,
                  backgroundColor: '#2D9CAE',
                  color: '#fff',
                  border: '1px solid #2D9CAE',
                  borderTopRightRadius: 8,
                  borderBottomRightRadius: 8,
                  whiteSpace: 'nowrap',
                }}
              >
                <Search className="w-3.5 h-3.5" />
                검색
              </button>
            </div>

            {/* Reset */}
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 text-sm font-medium transition-colors rounded-lg"
              style={{
                height: 36,
                backgroundColor: '#F5F4F1',
                color: '#6D6C6A',
                border: '1px solid #E8E8E6',
                whiteSpace: 'nowrap',
              }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              초기화
            </button>
          </div>
        </div>

        {/* Log Table */}
        <div className="bg-white border border-[#E8E8E6] rounded-2xl overflow-hidden">
          {/* Table header info */}
          <div className="px-6 py-4 border-b border-[#E8E8E6] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: '#D97706' }} />
              <h2 className="text-[15px] font-bold text-[#3D3D3C]">로그 목록</h2>
            </div>
            {!loading && (
              <span className="text-[12px] text-[#9C9B99]">
                총 {total.toLocaleString()}건
              </span>
            )}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 gap-2">
              <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#2D9CAE' }} />
              <span className="text-sm text-[#6D6C6A]">로딩 중...</span>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <FileWarning className="w-10 h-10" style={{ color: '#9C9B99' }} />
              <p className="text-sm text-[#9C9B99]">에러 로그가 없습니다</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr
                    style={{
                      backgroundColor: '#F8F8F6',
                      borderBottom: '1px solid #E8E8E6',
                      height: 36,
                    }}
                  >
                    <th
                      className="text-left text-[11px] font-semibold text-[#9C9B99] pl-6 pr-2"
                      style={{ whiteSpace: 'nowrap' }}
                    >
                      시간
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">
                      레벨
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">
                      소스
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">
                      Endpoint
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">
                      Status
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2">
                      메시지
                    </th>
                    <th
                      className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6"
                    >
                      사용자
                    </th>
                    <th className="text-left text-[11px] font-semibold text-[#9C9B99] px-2 pr-6 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const isExpanded = expandedId === log.id;
                    return (
                      <>
                        <tr
                          key={log.id}
                          onClick={() => handleRowClick(log.id)}
                          className="transition-colors cursor-pointer"
                          style={{
                            borderBottom: isExpanded ? 'none' : '1px solid #F0F0EE',
                            height: 44,
                            backgroundColor: isExpanded ? '#F8F8F6' : undefined,
                          }}
                          onMouseEnter={e => {
                            if (!isExpanded) {
                              (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '#F8F8F6';
                            }
                          }}
                          onMouseLeave={e => {
                            if (!isExpanded) {
                              (e.currentTarget as HTMLTableRowElement).style.backgroundColor = '';
                            }
                          }}
                        >
                          {/* 시간 */}
                          <td
                            className="pl-6 pr-2 text-[11px] text-[#9C9B99]"
                            style={{ whiteSpace: 'nowrap' }}
                          >
                            {formatTime(log.created_at)}
                          </td>

                          {/* 레벨 */}
                          <td className="px-2">
                            <LevelBadge level={log.level} />
                          </td>

                          {/* 소스 */}
                          <td className="px-2">
                            <SourceBadge source={log.source} />
                          </td>

                          {/* Endpoint */}
                          <td
                            className="px-2 text-[12px] font-mono text-[#6D6C6A]"
                            style={{ maxWidth: 200 }}
                          >
                            <span className="block truncate" title={log.endpoint ?? ''}>
                              {log.endpoint ?? '-'}
                            </span>
                          </td>

                          {/* Status */}
                          <td className="px-2">
                            {log.status_code !== null && log.status_code !== undefined ? (
                              <span
                                className="text-[12px] font-semibold"
                                style={{
                                  color:
                                    log.status_code >= 500
                                      ? '#DC2626'
                                      : log.status_code >= 400
                                      ? '#D97706'
                                      : '#16A34A',
                                }}
                              >
                                {log.status_code}
                              </span>
                            ) : (
                              <span className="text-[12px] text-[#9C9B99]">-</span>
                            )}
                          </td>

                          {/* 메시지 */}
                          <td
                            className="px-2 text-[12px] text-[#3D3D3C]"
                            style={{ maxWidth: 320 }}
                          >
                            <span
                              className="block truncate"
                              title={log.message}
                            >
                              {log.message}
                            </span>
                          </td>

                          {/* 사용자 */}
                          <td className="px-2 pr-6 text-[12px] text-[#6D6C6A]" style={{ whiteSpace: 'nowrap' }}>
                            {log.username
                              ? log.username
                              : log.user_id
                              ? <span className="font-mono text-[11px] text-[#9C9B99]">{log.user_id.slice(0, 8)}…</span>
                              : <span className="text-[#9C9B99]">-</span>
                            }
                          </td>

                          {/* Expand icon */}
                          <td className="px-2 pr-4 text-right">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4 inline-block" style={{ color: '#9C9B99' }} />
                            ) : (
                              <ChevronDown className="w-4 h-4 inline-block" style={{ color: '#9C9B99' }} />
                            )}
                          </td>
                        </tr>

                        {isExpanded && <ExpandedDetail key={`${log.id}-detail`} log={log} />}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!loading && logs.length > 0 && (
            <div
              className="flex items-center justify-center gap-3 py-4 border-t border-[#E8E8E6]"
            >
              <button
                onClick={() => {
                  setPage(p => Math.max(1, p - 1));
                  setExpandedId(null);
                }}
                disabled={page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#F5F4F1',
                  color: '#6D6C6A',
                  border: '1px solid #E8E8E6',
                }}
              >
                <ChevronLeft className="w-4 h-4" />
                이전
              </button>

              <span className="text-[13px] font-medium text-[#6D6C6A]">
                Page{' '}
                <span className="text-[#3D3D3C] font-bold">{page}</span>
                {' '}of{' '}
                <span className="text-[#3D3D3C] font-bold">{totalPages}</span>
              </span>

              <button
                onClick={() => {
                  setPage(p => Math.min(totalPages, p + 1));
                  setExpandedId(null);
                }}
                disabled={page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#F5F4F1',
                  color: '#6D6C6A',
                  border: '1px solid #E8E8E6',
                }}
              >
                다음
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}
