/**
 * Teacher management API service (master only).
 */
import api from './api';
import type { User } from '../types/auth';

export interface TeacherWithStats extends User {
  student_count: number;
}

export interface CreateTeacherRequest {
  name: string;
  username: string;
  password: string;
  phone_number?: string;
  school_name?: string;
}

export interface UpdateTeacherRequest {
  name?: string;
  password?: string;
  phone_number?: string;
  school_name?: string;
}

export const teacherService = {
  async listTeachers(): Promise<TeacherWithStats[]> {
    const response = await api.get<TeacherWithStats[]>('/api/v1/teachers');
    return response.data;
  },

  async createTeacher(data: CreateTeacherRequest): Promise<User> {
    const response = await api.post<User>('/api/v1/teachers', data);
    return response.data;
  },

  async updateTeacher(id: string, data: UpdateTeacherRequest): Promise<User> {
    const response = await api.patch<User>(`/api/v1/teachers/${id}`, data);
    return response.data;
  },

  async deleteTeacher(id: string): Promise<void> {
    await api.delete(`/api/v1/teachers/${id}`);
  },
};

export default teacherService;
