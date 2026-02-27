/** Grammar test API service */
import api from './api';
import type {
  GrammarBook,
  GrammarChapter,
  GrammarConfig,
  GrammarAssignment,
  GrammarQuestionBrowse,
  StartGrammarResponse,
  GrammarAnswerResult,
  GrammarCompleteResult,
} from '../types/grammar';

export const grammarTestService = {
  // ── Books & Chapters ──────────────────────────────────────
  async listBooks(): Promise<GrammarBook[]> {
    const res = await api.get<GrammarBook[]>('/api/v1/grammar/books');
    return res.data;
  },

  async listChapters(bookId: string): Promise<GrammarChapter[]> {
    const res = await api.get<GrammarChapter[]>(`/api/v1/grammar/books/${bookId}/chapters`);
    return res.data;
  },

  // ── Database browsing ────────────────────────────────────
  async listQuestions(params: {
    book_id?: string;
    chapter_id?: string;
    question_type?: string;
    skip?: number;
    limit?: number;
  }): Promise<{ questions: GrammarQuestionBrowse[]; total: number }> {
    const res = await api.get<{ questions: GrammarQuestionBrowse[]; total: number }>(
      '/api/v1/grammar/questions',
      { params },
    );
    return res.data;
  },

  // ── Config CRUD ───────────────────────────────────────────
  async createConfig(data: {
    name: string;
    book_ids: string[];
    chapter_ids?: string[];
    question_count: number;
    time_limit_seconds: number;
    per_question_seconds?: number;
    time_mode: string;
    question_types?: string[];
    question_type_counts?: Record<string, number>;
  }): Promise<GrammarConfig> {
    const res = await api.post<GrammarConfig>('/api/v1/grammar/configs', data);
    return res.data;
  },

  async listConfigs(): Promise<GrammarConfig[]> {
    const res = await api.get<GrammarConfig[]>('/api/v1/grammar/configs');
    return res.data;
  },

  async deleteConfig(configId: string): Promise<void> {
    await api.delete(`/api/v1/grammar/configs/${configId}`);
  },

  // ── Assignment ────────────────────────────────────────────
  async assignStudents(
    configId: string,
    studentIds: string[],
  ): Promise<{ assignments: GrammarAssignment[] }> {
    const res = await api.post<{ assignments: GrammarAssignment[] }>(
      `/api/v1/grammar/configs/${configId}/assign`,
      { student_ids: studentIds },
    );
    return res.data;
  },

  // ── Student Session ───────────────────────────────────────
  async startByCode(
    testCode: string,
    allowRestart = false,
  ): Promise<StartGrammarResponse> {
    const res = await api.post<StartGrammarResponse>(
      '/api/v1/grammar/start-by-code',
      { test_code: testCode, allow_restart: allowRestart },
    );
    return res.data;
  },

  async submitAnswer(
    sessionId: string,
    questionId: string,
    selectedAnswer: string,
    timeTakenSeconds?: number,
  ): Promise<GrammarAnswerResult> {
    const res = await api.post<GrammarAnswerResult>(
      `/api/v1/grammar/${sessionId}/answer`,
      {
        question_id: questionId,
        selected_answer: selectedAnswer,
        time_taken_seconds: timeTakenSeconds,
      },
    );
    return res.data;
  },

  async batchSubmit(
    sessionId: string,
    answers: { question_id: string; selected_answer: string; time_taken_seconds?: number }[],
  ): Promise<GrammarCompleteResult> {
    const res = await api.post<GrammarCompleteResult>(
      `/api/v1/grammar/${sessionId}/batch-submit`,
      { answers },
    );
    return res.data;
  },

  async completeSession(sessionId: string): Promise<GrammarCompleteResult> {
    const res = await api.post<GrammarCompleteResult>(
      `/api/v1/grammar/${sessionId}/complete`,
    );
    return res.data;
  },
};

export default grammarTestService;
