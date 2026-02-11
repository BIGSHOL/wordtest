/**
 * Mastery learning API service.
 *
 * - startByCode: returns multi-level question pool
 * - fetchLevelQuestions: lazy load for a specific level (when pool runs out)
 * - submitAnswer: submit answer + internal mastery processing
 * - completeBatch: save final level after all 50 questions
 */
import api from './api';
import type {
  StartMasteryResponse,
  MasteryBatchResponse,
  MasteryAnswerResult,
  MasteryProgressResponse,
  CompleteBatchResponse,
} from '../types/mastery';

export const masteryService = {
  async startByCode(testCode: string, allowRestart = false): Promise<StartMasteryResponse> {
    const response = await api.post<StartMasteryResponse>(
      '/api/v1/mastery/start-by-code',
      { test_code: testCode, allow_restart: allowRestart },
    );
    return response.data;
  },

  /** Lazy load more questions for a specific level when pool runs out. */
  async fetchLevelQuestions(
    sessionId: string,
    level: number,
    batchSize = 10,
  ): Promise<MasteryBatchResponse> {
    const response = await api.post<MasteryBatchResponse>(
      '/api/v1/mastery/batch',
      { session_id: sessionId, level, batch_size: batchSize },
    );
    return response.data;
  },

  async submitAnswer(
    sessionId: string,
    data: {
      word_mastery_id: string;
      selected_answer: string;
      time_taken_seconds?: number;
      stage: number;
      question_type?: string;
    },
  ): Promise<MasteryAnswerResult> {
    const response = await api.post<MasteryAnswerResult>(
      `/api/v1/mastery/${sessionId}/answer`,
      data,
    );
    return response.data;
  },

  /** Save the frontend-determined final level after 50 questions. */
  async completeBatch(
    sessionId: string,
    finalLevel: number,
  ): Promise<CompleteBatchResponse> {
    const response = await api.post<CompleteBatchResponse>(
      '/api/v1/mastery/complete-batch',
      { session_id: sessionId, final_level: finalLevel },
    );
    return response.data;
  },

  async getProgress(assignmentId: string): Promise<MasteryProgressResponse> {
    const response = await api.get<MasteryProgressResponse>(
      `/api/v1/mastery/progress/${assignmentId}`,
    );
    return response.data;
  },
};

export default masteryService;
