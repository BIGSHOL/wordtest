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
import { Search, UserPlus, Pencil, Trash2, FileText } from 'lucide-react';

// Helper function moved outside component to prevent recreation on every render
function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
}

export function StudentManagePage() {
  const navigate = useNavigate();
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [newStudent, setNewStudent] = useState({ username: '', password: '', name: '' });
  const [editData, setEditData] = useState({ name: '', password: '' });

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

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await studentService.createStudent(newStudent);
      setNewStudent({ username: '', password: '', name: '' });
      setShowAddForm(false);
      await loadStudents();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      setError(error.response?.data?.detail || '학생 추가에 실패했습니다.');
    }
  };

  const handleUpdate = async (id: string) => {
    setError('');
    const updates: { name?: string; password?: string } = {};
    if (editData.name) updates.name = editData.name;
    if (editData.password) updates.password = editData.password;

    try {
      await studentService.updateStudent(id, updates);
      setEditingId(null);
      setEditData({ name: '', password: '' });
      await loadStudents();
    } catch {
      setError('학생 정보 수정에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`${name} 학생을 삭제하시겠습니까?`)) return;
    setError('');
    try {
      await studentService.deleteStudent(id);
      await loadStudents();
    } catch {
      setError('학생 삭제에 실패했습니다.');
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
              onClick={() => setShowAddForm(!showAddForm)}
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

        {/* Add Form */}
        {showAddForm && (
          <form onSubmit={handleAdd} className="bg-surface border border-border-subtle rounded-xl p-5 space-y-4">
            <h2 className="text-lg font-semibold text-text-primary">새 학생 등록</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <input
                type="text"
                placeholder="아이디"
                value={newStudent.username}
                onChange={(e) => setNewStudent({ ...newStudent, username: e.target.value })}
                required
                className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={newStudent.password}
                onChange={(e) => setNewStudent({ ...newStudent, password: e.target.value })}
                required
                className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
              <input
                type="text"
                placeholder="이름"
                value={newStudent.name}
                onChange={(e) => setNewStudent({ ...newStudent, name: e.target.value })}
                required
                className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal/90 text-sm font-medium"
              >
                등록
              </button>
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-bg-muted text-text-secondary rounded-lg hover:bg-bg-muted/80 text-sm font-medium"
              >
                취소
              </button>
            </div>
          </form>
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
          ) : filteredStudents.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">
              {searchQuery ? '검색 결과가 없습니다.' : '등록된 학생이 없습니다.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: '#F8F8F6', height: '44px' }}>
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
                  {filteredStudents.map((student) => {
                    const rankInfo = student.latest_level ? getLevelRank(student.latest_level) : null;
                    return (
                      <tr
                        key={student.id}
                        className="border-b border-border-subtle hover:bg-bg-muted transition-colors"
                        style={{ height: '52px' }}
                      >
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
                        <td className="px-4 whitespace-nowrap">
                          {rankInfo ? (
                            <span
                              className="inline-flex items-center px-2 py-1 rounded text-xs font-medium text-white whitespace-nowrap"
                              style={{ backgroundColor: rankInfo.bgColor }}
                            >
                              Lv.{student.latest_level} {rankInfo.nameKo}
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
                                setEditData({ name: student.name, password: '' });
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
        </div>

        {/* Edit Form Modal */}
        {editingId && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-surface border border-border-subtle rounded-xl p-6 w-full max-w-md space-y-4">
              <h2 className="text-lg font-semibold text-text-primary">학생 정보 수정</h2>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="새 이름"
                  value={editData.name}
                  onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                <input
                  type="password"
                  placeholder="새 비밀번호 (선택)"
                  value={editData.password}
                  onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                  className="w-full px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
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
                    setEditData({ name: '', password: '' });
                  }}
                  className="flex-1 px-4 py-2 bg-bg-muted text-text-secondary rounded-lg text-sm font-medium hover:bg-bg-muted/80"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TeacherLayout>
  );
}

export default StudentManagePage;
