import type { User } from '../../types/auth';

export const mockTeacher: User = {
  id: '355c2ee6-cdab-41cf-8b76-a703f8b00ea0',
  email: null,
  username: 'st2000423',
  name: 'PSS',
  role: 'teacher',
  teacher_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const mockStudent: User = {
  id: '4473f20e-b8d1-4196-9f5d-731cb7cd722a',
  email: null,
  username: 'test01',
  name: '테스트01',
  role: 'student',
  teacher_id: '355c2ee6-cdab-41cf-8b76-a703f8b00ea0',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

export const mockStudents: User[] = [
  mockStudent,
];
