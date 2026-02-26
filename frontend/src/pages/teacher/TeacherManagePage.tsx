/**
 * Teacher management page for master admin.
 * Based on StudentManagePage pattern.
 */
import { useEffect, useState, useMemo } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import type { TeacherWithStats } from '../../services/teacher';
import { teacherService } from '../../services/teacher';
import { Search, UserPlus, Pencil, Trash2, X } from 'lucide-react';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

const EMPTY_NEW_TEACHER = {
  name: '',
  username: '',
  password: '',
  passwordConfirm: '',
  school_name: '',
  phone_number: '',
};

export function TeacherManagePage() {
  const [teachers, setTeachers] = useState<TeacherWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const [newTeacher, setNewTeacher] = useState(EMPTY_NEW_TEACHER);
  const [editData, setEditData] = useState({ name: '', password: '', school_name: '', phone_number: '' });

  const filteredTeachers = useMemo(() => {
    if (searchQuery.trim() === '') return teachers;
    const query = searchQuery.toLowerCase();
    return teachers.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.username?.toLowerCase().includes(query) ||
        t.school_name?.toLowerCase().includes(query)
    );
  }, [searchQuery, teachers]);

  useEffect(() => {
    loadTeachers();
  }, []);

  const loadTeachers = async () => {
    try {
      const data = await teacherService.listTeachers();
      setTeachers(data);
    } catch {
      setError('선생님 목록을 불러올 수 없습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const passwordMismatch =
    newTeacher.passwordConfirm !== '' && newTeacher.password !== newTeacher.passwordConfirm;

  const canSubmitNew =
    newTeacher.name.trim() !== '' &&
    newTeacher.username.trim() !== '' &&
    newTeacher.password.trim() !== '' &&
    newTeacher.password === newTeacher.passwordConfirm;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmitNew) return;
    setModalError('');
    try {
      await teacherService.createTeacher({
        name: newTeacher.name,
        username: newTeacher.username,
        password: newTeacher.password,
        school_name: newTeacher.school_name || undefined,
        phone_number: newTeacher.phone_number || undefined,
      });
      setNewTeacher(EMPTY_NEW_TEACHER);
      setShowAddModal(false);
      await loadTeachers();
    } catch (err: unknown) {
      const errObj = err as { response?: { data?: { detail?: string } } };
      setModalError(errObj.response?.data?.detail || '선생님 추가에 실패했습니다.');
    }
  };

  const handleCloseModal = () => {
    setShowAddModal(false);
    setNewTeacher(EMPTY_NEW_TEACHER);
    setModalError('');
  };

  const handleUpdate = async (id: string) => {
    setError('');
    const updates: { name?: string; password?: string; school_name?: string; phone_number?: string } = {};
    if (editData.name) updates.name = editData.name;
    if (editData.password) updates.password = editData.password;
    if (editData.school_name) updates.school_name = editData.school_name;
    if (editData.phone_number) updates.phone_number = editData.phone_number;

    try {
      await teacherService.updateTeacher(id, updates);
      setEditingId(null);
      setEditData({ name: '', password: '', school_name: '', phone_number: '' });
      await loadTeachers();
    } catch {
      setError('선생님 정보 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${name} 선생님을 삭제하시겠습니까?\n담당 학생들의 선생님 정보가 초기화됩니다.`)) return;
    setError('');
    try {
      await teacherService.deleteTeacher(id);
      await loadTeachers();
    } catch {
      setError('선생님 삭제에 실패했습니다.');
    }
  };

  return (
    <TeacherLayout>
      <div className="space-y-6">
        {/* Top Bar */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-[26px] font-extrabold text-text-primary">선생님 관리</h1>
            <p className="font-display text-[14px] text-text-secondary mt-1">
              선생님 계정을 추가하고 관리하세요
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Search Box */}
            <div className="relative w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
              <input
                type="text"
                placeholder="선생님 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            {/* Add Teacher Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium transition-all hover:opacity-90"
              style={{
                background: 'linear-gradient(135deg, #2D9CAE 0%, #3DBDC8 100%)',
              }}
            >
              <UserPlus className="w-4 h-4" />
              선생님 추가
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-feedback-error/10 text-feedback-error px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        {/* Teacher Table Card */}
        <div className="bg-surface border border-border-subtle rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border-subtle">
            <h2 className="text-lg font-semibold text-text-primary">
              전체 선생님 ({filteredTeachers.length}명)
            </h2>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : filteredTeachers.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 선생님이 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F8F8F6', height: '44px' }}>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '100px' }}>
                      이름
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '140px' }}>
                      아이디
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '140px' }}>
                      학원명
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '120px' }}>
                      연락처
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '80px' }}>
                      담당 학생
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary whitespace-nowrap" style={{ width: '100px' }}>
                      등록일
                    </th>
                    <th className="px-4 text-left text-xs font-semibold text-text-tertiary">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeachers.map((teacher) => (
                    <tr
                      key={teacher.id}
                      className="border-b border-border-subtle hover:bg-bg-muted transition-colors"
                      style={{ height: '52px' }}
                    >
                      <td className="px-4">
                        <div className="font-semibold text-text-primary truncate max-w-[100px]">{teacher.name}</div>
                      </td>
                      <td className="px-4 text-sm text-text-secondary">
                        <span className="truncate block max-w-[140px]">{teacher.username || '-'}</span>
                      </td>
                      <td className="px-4 text-sm text-text-secondary">
                        <span className="truncate block max-w-[140px]">{teacher.school_name || '-'}</span>
                      </td>
                      <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                        {teacher.phone_number || '-'}
                      </td>
                      <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-teal-light text-teal">
                          {teacher.student_count}명
                        </span>
                      </td>
                      <td className="px-4 text-sm text-text-secondary whitespace-nowrap">
                        {teacher.created_at ? formatDate(teacher.created_at) : '-'}
                      </td>
                      <td className="px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingId(teacher.id);
                              setEditData({
                                name: teacher.name,
                                password: '',
                                school_name: teacher.school_name || '',
                                phone_number: teacher.phone_number || '',
                              });
                            }}
                            className="p-1.5 text-text-secondary hover:bg-bg-muted rounded transition-colors"
                            title="수정"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(teacher.id, teacher.name)}
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
        </div>

        {/* Edit Form Modal */}
        {editingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface border border-border-subtle rounded-xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">선생님 정보 수정</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">이름</label>
                  <input
                    type="text"
                    placeholder="이름"
                    value={editData.name}
                    onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">비밀번호</label>
                  <input
                    type="password"
                    placeholder="새 비밀번호 (변경 시에만 입력)"
                    value={editData.password}
                    onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">학원명</label>
                  <input
                    type="text"
                    placeholder="학원명"
                    value={editData.school_name}
                    onChange={(e) => setEditData({ ...editData, school_name: e.target.value })}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-text-secondary mb-1">연락처</label>
                  <input
                    type="text"
                    placeholder="연락처"
                    value={editData.phone_number}
                    onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(editingId)}
                  className="flex-1 px-4 py-2 bg-teal text-white rounded-lg text-sm font-medium hover:bg-teal/90"
                >
                  저장
                </button>
                <button
                  onClick={() => {
                    setEditingId(null);
                    setEditData({ name: '', password: '', school_name: '', phone_number: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-bg-muted text-text-secondary rounded-lg text-sm font-medium hover:bg-bg-muted/80"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Teacher Modal */}
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
                  <h2 className="text-[16px] font-bold text-text-primary">선생님 추가</h2>
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
                      placeholder="선생님 이름"
                      value={newTeacher.name}
                      onChange={(e) => setNewTeacher({ ...newTeacher, name: e.target.value })}
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
                      value={newTeacher.username}
                      onChange={(e) => setNewTeacher({ ...newTeacher, username: e.target.value })}
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
                      value={newTeacher.password}
                      onChange={(e) => setNewTeacher({ ...newTeacher, password: e.target.value })}
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
                      value={newTeacher.passwordConfirm}
                      onChange={(e) => setNewTeacher({ ...newTeacher, passwordConfirm: e.target.value })}
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

                  {/* 학원명 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      학원명 <span className="font-normal text-text-tertiary">(선택)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="학원 이름"
                      value={newTeacher.school_name}
                      onChange={(e) => setNewTeacher({ ...newTeacher, school_name: e.target.value })}
                      className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal bg-white"
                      style={{ border: '1px solid #E8E8E6' }}
                    />
                  </div>

                  {/* 연락처 */}
                  <div>
                    <label className="block text-[12px] font-semibold text-text-secondary mb-1.5">
                      연락처 <span className="font-normal text-text-tertiary">(선택)</span>
                    </label>
                    <input
                      type="text"
                      placeholder="010-0000-0000"
                      value={newTeacher.phone_number}
                      onChange={(e) => setNewTeacher({ ...newTeacher, phone_number: e.target.value })}
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

export default TeacherManagePage;
