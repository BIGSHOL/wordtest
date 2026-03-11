/**
 * User management API service (master only).
 */
import api from './api';

export interface UserWithActivity {
  id: string;
  email: string | null;
  username: string | null;
  name: string;
  role: string;
  teacher_id: string | null;
  teacher_name: string | null;
  school_name: string | null;
  grade: string | null;
  phone_number: string | null;
  created_at: string;
  updated_at: string;
  last_active: string | null;
  total_sessions: number;
  accuracy_pct: number | null;
}

export interface UserListResponse {
  users: UserWithActivity[];
  total: number;
  page: number;
  page_size: number;
}

export interface UserListParams {
  page?: number;
  page_size?: number;
  search?: string;
  role?: string;
  sort_by?: string;
  sort_dir?: 'asc' | 'desc';
}

export interface CreateUserRequest {
  name: string;
  username: string;
  password: string;
  role: 'student' | 'teacher' | 'master';
  email?: string;
  phone_number?: string;
  school_name?: string;
  grade?: string;
  teacher_id?: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
  password?: string;
  phone_number?: string;
  school_name?: string;
  grade?: string;
  role?: string;
  teacher_id?: string;
}

export interface UserDetailSession {
  session_id: string;
  session_type: 'learning' | 'grammar' | 'legacy';
  started_at: string;
  completed_at: string | null;
  total_questions: number;
  correct_count: number;
  accuracy_pct: number | null;
  duration_seconds: number | null;
}

export interface UserDetailResponse {
  user: UserWithActivity;
  sessions: UserDetailSession[];
}

export interface ResetPasswordResponse {
  temporary_password: string;
}

export const userManagementService = {
  async listUsers(params?: UserListParams): Promise<UserListResponse> {
    const response = await api.get<UserListResponse>('/api/v1/user-management/', { params });
    return response.data;
  },

  async getUserDetail(id: string): Promise<UserDetailResponse> {
    const response = await api.get<UserDetailResponse>(`/api/v1/user-management/${id}`);
    return response.data;
  },

  async createUser(data: CreateUserRequest): Promise<UserWithActivity> {
    const response = await api.post<UserWithActivity>('/api/v1/user-management/', data);
    return response.data;
  },

  async updateUser(id: string, data: UpdateUserRequest): Promise<UserWithActivity> {
    const response = await api.patch<UserWithActivity>(`/api/v1/user-management/${id}`, data);
    return response.data;
  },

  async deleteUser(id: string): Promise<void> {
    await api.delete(`/api/v1/user-management/${id}`);
  },

  async resetPassword(id: string): Promise<ResetPasswordResponse> {
    const response = await api.post<ResetPasswordResponse>(`/api/v1/user-management/${id}/reset-password`);
    return response.data;
  },
};

export default userManagementService;
