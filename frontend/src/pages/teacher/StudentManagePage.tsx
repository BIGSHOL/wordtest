/**
 * Student management page for teachers.
 */
import { useEffect, useState } from 'react';
import { TeacherLayout } from '../../components/layout/TeacherLayout';
import { Link } from 'react-router-dom';
import type { User } from '../../types/auth';
import { studentService } from '../../services/student';

export function StudentManagePage() {
  const [students, setStudents] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [newStudent, setNewStudent] = useState({ username: '', password: '', name: '' });
  const [editData, setEditData] = useState({ name: '', password: '' });

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
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold font-display text-text-primary">학생 관리</h1>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal-dark transition-colors text-sm font-medium"
          >
            {showAddForm ? '취소' : '+ 학생 추가'}
          </button>
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
            <button
              type="submit"
              className="px-4 py-2 bg-teal text-white rounded-lg hover:bg-teal/90 text-sm font-medium"
            >
              등록
            </button>
          </form>
        )}

        {/* Student List */}
        <div className="bg-surface border border-border-subtle rounded-xl">
          {isLoading ? (
            <div className="p-8 text-center text-text-secondary">로딩 중...</div>
          ) : students.length === 0 ? (
            <div className="p-8 text-center text-text-secondary">등록된 학생이 없습니다.</div>
          ) : (
            <div className="divide-y divide-[#E2E8F0]">
              {students.map((student) => (
                <div key={student.id} className="px-5 py-4">
                  {editingId === student.id ? (
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="새 이름"
                          value={editData.name}
                          onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                          className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                        <input
                          type="password"
                          placeholder="새 비밀번호 (선택)"
                          value={editData.password}
                          onChange={(e) => setEditData({ ...editData, password: e.target.value })}
                          className="px-3 py-2 border border-border-subtle rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdate(student.id)}
                          className="px-3 py-1.5 bg-teal text-white rounded-lg text-sm"
                        >
                          저장
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditData({ name: '', password: '' }); }}
                          className="px-3 py-1.5 bg-[#F1F5F9] text-text-secondary rounded-lg text-sm"
                        >
                          취소
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-text-primary">{student.name}</p>
                        <p className="text-sm text-text-secondary">@{student.username}</p>
                      </div>
                      <div className="flex gap-2">
                        <Link
                          to={`/students/${student.id}/results`}
                          className="px-3 py-1.5 text-sm text-teal bg-teal-light rounded-lg hover:bg-teal-light/80"
                        >
                          결과
                        </Link>
                        <button
                          onClick={() => { setEditingId(student.id); setEditData({ name: student.name, password: '' }); }}
                          className="px-3 py-1.5 text-sm text-text-secondary bg-bg-muted rounded-lg hover:bg-bg-muted/80"
                        >
                          수정
                        </button>
                        <button
                          onClick={() => handleDelete(student.id, student.name)}
                          className="px-3 py-1.5 text-sm text-wrong bg-wrong-light rounded-lg hover:bg-wrong-light/80"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </TeacherLayout>
  );
}

export default StudentManagePage;
