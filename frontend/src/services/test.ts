/**
 * Level test API service.
 */
import api from './api';

export interface StartTestRequest {
  test_type: 'placement' | 'periodic';
  test_code?: string;
}

export interface SubmitAnswerRequest {
  word_id: string;
  selected_answer: string;
  question_order: number;
}

export interface TestQuestion {
  question_order: number;
  word: { id: string; english: string; example_en?: string };
  choices: string[];
}

export interface TestSessionData {
  id: string;
  student_id: string;
  test_type: string;
  total_questions: number;
  correct_count: number;
  determined_level: number | null;
  determined_sublevel: number | null;
  rank_name: string | null;
  rank_label: string | null;
  score: number | null;
  test_config_id: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface StartTestResponse {
  test_session: TestSessionData;
  questions: TestQuestion[];
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
}

export interface AnswerDetail {
  question_order: number;
  word_english: string;
  correct_answer: string;
  selected_answer: string | null;
  is_correct: boolean;
}

export interface TestResultResponse {
  test_session: TestSessionData;
  answers: AnswerDetail[];
}

export interface ListTestsResponse {
  tests: TestSessionData[];
}

export const testService = {
  async startTest(data: StartTestRequest): Promise<StartTestResponse> {
    const response = await api.post<StartTestResponse>('/api/v1/tests/start', data);
    return response.data;
  },

  async submitAnswer(testId: string, data: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
    const response = await api.post<SubmitAnswerResponse>(`/api/v1/tests/${testId}/answer`, data);
    return response.data;
  },

  async getTestResult(testId: string): Promise<TestResultResponse> {
    const response = await api.get<TestResultResponse>(`/api/v1/tests/${testId}/result`);
    return response.data;
  },

  async listTests(studentId?: string): Promise<ListTestsResponse> {
    const params = studentId ? { student_id: studentId } : {};
    const response = await api.get<ListTestsResponse>('/api/v1/tests', { params });
    return response.data;
  },
};

export default testService;
