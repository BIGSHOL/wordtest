/**
 * Mastery learning API service.
 */
import api from './api';
import type {
  StartMasteryResponse,
  MasteryBatchResponse,
  MasteryAnswerResult,
  MasteryProgressResponse,
} from '../types/mastery';

export const masteryService = {
  async startByCode(testCode: string): Promise<StartMasteryResponse> {
    const response = await api.post<StartMasteryResponse>(
      '/api/v1/mastery/start-by-code',
      { test_code: testCode },
    );
    return response.data;
  },

  async getBatch(
    sessionId: string,
    stage: number,
    batchSize = 10,
  ): Promise<MasteryBatchResponse> {
    const response = await api.post<MasteryBatchResponse>(
      '/api/v1/mastery/batch',
      { session_id: sessionId, stage, batch_size: batchSize },
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
    },
  ): Promise<MasteryAnswerResult> {
    const response = await api.post<MasteryAnswerResult>(
      `/api/v1/mastery/${sessionId}/answer`,
      data,
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
