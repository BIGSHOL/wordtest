import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { statsService, type TestResultItem } from '../../services/stats';
import { Search, ChevronDown, ExternalLink } from 'lucide-react';
import { logger } from '../../utils/logger';
import { getLevelRank } from '../../types/rank';

const ITEMS_PER_PAGE = 10;

export function AllTestResultsPage() {
  const navigate = useNavigate();
  const [results, setResults] = useState<TestResultItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [page, setPage] = useState(0);

  const fetchResults = async () => {
    try {
      setIsLoading(true);
      const params: { skip: number; limit: number; search?: string; test_type?: string } = {
        skip: page * ITEMS_PER_PAGE,
        limit: ITEMS_PER_PAGE,
      };
      if (debouncedSearch) params.search = debouncedSearch;
      if (typeFilter) params.test_type = typeFilter;

      const response = await statsService.getAllResults(params);
      setResults(response.results);
      setTotal(response.total);
    } catch (error) {
      logger.error('Failed to fetch results:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchResults();
  }, [page, debouncedSearch, typeFilter]);

  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hours}:${mins}`;
  };

  const handleRowClick = (item: TestResultItem) => {
    if (item.test_type === 'mastery') {
      navigate(`/students/${item.student_id}/mastery/${item.id}`);
    } else {
      navigate(`/students/${item.student_id}/results`);
    }
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-text-primary">
              전체 테스트 결과
            </h1>
            <p className="text-[13px] text-text-secondary mt-1">
              모든 학생의 테스트 결과를 확인합니다
            </p>
          </div>
          <div className="relative w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="학생 이름 검색..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-border-subtle rounded-[10px] text-sm bg-white focus:outline-none focus:border-teal"
            />
          </div>
        </div>

        {/* Table */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {/* Filters */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border-subtle">
            <div className="flex items-center gap-3">
              <span className="text-[13px] font-semibold text-text-secondary whitespace-nowrap">유형</span>
              <div className="relative">
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setPage(0);
                  }}
                  className="appearance-none pl-3 pr-8 py-1.5 rounded-lg border border-border-subtle bg-white text-sm text-text-primary focus:outline-none focus:border-teal focus:ring-1 focus:ring-teal cursor-pointer"
                  style={{ minWidth: 140 }}
                >
                  <option value="">전체</option>
                  <option value="test">레벨테스트</option>
                  <option value="mastery">학습테스트</option>
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-tertiary pointer-events-none" />
              </div>
            </div>
            <span
              className="text-[11px] font-semibold rounded-full shrink-0"
              style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE', padding: '4px 12px' }}
            >
              총 {total.toLocaleString()}건
            </span>
          </div>

          {isLoading ? (
            <div className="py-16 text-center text-text-tertiary">로딩 중...</div>
          ) : results.length === 0 ? (
            <div className="py-16 text-center text-text-tertiary">
              테스트 결과가 없습니다.
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-[#F8F8F6] h-11 text-xs text-text-tertiary font-semibold">
                      <th className="text-center px-3 w-[50px]">No.</th>
                      <th className="text-left px-3">학생</th>
                      <th className="text-center px-3">유형</th>
                      <th className="text-center px-3">점수</th>
                      <th className="text-center px-3">정답</th>
                      <th className="text-center px-3">레벨</th>
                      <th className="text-center px-3">소요시간</th>
                      <th className="text-center px-3">응시일</th>
                      <th className="text-center px-3 w-[50px]">상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((item, index) => {
                      const rankInfo = item.determined_level ? getLevelRank(item.determined_level) : null;
                      return (
                        <tr
                          key={item.id}
                          className="border-b border-border-subtle h-[52px] hover:bg-bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleRowClick(item)}
                        >
                          <td className="px-3 text-center text-sm text-text-tertiary">
                            {page * ITEMS_PER_PAGE + index + 1}
                          </td>
                          <td className="px-3">
                            <div>
                              <span className="text-sm font-medium text-text-primary">{item.student_name}</span>
                              {item.student_grade && (
                                <span className="ml-2 text-xs text-text-tertiary">{item.student_grade}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-3 text-center">
                            <span
                              className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold"
                              style={{
                                backgroundColor: item.test_type === 'mastery' ? '#F3E8FF' : '#EBF8FA',
                                color: item.test_type === 'mastery' ? '#9333EA' : '#2D9CAE',
                              }}
                            >
                              {item.test_type === 'mastery' ? '학습' : '레벨'}
                            </span>
                          </td>
                          <td className="px-3 text-center text-sm font-semibold text-text-primary">
                            {item.score != null ? `${item.score}점` : '-'}
                          </td>
                          <td className="px-3 text-center text-sm text-text-secondary">
                            {item.correct_count}/{item.total_questions}
                          </td>
                          <td className="px-3 text-center">
                            {rankInfo ? (
                              <span
                                className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold"
                                style={{
                                  backgroundColor: rankInfo.colors[0] + '20',
                                  color: rankInfo.colors[1],
                                }}
                              >
                                {item.rank_label || `Lv.${item.determined_level}`}
                              </span>
                            ) : (
                              <span className="text-xs text-text-tertiary">-</span>
                            )}
                          </td>
                          <td className="px-3 text-center text-sm text-text-secondary">
                            {formatDuration(item.duration_seconds)}
                          </td>
                          <td className="px-3 text-center text-xs text-text-tertiary whitespace-nowrap">
                            {formatDate(item.completed_at)}
                          </td>
                          <td className="px-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRowClick(item);
                              }}
                              className="p-1 text-text-tertiary hover:text-teal rounded transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-border-subtle">
                  <button
                    onClick={() => setPage(Math.max(0, page - 1))}
                    disabled={page === 0}
                    className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    이전
                  </button>
                  <span className="px-3 text-sm text-text-secondary">
                    {page + 1} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                    disabled={page >= totalPages - 1}
                    className="px-4 py-2 text-sm font-medium border border-border-subtle rounded-lg hover:bg-bg-muted transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default AllTestResultsPage;
