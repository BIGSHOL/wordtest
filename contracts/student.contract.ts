import type { User } from './types';

// POST /api/v1/students
export interface CreateStudentRequest {
  username: string;
  password: string;
  name: string;
}
export type CreateStudentResponse = User;

// GET /api/v1/students
export type ListStudentsResponse = User[];

// PATCH /api/v1/students/:id
export interface UpdateStudentRequest {
  name?: string;
  password?: string;
}
export type UpdateStudentResponse = User;

// DELETE /api/v1/students/:id  → 204 No Content
