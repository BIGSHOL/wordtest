/**
 * User management page for master admin.
 * Allows viewing, creating, editing, and deleting all users across roles.
 */
import { useEffect, useState, useMemo, useCallback } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import {
  Search,
  UserPlus,
  Pencil,
  Trash2,
  X,
  KeyRound,
  Eye,
  ChevronLeft,
  ChevronRight,
  Copy,
} from 'lucide-react';
import {
  userManagementService,
  type UserWithActivity,
  type UserDetailSession,
  type CreateUserRequest,
  type UpdateUserRequest,
} from '../../services/userManagement';
import { teacherService, type TeacherWithStats } from '../../services/teacher';

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

function relativeTime(dateString: string | null): string {
  if (!dateString) return '-';
  const now = Date.now();
  const diff = now - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}일 전`;
  const months = Math.floor(days / 30);
  return `${months}개월 전`;
}

function formatDuration(seconds: number | null): string {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}초`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}분 ${s}초` : `${m}분`;
}

function sessionTypeLabel(type: UserDetailSession['session_type']): string {
  switch (type) {
    case 'learning': return '단어';
    case 'grammar': return '문법';
    case 'legacy': return '레거시';
    default: return type;
  }
}

function sessionTypeBadgeStyle(type: UserDetailSession['session_type']): React.CSSProperties {
  switch (type) {
    case 'learning': return { backgroundColor: '#EBF8FA', color: '#2D9CAE' };
    case 'grammar': return { backgroundColor: '#EDE9FE', color: '#4F46E5' };
    case 'legacy': return { backgroundColor: '#F0FDF4', color: '#5A8F6B' };
    default: return { backgroundColor: '#F8F8F6', color: '#6D6C6A' };
  }
}

function roleBadge(role: string) {
  if (role === 'master') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ backgroundColor: '#EDE9FE', color: '#4F46E5' }}
      >
        마스터
      </span>
    );
  }
  if (role === 'teacher') {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ backgroundColor: '#EBF8FA', color: '#2D9CAE' }}
      >
        선생님
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ backgroundColor: '#EFF6FF', color: '#3B82F6' }}
    >
      학생
    </span>
  );
}

function accuracyColor(pct: number | null): string {
  if (pct === null) return '#9C9B99';
  if (pct >= 80) return '#5A8F6B';
  if (pct >= 50) return '#D97706';
  return '#EF4444';
}

// ── Types ─────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

const ROLE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'student', label: '학생' },
  { value: 'teacher', label: '선생님' },
  { value: 'master', label: '마스터' },
];

const EMPTY_NEW_USER: CreateUserRequest & { passwordConfirm: string } = {
  name: '',
  username: '',
  password: '',
  passwordConfirm: '',
  role: 'student',
  email: '',
  phone_number: '',
  school_name: '',
  grade: '',
  teacher_id: '',
};

// ── Component ─────────────────────────────────────────────────────────────────

export function UserManagePage() {
  // List state
  const [users, setUsers] = useState<UserWithActivity[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');

  // Teachers list for student add/edit dropdown
  const [teachers, setTeachers] = useState<TeacherWithStats[]>([]);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserWithActivity | null>(null);
  const [detailUser, setDetailUser] = useState<UserWithActivity | null>(null);
  const [detailSessions, setDetailSessions] = useState<UserDetailSession[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resetUser, setResetUser] = useState<UserWithActivity | null>(null);
  const [tempPassword, setTempPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Modal form state
  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [editData, setEditData] = useState<UpdateUserRequest & { passwordConfirm?: string }>({});
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Data loading ────────────────────────────────────────────────────────────

  const loadUsers = useCallback(async (p = page, search = searchQuery, role = roleFilter) => {
    setIsLoading(true);
    setError('');
    try {
      const res = await userManagementService.listUsers({
        page: p,
        page_size: PAGE_SIZE,
        search: search || undefined,
        role: role || undefined,
      });
      setUsers(res.users);
      setTotal(res.total);
    } catch {
      setError('사용자 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [page, searchQuery, roleFilter]);

  const loadTeachers = useCallback(async () => {
    try {
      const data = await teacherService.listTeachers();
      setTeachers(data);
    } catch {
      // silently fail — teacher dropdown may be empty
    }
  }, []);

  useEffect(() => {
    loadUsers(page, searchQuery, roleFilter);
  }, [page, searchQuery, roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadTeachers();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Stats summary ────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    // We only have the current page; display based on total via role filter,
    // but for in-page stats we just count from current page.
    const studentCount = users.filter((u) => u.role === 'student').length;
    const teacherCount = users.filter((u) => u.role === 'teacher').length;
    const masterCount = users.filter((u) => u.role === 'master').length;
    return { studentCount, teacherCount, masterCount };
  }, [users]);

  // ── Search (debounce with enter key) ─────────────────────────────────────────

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      setSearchQuery(searchInput);
      setPage(1);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchInput(e.target.value);
    if (e.target.value === '') {
      setSearchQuery('');
      setPage(1);
    }
  };

  const handleRoleFilter = (value: string) => {
    setRoleFilter(value);
    setPage(1);
  };

  // ── Pagination ────────────────────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // ── Add User ──────────────────────────────────────────────────────────────────

  const passwordMismatch =
    newUser.passwordConfirm !== '' && newUser.password !== newUser.passwordConfirm;

  const canSubmitNew =
    newUser.name.trim() !== '' &&
    newUser.username.trim() !== '' &&
    newUser.password.trim() !== '' &&
    newUser.password === newUser.passwordConfirm;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitNew) return;
    setModalError('');
    setSubmitting(true);
    try {
      const payload: CreateUserRequest = {
        name: newUser.name,
        username: newUser.username,
        password: newUser.password,
        role: newUser.role,
      };
      if (newUser.email) payload.email = newUser.email;
      if (newUser.phone_number) payload.phone_number = newUser.phone_number;
      if (newUser.school_name) payload.school_name = newUser.school_name;
      if (newUser.grade) payload.grade = newUser.grade;
      if (newUser.teacher_id) payload.teacher_id = newUser.teacher_id;
      await userManagementService.createUser(payload);
      setNewUser(EMPTY_NEW_USER);
      setShowAddModal(false);
      setPage(1);
      await loadUsers(1, searchQuery, roleFilter);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      setModalError(errObj.response?.data?.detail || '사용자 추가에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    setNewUser(EMPTY_NEW_USER);
    setModalError('');
  };

  // ── Edit User ─────────────────────────────────────────────────────────────────

  const openEditModal = (user: UserWithActivity) => {
    setEditingUser(user);
    setEditData({
      name: user.name,
      email: user.email || '',
      phone_number: user.phone_number || '',
      school_name: user.school_name || '',
      grade: user.grade || '',
      role: user.role,
      teacher_id: user.teacher_id || '',
      password: '',
      passwordConfirm: '',
    });
    setModalError('');
  };

  const editPasswordMismatch =
    (editData.passwordConfirm ?? '') !== '' &&
    editData.password !== editData.passwordConfirm;

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (editPasswordMismatch) return;
    setModalError('');
    setSubmitting(true);
    try {
      const updates: UpdateUserRequest = {};
      if (editData.name) updates.name = editData.name;
      if (editData.email) updates.email = editData.email;
      if (editData.password) updates.password = editData.password;
      if (editData.phone_number !== undefined) updates.phone_number = editData.phone_number || undefined;
      if (editData.school_name !== undefined) updates.school_name = editData.school_name || undefined;
      if (editData.grade !== undefined) updates.grade = editData.grade || undefined;
      if (editData.role) updates.role = editData.role;
      if (editData.teacher_id !== undefined) updates.teacher_id = editData.teacher_id || undefined;
      await userManagementService.updateUser(editingUser.id, updates);
      setEditingUser(null);
      setEditData({});
      await loadUsers(page, searchQuery, roleFilter);
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      setModalError(errObj.response?.data?.detail || '사용자 수정에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseEditModal = () => {
    setEditingUser(null);
    setEditData({});
    setModalError('');
  };

  // ── Delete ────────────────────────────────────────────────────────────────────

  const handleDelete = async (user: UserWithActivity) => {
    if (!window.confirm(`"${user.name}" 사용자를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return;
    setError('');
    try {
      await userManagementService.deleteUser(user.id);
      await loadUsers(page, searchQuery, roleFilter);
    } catch {
      setError('사용자 삭제에 실패했습니다.');
    }
  };

  // ── Detail Modal ──────────────────────────────────────────────────────────────

  const openDetailModal = async (user: UserWithActivity) => {
    setDetailUser(user);
    setDetailSessions([]);
    setDetailLoading(true);
    try {
      const res = await userManagementService.getUserDetail(user.id);
      setDetailSessions(res.sessions);
    } catch {
      // sessions may be empty
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Reset Password ────────────────────────────────────────────────────────────

  const openResetModal = (user: UserWithActivity) => {
    setResetUser(user);
    setTempPassword('');
    setCopied(false);
  };

  const handleResetPassword = async () => {
    if (!resetUser) return;
    setResetLoading(true);
    try {
      const res = await userManagementService.resetPassword(resetUser.id);
      setTempPassword(res.temporary_password);
    } catch {
      setTempPassword('');
      setResetUser(null);
      setError('비밀번호 초기화에 실패했습니다.');
    } finally {
      setResetLoading(false);
    }
  };

  const handleCopyPassword = () => {
    if (!tempPassword) return;
    navigator.clipboard.writeText(tempPassword).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-extrabold text-text-primary">사용자 관리</h1>
            <p className="font-display text-[14px] text-text-secondary mt-1">
              모든 사용자 계정을 조회하고 관리하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="이름, 아이디 검색..."
                value={searchInput}
                onChange={handleSearchChange}
                onKeyDown={handleSearchKeyDown}
                className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                style={{ border: '1px solid #E8E8E6' }}
              />
            </div>
            {/* Role Filter */}
            <select
              value={roleFilter}
              onChange={(e) => handleRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
              style={{ border: '1px solid #E8E8E6' }}
            >
              {ROLE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            {/* Add User Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)' }}
            >
              <UserPlus className="w-4 h-4" />
              사용자 추가
            </button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: '학생', count: stats.studentCount, color: '#3B82F6', bg: '#EFF6FF' },
            { label: '선생님', count: stats.teacherCount, color: '#2D9CAE', bg: '#EBF8FA' },
            { label: '마스터', count: stats.masterCount, color: '#4F46E5', bg: '#EDE9FE' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white rounded-xl px-5 py-4 flex items-center gap-4"
              style={{ border: '1px solid #E8E8E6' }}
            >
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: item.bg, color: item.color }}
              >
                {item.count}
              </div>
              <div>
                <p className="text-[13px] text-text-tertiary">{item.label}</p>
                <p className="text-[15px] font-bold text-text-primary">{item.count}명</p>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="bg-feedback-error/10 text-feedback-error px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* User Table Card */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border-subtle flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text-primary">
              전체 사용자 ({total}명)
            </h2>
            {searchQuery && (
              <span className="text-sm text-text-tertiary">
                "{searchQuery}" 검색 결과
              </span>
            )}
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : users.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              {searchQuery || roleFilter ? '검색 결과가 없습니다.' : '등록된 사용자가 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F8F8F6', height: '44px' }}>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '110px' }}>
                      이름
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '130px' }}>
                      아이디
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '80px' }}>
                      역할
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '120px' }}>
                      학교
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '110px' }}>
                      마지막 활동
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '70px' }}>
                      세션수
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '70px' }}>
                      정답률
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '100px' }}>
                      가입일
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap">
                      관리
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="border-b border-border-subtle hover:bg-bg-muted transition-colors"
                      style={{ height: '52px' }}
                    >
                      <td className="px-4">
                        <button
                          onClick={() => openDetailModal(user)}
                          className="font-semibold text-text-primary truncate max-w-[100px] hover:text-teal transition-colors text-left"
                          title={user.name}
                        >
                          {user.name}
                        </button>
                      </td>
                      <td className="px-4 text-sm text-text-secondary">
                        <span className="truncate block max-w-[130px]">{user.username || user.email || '-'}</span>
                      </td>
                      <td className="px-4">
                        {roleBadge(user.role)}
                      </td>
                      <td className="px-4 text-sm text-text-secondary">
                        <span className="truncate block max-w-[120px]">{user.school_name || '-'}</span>
                      </td>
                      <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                        <span title={user.last_active ? new Date(user.last_active).toLocaleString('ko-KR') : undefined}>
                          {relativeTime(user.last_active)}
                        </span>
                      </td>
                      <td className="px-4 text-sm text-text-secondary whitespace-nowrap text-center">
                        {user.total_sessions}
                      </td>
                      <td className="px-4 text-sm font-medium whitespace-nowrap">
                        <span style={{ color: accuracyColor(user.accuracy_pct) }}>
                          {user.accuracy_pct !== null ? `${user.accuracy_pct.toFixed(1)}%` : '-'}
                        </span>
                      </td>
                      <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openDetailModal(user)}
                            className="p-1.5 text-text-secondary hover:bg-bg-muted rounded transition-colors"
                            title="상세 보기"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 text-text-secondary hover:bg-bg-muted rounded transition-colors"
                            title="수정"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openResetModal(user)}
                            className="p-1.5 text-text-secondary hover:bg-bg-muted rounded transition-colors"
                            title="비밀번호 초기화"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(user)}
                            className="p-1.5 text-wrong hover:bg-wrong-light rounded transition-colors"
                            title="삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {!isLoading && total > PAGE_SIZE && (
            <div
              className="flex items-center justify-between px-6 py-3"
              style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
            >
              <span className="text-sm text-text-tertiary">
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} / {total}명
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium text-text-primary">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-text-secondary hover:bg-bg-muted disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Add User Modal ──────────────────────────────────────────────────────── */}
      {showAddModal && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseAddModal(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ border: '1px solid #E8E8E6', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4 sticky top-0 bg-white z-10"
              style={{ borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
                <h2 className="text-[16px] font-bold text-text-primary">사용자 추가</h2>
              </div>
              <button
                onClick={handleCloseAddModal}
                className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleAdd}>
              <div className="px-6 py-5 space-y-4">
                {modalError && (
                  <div className="px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                    {modalError}
                  </div>
                )}

                {/* 역할 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    역할 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value as CreateUserRequest['role'] })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  >
                    <option value="student">학생</option>
                    <option value="teacher">선생님</option>
                    <option value="master">마스터</option>
                  </select>
                </div>

                {/* 이름 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    이름 <span style={{ color: '#EF4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="사용자 이름"
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
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
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
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
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
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
                    value={newUser.passwordConfirm}
                    onChange={(e) => setNewUser({ ...newUser, passwordConfirm: e.target.value })}
                    required
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: passwordMismatch ? '1px solid #EF4444' : '1px solid #E8E8E6' }}
                  />
                  {passwordMismatch && (
                    <p className="mt-1 text-[11px] font-medium" style={{ color: '#EF4444' }}>
                      비밀번호가 일치하지 않습니다
                    </p>
                  )}
                </div>

                <div style={{ borderTop: '1px solid #F0F0EE' }} />

                {/* Role-specific fields */}
                {newUser.role === 'teacher' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                        학원명 <span className="font-normal text-text-tertiary">(선택)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="학원 이름"
                        value={newUser.school_name}
                        onChange={(e) => setNewUser({ ...newUser, school_name: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                        연락처 <span className="font-normal text-text-tertiary">(선택)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="010-0000-0000"
                        value={newUser.phone_number}
                        onChange={(e) => setNewUser({ ...newUser, phone_number: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      />
                    </div>
                  </>
                )}

                {newUser.role === 'student' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                        학년 <span className="font-normal text-text-tertiary">(선택)</span>
                      </label>
                      <input
                        type="text"
                        placeholder="예) 중1, 고2"
                        value={newUser.grade}
                        onChange={(e) => setNewUser({ ...newUser, grade: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                        담당 선생님 <span className="font-normal text-text-tertiary">(선택)</span>
                      </label>
                      <select
                        value={newUser.teacher_id}
                        onChange={(e) => setNewUser({ ...newUser, teacher_id: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      >
                        <option value="">선택 안함</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div
                className="flex items-center justify-end gap-3 px-6 py-4"
                style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <button
                  type="button"
                  onClick={handleCloseAddModal}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                  style={{ border: '1px solid #E8E8E6' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={!canSubmitNew || submitting}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)' }}
                >
                  {submitting ? '등록 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Edit User Modal ─────────────────────────────────────────────────────── */}
      {editingUser && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseEditModal(); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ border: '1px solid #E8E8E6', maxHeight: '90vh', overflowY: 'auto' }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4 sticky top-0"
              style={{ borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
                <h2 className="text-[16px] font-bold text-text-primary">사용자 수정</h2>
              </div>
              <button
                onClick={handleCloseEditModal}
                className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleUpdate}>
              <div className="px-6 py-5 space-y-4">
                {modalError && (
                  <div className="px-4 py-3 rounded-lg text-sm font-medium" style={{ backgroundColor: '#FEF2F2', color: '#DC2626' }}>
                    {modalError}
                  </div>
                )}

                {/* 이름 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">이름</label>
                  <input
                    type="text"
                    placeholder="이름"
                    value={editData.name ?? ''}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>

                {/* 역할 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">역할</label>
                  <select
                    value={editData.role ?? editingUser.role}
                    onChange={(e) => setEditData({ ...editData, role: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  >
                    <option value="student">학생</option>
                    <option value="teacher">선생님</option>
                    <option value="master">마스터</option>
                  </select>
                </div>

                {/* 새 비밀번호 */}
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                    새 비밀번호 <span className="font-normal text-text-tertiary">(변경 시에만 입력)</span>
                  </label>
                  <input
                    type="password"
                    placeholder="새 비밀번호"
                    value={editData.password ?? ''}
                    onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                    className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                    style={{ border: '1px solid #E8E8E6' }}
                  />
                </div>

                {/* 비밀번호 확인 */}
                {editData.password && (
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      비밀번호 확인
                    </label>
                    <input
                      type="password"
                      placeholder="비밀번호 재입력"
                      value={editData.passwordConfirm ?? ''}
                      onChange={(e) => setEditData({ ...editData, passwordConfirm: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: editPasswordMismatch ? '1px solid #EF4444' : '1px solid #E8E8E6' }}
                    />
                    {editPasswordMismatch && (
                      <p className="mt-1 text-[11px] font-medium" style={{ color: '#EF4444' }}>
                        비밀번호가 일치하지 않습니다
                      </p>
                    )}
                  </div>
                )}

                <div style={{ borderTop: '1px solid #F0F0EE' }} />

                {/* Role-specific edit fields */}
                {(editData.role ?? editingUser.role) === 'teacher' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">학원명</label>
                      <input
                        type="text"
                        placeholder="학원 이름"
                        value={editData.school_name ?? ''}
                        onChange={(e) => setEditData({ ...editData, school_name: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">연락처</label>
                      <input
                        type="text"
                        placeholder="010-0000-0000"
                        value={editData.phone_number ?? ''}
                        onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      />
                    </div>
                  </>
                )}

                {(editData.role ?? editingUser.role) === 'student' && (
                  <>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">학년</label>
                      <input
                        type="text"
                        placeholder="예) 중1, 고2"
                        value={editData.grade ?? ''}
                        onChange={(e) => setEditData({ ...editData, grade: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">담당 선생님</label>
                      <select
                        value={editData.teacher_id ?? ''}
                        onChange={(e) => setEditData({ ...editData, teacher_id: e.target.value })}
                        className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                        style={{ border: '1px solid #E8E8E6' }}
                      >
                        <option value="">선택 안함</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
              </div>

              {/* Modal Footer */}
              <div
                className="flex items-center justify-end gap-3 px-6 py-4"
                style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
              >
                <button
                  type="button"
                  onClick={handleCloseEditModal}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                  style={{ border: '1px solid #E8E8E6' }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={submitting || editPasswordMismatch}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)' }}
                >
                  {submitting ? '저장 중...' : '저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Detail Modal ────────────────────────────────────────────────────────── */}
      {detailUser && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setDetailUser(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden"
            style={{ border: '1px solid #E8E8E6', maxWidth: '640px', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9', flexShrink: 0 }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
                <h2 className="text-[16px] font-bold text-text-primary">사용자 상세</h2>
              </div>
              <button
                onClick={() => setDetailUser(null)}
                className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto flex-1">
              {/* User summary */}
              <div className="px-6 py-5 space-y-3">
                <div className="flex items-center gap-4">
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold text-white"
                    style={{ background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)' }}
                  >
                    {detailUser.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-[17px] font-bold text-text-primary">{detailUser.name}</p>
                      {roleBadge(detailUser.role)}
                    </div>
                    <p className="text-sm text-text-tertiary">{detailUser.username || detailUser.email || '-'}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  {[
                    { label: '학교', value: detailUser.school_name || '-' },
                    { label: '학년', value: detailUser.grade || '-' },
                    { label: '연락처', value: detailUser.phone_number || '-' },
                    { label: '담당 선생님', value: detailUser.teacher_name || '-' },
                    { label: '마지막 활동', value: relativeTime(detailUser.last_active) },
                    { label: '총 세션', value: `${detailUser.total_sessions}회` },
                    { label: '정답률', value: detailUser.accuracy_pct !== null ? `${detailUser.accuracy_pct.toFixed(1)}%` : '-' },
                    { label: '가입일', value: formatDate(detailUser.created_at) },
                  ].map((item) => (
                    <div key={item.label} className="rounded-lg px-3 py-2" style={{ backgroundColor: '#F8F8F6' }}>
                      <p className="text-[11px] text-text-tertiary mb-0.5">{item.label}</p>
                      <p className="text-[13px] font-medium text-text-primary">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sessions */}
              <div style={{ borderTop: '1px solid #E8E8E6' }}>
                <div className="px-6 py-3">
                  <h3 className="text-[14px] font-semibold text-text-primary">세션 기록</h3>
                </div>
                {detailLoading ? (
                  <div className="px-6 py-4 text-center text-sm text-text-secondary">로딩 중...</div>
                ) : detailSessions.length === 0 ? (
                  <div className="px-6 py-4 text-center text-sm text-text-secondary">세션 기록이 없습니다.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr style={{ backgroundColor: '#F8F8F6', height: '36px' }}>
                          <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap">유형</th>
                          <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap">날짜</th>
                          <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap">점수</th>
                          <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap">정답률</th>
                          <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap">소요 시간</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailSessions.map((s) => (
                          <tr
                            key={s.session_id}
                            className="border-b border-border-subtle"
                            style={{ height: '44px' }}
                          >
                            <td className="px-4">
                              <span
                                className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={sessionTypeBadgeStyle(s.session_type)}
                              >
                                {sessionTypeLabel(s.session_type)}
                              </span>
                            </td>
                            <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                              {formatDate(s.started_at)}
                            </td>
                            <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                              {s.correct_count}/{s.total_questions}
                            </td>
                            <td className="px-4 text-sm font-medium whitespace-nowrap">
                              <span style={{ color: accuracyColor(s.accuracy_pct) }}>
                                {s.accuracy_pct !== null ? `${s.accuracy_pct.toFixed(1)}%` : '-'}
                              </span>
                            </td>
                            <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                              {formatDuration(s.duration_seconds)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div
              className="flex items-center justify-end px-6 py-4"
              style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9', flexShrink: 0 }}
            >
              <button
                onClick={() => setDetailUser(null)}
                className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                style={{ border: '1px solid #E8E8E6' }}
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Password Modal ────────────────────────────────────────────────── */}
      {resetUser && (
        <div
          className="fixed inset-0 flex items-center justify-center z-50"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
          onClick={(e) => { if (e.target === e.currentTarget && !tempPassword) setResetUser(null); }}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden"
            style={{ border: '1px solid #E8E8E6' }}
          >
            {/* Modal Header */}
            <div
              className="flex items-center justify-between px-6 py-4"
              style={{ borderBottom: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-1 h-5 rounded-full" style={{ backgroundColor: '#2D9CAE' }} />
                <h2 className="text-[16px] font-bold text-text-primary">비밀번호 초기화</h2>
              </div>
              <button
                onClick={() => setResetUser(null)}
                className="p-1.5 rounded-lg text-text-tertiary hover:bg-bg-muted transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-5 space-y-4">
              {!tempPassword ? (
                <>
                  <p className="text-sm text-text-secondary">
                    <span className="font-semibold text-text-primary">{resetUser.name}</span> 사용자의 비밀번호를 초기화하시겠습니까?
                  </p>
                  <p className="text-sm text-text-tertiary">
                    임시 비밀번호가 생성되며, 사용자에게 전달해 주세요.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-text-secondary">
                    임시 비밀번호가 생성되었습니다. 사용자에게 전달하고 로그인 후 변경하도록 안내하세요.
                  </p>
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-lg"
                    style={{ backgroundColor: '#F8F8F6', border: '1px solid #E8E8E6' }}
                  >
                    <span className="flex-1 text-sm font-mono font-medium text-text-primary tracking-wider">
                      {tempPassword}
                    </span>
                    <button
                      onClick={handleCopyPassword}
                      className="p-1.5 rounded text-text-secondary hover:bg-bg-muted transition-colors"
                      title="복사"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  {copied && (
                    <p className="text-xs font-medium" style={{ color: '#5A8F6B' }}>
                      클립보드에 복사되었습니다.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div
              className="flex items-center justify-end gap-3 px-6 py-4"
              style={{ borderTop: '1px solid #E8E8E6', backgroundColor: '#FAFAF9' }}
            >
              <button
                onClick={() => setResetUser(null)}
                className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-text-secondary transition-colors hover:bg-bg-muted"
                style={{ border: '1px solid #E8E8E6' }}
              >
                {tempPassword ? '닫기' : '취소'}
              </button>
              {!tempPassword && (
                <button
                  onClick={handleResetPassword}
                  disabled={resetLoading}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)' }}
                >
                  {resetLoading ? '초기화 중...' : '초기화'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </TeacherLayout>
  );
}

export default UserManagePage;
