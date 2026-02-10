/**
 * Student management API service.
 */
import api from './api';
import type { User } from '../types/auth';

export interface CreateStudentRequest {
  username: string;
  password: string;
  name: string;
}

export interface UpdateStudentRequest {
  name?: string;
  password?: string;
}

export const studentService = {
  async listStudents(): Promise<User[]> {
    const response = await api.get<User[]>('/api/v1/students');
    return response.data;
  },

  async createStudent(data: CreateStudentRequest): Promise<User> {
    const response = await api.post<User>('/api/v1/students', data);
    return response.data;
  },

  async updateStudent(id: string, data: UpdateStudentRequest): Promise<User> {
    const response = await api.patch<User>(`/api/v1/students/${id}`, data);
    return response.data;
  },

  async deleteStudent(id: string): Promise<void> {
    await api.delete(`/api/v1/students/${id}`);
  },
};

export default studentService;
