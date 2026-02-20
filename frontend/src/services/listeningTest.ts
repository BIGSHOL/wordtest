/**
 * Listening Test API service - simple listen-and-pick-word test mode.
 */
import api from './api';

// --- Types ---

export interface ListeningQuestion {
  word_mastery_id: string;
  word_id: string;
  english: string;
  choices: string[];
  question_index: number;
  timer_seconds: number;
}

export interface StartListeningTestResponse {
  session_id: string;
  assignment_id: string;
  questions: ListeningQuestion[];
  total_words: number;
  per_question_time: number;
  access_token?: string;
  student_name?: string;
  assignment_type: 'listening';
}

export interface ListeningAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
}

export interface ListeningCompleteResponse {
  accuracy: number;
  total_answered: number;
  correct_count: number;
}

// --- Service ---

export const listeningTestService = {
  async startByCode(testCode: string, allowRestart = false): Promise<StartListeningTestResponse> {
    const response = await api.post<StartListeningTestResponse>(
      '/api/v1/listening-test/start-by-code',
      { test_code: testCode, allow_restart: allowRestart },
    );
    return response.data;
  },

  async submitAnswer(
    sessionId: string,
    data: {
      word_mastery_id: string;
      selected_answer: string;
      time_taken_seconds?: number;
    },
  ): Promise<ListeningAnswerResponse> {
    const response = await api.post<ListeningAnswerResponse>(
      `/api/v1/listening-test/${sessionId}/answer`,
      data,
    );
    return response.data;
  },

  async complete(sessionId: string): Promise<ListeningCompleteResponse> {
    const response = await api.post<ListeningCompleteResponse>(
      '/api/v1/listening-test/complete',
      { session_id: sessionId },
    );
    return response.data;
  },
};

export default listeningTestService;
