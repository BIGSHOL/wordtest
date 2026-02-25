/**
 * Test assignment API service.
 */
import api from './api';

export interface AssignTestRequest {
  student_ids: string[];
  name?: string;
  engine: 'levelup' | 'legacy';
  question_count: number;
  per_question_time_seconds: number;
  question_types: string[];
  book_name?: string;
  book_name_end?: string;
  lesson_range_start?: string;
  lesson_range_end?: string;
  total_time_override_seconds?: number;
  question_type_counts?: Record<string, number>;
}

export interface TestAssignmentItem {
  id: string;
  test_config_id: string;
  student_id: string;
  student_name: string;
  student_school: string | null;
  student_grade: string | null;
  test_code: string;
  test_type: 'placement' | 'periodic' | 'listening';
  question_count: number;
  per_question_time_seconds: number | null;
  question_types: string | null;
  lesson_range: string | null;
  assignment_type?: 'mastery' | 'legacy' | 'stage_test' | 'listening';
  engine_type?: string | null;
  total_time_override_seconds?: number | null;
  question_type_counts?: string | null;
  status: 'pending' | 'in_progress' | 'completed';
  assigned_at: string;
  test_session_id: string | null;
  learning_session_id: string | null;
}

export interface TestConfigItem {
  id: string;
  teacher_id: string;
  name: string;
  test_type: string;
  question_count: number;
  time_limit_seconds: number;
  is_active: boolean;
  book_name: string | null;
  book_name_end: string | null;
  level_range_min: number;
  level_range_max: number;
  per_question_time_seconds: number | null;
  total_time_override_seconds: number | null;
  question_types: string | null;        // comma-separated
  question_type_counts: string | null;  // JSON string
  lesson_range_start: string | null;
  lesson_range_end: string | null;
  assignment_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateTestConfigRequest {
  name?: string;
  engine: 'levelup' | 'legacy';
  question_count: number;
  per_question_time_seconds: number;
  question_types: string[];
  book_name?: string;
  book_name_end?: string;
  lesson_range_start?: string;
  lesson_range_end?: string;
  total_time_override_seconds?: number;
  question_type_counts?: Record<string, number>;
}

export const testAssignmentService = {
  async assignTest(data: AssignTestRequest): Promise<TestAssignmentItem[]> {
    const response = await api.post<TestAssignmentItem[]>('/api/v1/test-assignments', data);
    return response.data;
  },

  async listAssignments(): Promise<TestAssignmentItem[]> {
    const response = await api.get<TestAssignmentItem[]>('/api/v1/test-assignments');
    return response.data;
  },

  async deleteAssignment(id: string): Promise<void> {
    await api.delete(`/api/v1/test-assignments/${id}`);
  },

  async resetAssignment(id: string): Promise<void> {
    await api.patch(`/api/v1/test-assignments/${id}/reset`);
  },

  async createTestConfig(data: CreateTestConfigRequest): Promise<TestConfigItem> {
    const response = await api.post<TestConfigItem>('/api/v1/test-configs', data);
    return response.data;
  },

  async listTestConfigs(): Promise<TestConfigItem[]> {
    const response = await api.get<TestConfigItem[]>('/api/v1/test-configs');
    return response.data;
  },

  async assignStudentsToConfig(configId: string, studentIds: string[]): Promise<TestAssignmentItem[]> {
    const response = await api.post<TestAssignmentItem[]>(`/api/v1/test-configs/${configId}/assign`, { student_ids: studentIds });
    return response.data;
  },

  async updateTestConfig(configId: string, data: { name?: string }): Promise<TestConfigItem> {
    const response = await api.patch<TestConfigItem>(`/api/v1/test-configs/${configId}`, data);
    return response.data;
  },

  async deleteTestConfig(configId: string): Promise<void> {
    await api.delete(`/api/v1/test-configs/${configId}`);
  },
};

export default testAssignmentService;
