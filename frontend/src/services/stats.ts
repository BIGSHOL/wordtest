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

export interface TestResultItem {
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
}

export interface AllResultsResponse {
  results: TestResultItem[];
  total: number;
}

export interface WordStat {
  word_id: string;
  english: string;
  korean: string;
  accuracy: number;
  attempt_count: number;
  avg_time_seconds: number | null;
}

export interface WordStatsResponse {
  lowest_accuracy: WordStat[];
  slowest_response: WordStat[];
}

export const statsService = {
  async getAllResults(params?: {
    search?: string;
    test_type?: string;
    skip?: number;
    limit?: number;
  }): Promise<AllResultsResponse> {
    const response = await api.get<AllResultsResponse>('/api/v1/stats/all-results', { params });
    return response.data;
  },

  async getWordStats(period: string = 'all'): Promise<WordStatsResponse> {
    const response = await api.get<WordStatsResponse>('/api/v1/stats/word-stats', { params: { period } });
    return response.data;
  },

  async getDashboardStats(period: string = 'all'): Promise<DashboardStats> {
    const response = await api.get<DashboardStats>('/api/v1/stats/dashboard', { params: { period } });
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
