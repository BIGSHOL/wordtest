/**
 * Statistics/analytics API service.
 */
import api from './api';

export interface DashboardStats {
  total_students: number;
  total_words: number;
  total_tests: number;
  avg_score: number;
  avg_time_seconds: number;
  level_distribution: { level: number; count: number }[];
  recent_tests: {
    id: string;
    student_name: string;
    score: number;
    determined_level: number | null;
    completed_at: string;
  }[];
  weekly_test_count: number;
  score_trend: { date: string; avg_score: number; count: number }[];
}

export interface TestHistoryItem {
  test_date: string;
  accuracy: number;
  determined_level: number | null;
  rank_name: string | null;
  correct_count: number;
  total_questions: number;
  duration_seconds: number | null;
}

export interface TestHistoryResponse {
  history: TestHistoryItem[];
}

export const statsService = {
  async getDashboardStats(): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/api/v1/stats/dashboard');
    return response.data;
  },

  async getStudentHistory(studentId: string): Promise<TestHistoryResponse> {
    const response = await api.get<TestHistoryResponse>(`/api/v1/stats/student/${studentId}/history`);
    return response.data;
  },
};

export default statsService;
