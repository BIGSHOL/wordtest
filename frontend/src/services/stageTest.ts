/**
 * Stage Test API service - separate from mastery/level-up system.
 */
import api from './api';

// --- Types ---

export interface StageWordInfo {
  word_mastery_id: string;
  word_id: string;
  english: string;
  korean: string | null;
  stage: number;
  level: number;
  lesson: string;
}

export interface StartStageTestResponse {
  session_id: string;
  assignment_id: string;
  words: StageWordInfo[];
  initial_questions: import('../types/mastery').MasteryQuestion[];
  total_words: number;
  max_fails: number;
  access_token?: string;
  student_name?: string;
  assignment_type: 'stage_test';
}

export interface StageTestAnswerResponse {
  is_correct: boolean;
  almost_correct: boolean;
  correct_answer: string;
  new_stage: number;
  word_mastered: boolean;
}

// --- Service ---

export const stageTestService = {
  async startByCode(testCode: string, allowRestart = false): Promise<StartStageTestResponse> {
    const response = await api.post<StartStageTestResponse>(
      '/api/v1/stage-test/start-by-code',
      { test_code: testCode, allow_restart: allowRestart },
    );
    return response.data;
  },

  async fetchQuestions(
    sessionId: string,
    wordMasteryIds: string[],
  ): Promise<{ questions: import('../types/mastery').MasteryQuestion[] }> {
    const response = await api.post<{ questions: import('../types/mastery').MasteryQuestion[] }>(
      `/api/v1/stage-test/${sessionId}/questions`,
      { word_mastery_ids: wordMasteryIds },
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
  ): Promise<StageTestAnswerResponse> {
    const response = await api.post<StageTestAnswerResponse>(
      `/api/v1/stage-test/${sessionId}/answer`,
      data,
    );
    return response.data;
  },

  async complete(
    sessionId: string,
    stats: {
      mastered_count: number;
      skipped_count: number;
      total_answered: number;
      best_combo: number;
    },
  ): Promise<{ accuracy: number; total_answered: number; correct_count: number }> {
    const response = await api.post(
      '/api/v1/stage-test/complete',
      { session_id: sessionId, ...stats },
    );
    return response.data;
  },
};

export default stageTestService;
