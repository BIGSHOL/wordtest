/**
 * Test assignment API service.
 */
import api from './api';

export interface AssignTestRequest {
  student_ids: string[];
  test_type?: 'placement' | 'periodic';
  question_count: number;
  per_question_time_seconds: number;
  question_types: string[];
  book_name?: string;
  book_name_end?: string;
  lesson_range_start?: string;
  lesson_range_end?: string;
}

export interface TestAssignmentItem {
  id: string;
  student_id: string;
  student_name: string;
  student_school: string | null;
  student_grade: string | null;
  test_code: string;
  test_type: 'placement' | 'periodic';
  question_count: number;
  per_question_time_seconds: number | null;
  question_types: string | null;
  lesson_range: string | null;
  assignment_type?: 'mastery' | 'legacy';
  status: 'pending' | 'in_progress' | 'completed';
  assigned_at: string;
  test_session_id: string | null;
  learning_session_id: string | null;
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
};

export default testAssignmentService;
