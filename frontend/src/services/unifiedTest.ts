/**
 * Unified Test API service for both Level-Up (adaptive) and Legacy (fixed) engines.
 */
import api from './api';

// ── Shared Types ────────────────────────────────────────────────────────────

export interface QuestionWord {
  id: string;
  english: string;
  korean: string | null;
  example_en: string | null;
  example_ko: string | null;
  level: number;
  lesson: string;
  part_of_speech: string | null;
}

export interface UnifiedQuestion {
  word_mastery_id: string;
  word: QuestionWord;
  stage: number;
  question_type: string;
  choices: string[] | null;
  correct_answer: string;
  timer_seconds: number;
  context_mode: string;
  sentence_blank: string | null;
  emoji: string | null;
}

export interface AnswerResult {
  is_correct: boolean;
  almost_correct?: boolean;
  correct_answer: string;
  word_level?: number;
  example_en?: string | null;
  example_ko?: string | null;
}

// ── Level-Up Types ──────────────────────────────────────────────────────────

export interface StartLevelupResponse {
  session_id: string;
  assignment_id: string;
  questions: UnifiedQuestion[];
  total_words: number;
  question_count: number;
  student_name: string;
  student_id: string;
  engine_type: 'levelup';
  current_level: number;
  level_info: Record<number, number>;
  available_levels: number[];
  per_question_time: number;
  total_time_seconds: number;
  time_mode: 'per_question' | 'total';
  access_token: string;
  book_name: string | null;
  book_name_end: string | null;
  lesson_range_start: string | null;
  lesson_range_end: string | null;
}

export interface LevelupBatchResponse {
  questions: UnifiedQuestion[];
  level: number;
}

export interface CompleteLevelupResponse {
  final_level: number;
  accuracy: number;
  total_answered: number;
  correct_count: number;
  best_combo: number;
}

// ── Legacy Types ────────────────────────────────────────────────────────────

export interface StartLegacyResponse {
  session_id: string;
  assignment_id: string;
  questions: UnifiedQuestion[];
  total_words: number;
  question_count: number;
  student_name: string;
  student_id: string;
  engine_type: 'legacy';
  per_question_time: number;
  total_time_seconds: number;
  time_mode: 'per_question' | 'total';
  access_token: string;
  book_name: string | null;
  book_name_end: string | null;
  lesson_range_start: string | null;
  lesson_range_end: string | null;
}

export interface CompleteLegacyResponse {
  accuracy: number;
  total_answered: number;
  correct_count: number;
}

// ── Exam Mode Batch Types ────────────────────────────────────────────────────

export interface BatchAnswerItem {
  word_mastery_id: string;
  selected_answer: string;
  question_type?: string;
}

export interface LevelupBatchSubmitResult {
  final_level: number;
  accuracy: number;
  total_answered: number;
  correct_count: number;
  best_combo: number;
}

export interface LegacyBatchSubmitResult {
  accuracy: number;
  total_answered: number;
  correct_count: number;
}

// ── API Service ─────────────────────────────────────────────────────────────

export interface CheckCodeResponse {
  engine_type: 'levelup' | 'legacy';
  status: string;
  assignment_id: string;
}

export const unifiedTestService = {
  // ── Check Code ─────────────────────────────────────────────────────────

  async checkCode(testCode: string): Promise<CheckCodeResponse> {
    const response = await api.post<CheckCodeResponse>(
      '/api/v1/levelup/check-code',
      { test_code: testCode },
    );
    return response.data;
  },

  // ── Level-Up ──────────────────────────────────────────────────────────

  async startLevelup(testCode: string, allowRestart = false): Promise<StartLevelupResponse> {
    const response = await api.post<StartLevelupResponse>(
      '/api/v1/levelup/start-by-code',
      { test_code: testCode, allow_restart: allowRestart },
    );
    return response.data;
  },

  async fetchLevelQuestions(
    sessionId: string,
    level: number,
    batchSize = 10,
  ): Promise<LevelupBatchResponse> {
    const response = await api.post<LevelupBatchResponse>(
      '/api/v1/levelup/batch',
      { session_id: sessionId, level, batch_size: batchSize },
    );
    return response.data;
  },

  async submitLevelupAnswer(
    sessionId: string,
    data: {
      word_mastery_id: string;
      selected_answer: string;
      time_taken_seconds?: number;
      question_type?: string;
    },
  ): Promise<AnswerResult> {
    const response = await api.post<AnswerResult>(
      `/api/v1/levelup/${sessionId}/answer`,
      data,
    );
    return response.data;
  },

  async completeLevelup(
    sessionId: string,
    finalLevel: number,
    bestCombo: number,
  ): Promise<CompleteLevelupResponse> {
    const response = await api.post<CompleteLevelupResponse>(
      '/api/v1/levelup/complete',
      { session_id: sessionId, final_level: finalLevel, best_combo: bestCombo },
    );
    return response.data;
  },

  // ── Legacy ────────────────────────────────────────────────────────────

  async startLegacy(testCode: string, allowRestart = false): Promise<StartLegacyResponse> {
    const response = await api.post<StartLegacyResponse>(
      '/api/v1/legacy/start-by-code',
      { test_code: testCode, allow_restart: allowRestart },
    );
    return response.data;
  },

  async submitLegacyAnswer(
    sessionId: string,
    data: {
      word_mastery_id: string;
      selected_answer: string;
      time_taken_seconds?: number;
      question_type?: string;
    },
  ): Promise<AnswerResult> {
    const response = await api.post<AnswerResult>(
      `/api/v1/legacy/${sessionId}/answer`,
      data,
    );
    return response.data;
  },

  async completeLegacy(sessionId: string): Promise<CompleteLegacyResponse> {
    const response = await api.post<CompleteLegacyResponse>(
      '/api/v1/legacy/complete',
      { session_id: sessionId },
    );
    return response.data;
  },

  async submitLevelupBatch(
    sessionId: string,
    answers: BatchAnswerItem[],
    availableLevels: number[],
    startingLevel: number,
  ): Promise<LevelupBatchSubmitResult> {
    const response = await api.post<LevelupBatchSubmitResult>(
      `/api/v1/levelup/${sessionId}/submit-batch`,
      { answers, available_levels: availableLevels, starting_level: startingLevel },
    );
    return response.data;
  },

  async submitLegacyBatch(
    sessionId: string,
    answers: BatchAnswerItem[],
  ): Promise<LegacyBatchSubmitResult> {
    const response = await api.post<LegacyBatchSubmitResult>(
      `/api/v1/legacy/${sessionId}/submit-batch`,
      { answers },
    );
    return response.data;
  },
};
