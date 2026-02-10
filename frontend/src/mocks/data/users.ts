import type { User } from '../../types/auth';

export const mockTeacher: User = {
  id: 'teacher-001',
  email: null,
  username: 'teacher01',
  name: 'Test Teacher',
  role: 'teacher',
  teacher_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const mockStudent: User = {
  id: 'student-001',
  email: null,
  username: 'student01',
  name: 'Test Student',
  role: 'student',
  teacher_id: 'teacher-001',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const mockStudents: User[] = [
  mockStudent,
  {
    id: 'student-002',
    email: null,
    username: 'student02',
    name: 'Test Student 2',
    role: 'student',
    teacher_id: 'teacher-001',
    created_at: '2026-01-02T00:00:00Z',
    updated_at: '2026-01-02T00:00:00Z',
  },
];
