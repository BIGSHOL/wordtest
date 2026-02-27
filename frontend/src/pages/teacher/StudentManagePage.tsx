/**
 * Student management page for teachers.
 * Redesigned to match Pencil design specification.
 */
import { useEffect, useState, useMemo } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { useNavigate } from 'react-router-dom';
import type { User } from '../../types/auth';
import { studentService } from '../../services/student';
import { getLevelRank } from '../../types/rank';
import { Search, UserPlus, Pencil, Trash2, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';

// Helper function moved outside component to prevent recreation on every render
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const GRADE_OPTIONS = [
  '초1', '초2', '초3', '초4', '초5', '초6',
  '중1', '중2', '중3',
  '고1', '고2', '고3',
];

const PAGE_SIZE = 10;

const EMPTY_NEW_STUDENT = {
  username: '',
  password: '',
  passwordConfirm: '',
  name: '',
  school_name: '',
  grade: '',
  phone_number: '',
};

export function StudentManagePage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [currentPage, setCurrentPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [newStudent, setNewStudent] = useState(EMPTY_NEW_STUDENT);
  const [editData, setEditData] = useState({
    username: '',
    name: '',
    password: '',
    school_name: '',
    grade: '',
    phone_number: '',
  });

  // useMemo instead of useEffect + setState to prevent double rendering
  const filteredStudents = useMemo(() => {
    if (searchQuery.trim() === '') {
      return students;
    }
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.username?.toLowerCase().includes(query) ||
        s.school_name?.toLowerCase().includes(query)
    );
  }, [searchQuery, students]);

  // Reset page when filter/search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / PAGE_SIZE));
  const paginatedStudents = filteredStudents.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    loadStudents();
  }, []);

  const loadStudents = async () => {
    try {
      const data = await studentService.listStudents();
      setStudents(data);
    } catch {
      setError('학생 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordMismatch =
    newStudent.passwordConfirm !== '' && newStudent.password !== newStudent.passwordConfirm;

  const canSubmitNew =
    newStudent.username.trim() !== '' &&
    newStudent.password.trim() !== '' &&
    newStudent.name.trim() !== '' &&
    newStudent.password === newStudent.passwordConfirm;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitNew) return;
    setModalError('');
    try {
      await studentService.createStudent({
        username: newStudent.username,
        password: newStudent.password,
        name: newStudent.name,
        school_name: newStudent.school_name || undefined,
        grade: newStudent.grade || undefined,
        phone_number: newStudent.phone_number || undefined,
      });
      setNewStudent(EMPTY_NEW_STUDENT);
      setShowAddModal(false);
      await loadStudents();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      setModalError(errObj.response?.data?.detail || '학생 추가에 실패했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewStudent(EMPTY_NEW_STUDENT);
    setModalError('');
  };

  const handleUpdate = async (id: string) => {
    setError('');
    setModalError('');
    const updates: Record<string, string | undefined> = {};
    if (editData.username) updates.username = editData.username;
    if (editData.name) updates.name = editData.name;
    if (editData.password) updates.password = editData.password;
    updates.phone_number = editData.phone_number || undefined;
    updates.school_name = editData.school_name || undefined;
    updates.grade = editData.grade || undefined;

    try {
      await studentService.updateStudent(id, updates);
      setEditingId(null);
      setEditData({ username: '', name: '', password: '', school_name: '', grade: '', phone_number: '' });
      await loadStudents();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      setModalError(errObj.response?.data?.detail || '학생 정보 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${name} 학생을 삭제하시겠습니까?`)) return;
    setError('');
    try {
      await studentService.deleteStudent(id);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
      await loadStudents();
    } catch {
      setError('학생 삭제에 실패했습니다.');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}명의 학생을 삭제하시겠습니까?`)) return;
    setError('');
    try {
      await studentService.deleteStudentsBatch([...selectedIds]);
      setSelectedIds(new Set());
      await loadStudents();
    } catch {
      setError('학생 일괄 삭제에 실패했습니다.');
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    const pageIds = paginatedStudents.map((s) => s.id);
    const allSelected = pageIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...pageIds]));
    }
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-extrabold text-text-primary">학생 관리</h1>
            <p className="font-display text-[14px] text-text-secondary mt-1">
              학생 목록을 관리하고 개별 보고서를 확인하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Batch Delete Button */}
            {selectedIds.size > 0 && (
              <button
                onClick={handleBatchDelete}
                className="flex items-center gap-2 px-4 py-2 bg-wrong text-white rounded-lg text-sm font-medium transition-all hover:opacity-90"
              >
                <Trash2 className="w-4 h-4" />
                선택 삭제 ({selectedIds.size})
              </button>
            )}
            {/* Search Box */}
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="학생 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {/* Add Student Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
              }}
            >
              <UserPlus className="w-4 h-4" />
              학생 추가
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-feedback-error/10 text-feedback-error px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Student Table Card */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border-subtle">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text-primary">
                전체 학생 ({filteredStudents.length}명)
              </h2>
              <div className="flex gap-2">
                {[
                  { key: 'all', label: '전체' },
                  { key: 'completed', label: '완료' },
                  { key: 'retry', label: '재시험' },
                  { key: 'none', label: '미응시' },
                ].map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-[14px] py-1.5 rounded-full text-xs font-medium transition-colors ${
                      statusFilter === f.key
                        ? 'bg-teal text-white'
                        : 'bg-[#F5F4F1] border border-border-subtle text-text-secondary'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : paginatedStudents.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F8F8F6', height: '44px' }}>
                    <th className="px-4 text-center" style={{ width: '40px' }}>
                      <input
                        type="checkbox"
                        checked={paginatedStudents.length > 0 && paginatedStudents.every((s) => selectedIds.has(s.id))}
                        onChange={toggleSelectAll}
                        className="w-4 h-4 rounded border-border-subtle text-teal focus:ring-teal/20 cursor-pointer accent-[#2D9CAE]"
                      />
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '100px' }}>
                      이름
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '120px' }}>
                      학교
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '50px' }}>
                      학년
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '120px' }}>
                      연락처
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '80px' }}>
                      담당
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '110px' }}>
                      현재 레벨
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '100px' }}>
                      마지막 응시
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '70px' }}>
                      상태
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStudents.map((student) => {
                    const rankInfo = student.latest_level ? getLevelRank(student.latest_level) : null;
                    return (
                      <tr
                        key={student.id}
                        className={`border-b border-border-subtle hover:bg-bg-muted transition-colors ${selectedIds.has(student.id) ? 'bg-teal-light/30' : ''}`}
                        style={{ height: '52px' }}
                      >
                        <td className="px-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(student.id)}
                            onChange={() => toggleSelect(student.id)}
                            className="w-4 h-4 rounded border-border-subtle text-teal focus:ring-teal/20 cursor-pointer accent-[#2D9CAE]"
                          />
                        </td>
                        <td className="px-4">
                          <div className="font-semibold text-text-primary truncate max-w-[100px]">{student.name}</div>
                        </td>
                        <td className="px-4 text-sm text-text-secondary">
                          <span className="truncate block max-w-[120px]">{student.school_name || '-'}</span>
                        </td>
                        <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                          {student.grade || '-'}
                        </td>
                        <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                          {student.phone_number || '-'}
                        </td>
                        <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                          {student.teacher_name || '-'}
                        </td>
                        <td className="px-4 whitespace-nowrap">
                          {rankInfo ? (
                            <span
                              className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
                              style={{
                                backgroundColor: rankInfo.colors[0] + '20',
                                color: rankInfo.colors[1],
                              }}
                            >
                              {student.latest_rank_label || `${rankInfo.name} ${student.latest_level}-1`}
                            </span>
                          ) : (
                            <span className="text-sm text-text-tertiary">-</span>
                          )}
                        </td>
                        <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                          {student.created_at ? formatDate(student.created_at) : '-'}
                        </td>
                        <td className="px-4">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-feedback-success"></span>
                            <span className="text-xs text-text-secondary">활성</span>
                          </span>
                        </td>
                        <td className="px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => navigate(`/students/${student.id}/results`)}
                              className="p-1.5 text-teal hover:bg-teal-light rounded transition-colors"
                              title="리포트"
                            >
                              <FileText className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                setEditingId(student.id);
                                setEditData({
                                  username: student.username || '',
                                  name: student.name,
                                  password: '',
                                  school_name: student.school_name || '',
                                  grade: student.grade || '',
                                  phone_number: student.phone_number || '',
                                });
                              }}
                              className="p-1.5 text-text-secondary hover:bg-bg-muted rounded transition-colors"
                              title="수정"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(student.id, student.name)}
                              className="p-1.5 text-wrong hover:bg-wrong-light rounded transition-colors"
                              title="삭제"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (() => {
            // Build compact page list: 1 ... 4 5 [6] 7 8 ... 31
            const pages: (number | '...')[] = [];
            const delta = 2; // pages around current
            const left = Math.max(2, currentPage - delta);
            const right = Math.min(totalPages - 1, currentPage + delta);
            pages.push(1);
            if (left > 2) pages.push('...');
            for (let i = left; i <= right; i++) pages.push(i);
            if (right < totalPages - 1) pages.push('...');
            if (totalPages > 1) pages.push(totalPages);

            return (
              <div className="flex items-center justify-between px-6 py-3 border-t border-border-subtle">
                <span className="text-xs text-text-tertiary">
                  {filteredStudents.length}명 중 {(currentPage - 1) * PAGE_SIZE + 1}-{Math.min(currentPage * PAGE_SIZE, filteredStudents.length)}명
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  {pages.map((page, idx) =>
                    page === '...' ? (
                      <span key={`dots-${idx}`} className="w-8 h-8 flex items-center justify-center text-xs text-text-tertiary">
                        ...
                      </span>
                    ) : (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                          page === currentPage
                            ? 'bg-teal text-white'
                            : 'text-text-secondary hover:bg-bg-muted'
                        }`}
                      >
                        {page}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Edit Form Modal */}
        {editingId && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={(e) => { if (e.target === e.currentTarget) { setEditingId(null); setModalError(''); } }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              style={{ border: '1px solid #E8E8E6' }}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
                  <h2 className="text-[16px] font-bold text-text-primary">학생 정보 수정</h2>
                </div>
                <button
                  onClick={() => { setEditingId(null); setModalError(''); }}
                  className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="px-6 py-5 space-y-4">
                {modalError && (
                  <div
                    className="px-4 py-3 rounded-lg text-sm font-medium"
                    style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                  >
                    {modalError}
                  </div>
                )}

                {/* 아이디 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">아이디</label>
                  <input
                    type="text"
                    placeholder="로그인 아이디"
                    value={editData.username}
                    onChange={(e) => setEditData({ ...editData, username: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">이름</label>
                  <input
                    type="text"
                    placeholder="학생 이름"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>

                {/* 비밀번호 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    새 비밀번호 <span className="font-normal text-text-tertiary">(변경 시에만 입력)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="변경할 비밀번호"
                    value={editData.password}
                    onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #F0F0EE' }} />

                {/* 학교 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">학교</label>
                  <input
                    type="text"
                    placeholder="학교 이름"
                    value={editData.school_name}
                    onChange={(e) => setEditData({ ...editData, school_name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>

                {/* 학년 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">학년</label>
                  <select
                    value={editData.grade}
                    onChange={(e) => setEditData({ ...editData, grade: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  >
                    <option value="">학년 선택</option>
                    {GRADE_OPTIONS.map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>

                {/* 연락처 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">연락처</label>
                  <input
                    type="text"
                    placeholder="010-0000-0000"
                    value={editData.phone_number}
                    onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>
              </div>

              {/* Modal footer */}
              <div
                className="flex items-center justify-end gap-3 px-6 py-4"
                style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <button
                  type="button"
                  onClick={() => { setEditingId(null); setModalError(''); }}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                  style={{ border: '1px solid #E8E8E6' }}
                >
                  취소
                </button>
                <button
                  onClick={() => handleUpdate(editingId)}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90"
                  style={{
                    background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
                  }}
                >
                  저장하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Student Modal */}
        {showAddModal && (
          <div
            className="fixed inset-0 flex items-center justify-center z-50"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
            onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
          >
            <div
              className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
              style={{ border: '1px solid #E8E8E6' }}
            >
              {/* Modal header */}
              <div
                className="flex items-center justify-between px-6 py-4"
                style={{ borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <div className="flex items-center gap-3">
                  <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
                  <h2 className="text-[16px] font-bold text-text-primary">학생 추가</h2>
                </div>
                <button
                  onClick={handleCloseModal}
                  className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal form */}
              <form onSubmit={handleAdd}>
                <div className="px-6 py-5 space-y-4">
                  {modalError && (
                    <div
                      className="px-4 py-3 rounded-lg text-sm font-medium"
                      style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}
                    >
                      {modalError}
                    </div>
                  )}

                  {/* 이름 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      이름 <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="학생 이름"
                      value={newStudent.name}
                      onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    />
                  </div>

                  {/* 아이디 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      아이디 <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="로그인 아이디"
                      value={newStudent.username}
                      onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    />
                  </div>

                  {/* 비밀번호 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      비밀번호 <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="비밀번호"
                      value={newStudent.password}
                      onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    />
                  </div>

                  {/* 비밀번호 확인 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      비밀번호 확인 <span style={{ color: '#EF4444' }}>*</span>
                    </label>
                    <input
                      type="password"
                      placeholder="비밀번호 재입력"
                      value={newStudent.passwordConfirm}
                      onChange={(e) => setNewStudent({ ...newStudent, passwordConfirm: e.target.value })}
                      required
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{
                        border: passwordMismatch ? '1px solid #EF4444' : '1px solid #E8E8E6',
                      }}
                    />
                    {passwordMismatch && (
                      <p className="mt-1 text-[11px] font-medium" style={{ color: '#EF4444' }}>
                        비밀번호가 일치하지 않습니다
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ borderTop: '1px solid #F0F0EE' }} />

                  {/* 학교 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      학교 <span className="font-normal text-text-tertiary">(선택)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="학교 이름"
                      value={newStudent.school_name}
                      onChange={(e) => setNewStudent({ ...newStudent, school_name: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    />
                  </div>

                  {/* 학년 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      학년 <span className="font-normal text-text-tertiary">(선택)</span>
                    </label>
                    <select
                      value={newStudent.grade}
                      onChange={(e) => setNewStudent({ ...newStudent, grade: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    >
                      <option value="">학년 선택</option>
                      {GRADE_OPTIONS.map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      연락처 <span className="font-normal text-text-tertiary">(선택)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="010-0000-0000"
                      value={newStudent.phone_number}
                      onChange={(e) => setNewStudent({ ...newStudent, phone_number: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    />
                  </div>
                </div>

                {/* Modal footer */}
                <div
                  className="flex items-center justify-end gap-3 px-6 py-4"
                  style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
                >
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                    style={{ border: '1px solid #E8E8E6' }}
                  >
                    취소
                  </button>
                  <button
                    type="submit"
                    disabled={!canSubmitNew}
                    className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
                    }}
                  >
                    등록하기
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

export default StudentManagePage;
