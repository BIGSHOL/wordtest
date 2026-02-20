/**
 * Statistics/analytics API service.
 */
import api from './api';
import type { EnhancedTestReport, MasteryReport } from '../types/report';

export interface DashboardStats {
  total_students: number;
  total_words: number;
  total_tests: number;
  avg_score: number;
  avg_time_seconds: number;
  level_distribution: { level: number; count: number }[];
  recent_tests: {
    id: string;
    student_id: string;
    student_name: string;
    student_school: string | null;
    student_grade: string | null;
    score: number | null;
    determined_level: number | null;
    rank_name: string | null;
    rank_label: string | null;
    total_questions: number;
    correct_count: number;
    duration_seconds: number | null;
    completed_at: string | null;
    test_type: 'test' | 'mastery';
  }[];
  weekly_test_count: number;
  today_test_count: number;
  score_trend: { date: string; avg_score: number; count: number }[];
}

export interface TestHistoryItem {
  id: string | null;
  test_date: string;
  accuracy: number;
  determined_level: number | null;
  rank_name: string | null;
  rank_label: string | null;
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

  async getEnhancedReport(studentId: string, testId: string): Promise<EnhancedTestReport> {
    const response = await api.get<EnhancedTestReport>(
      `/api/v1/stats/student/${studentId}/report/${testId}`,
    );
    return response.data;
  },

  async getMasteryReport(studentId: string, sessionId: string): Promise<MasteryReport> {
    const response = await api.get<MasteryReport>(
      `/api/v1/stats/student/${studentId}/mastery-report/${sessionId}`,
    );
    return response.data;
  },
};

export default statsService;
