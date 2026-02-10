import type { TestSession, Word } from './types';

// POST /api/v1/tests/start
export interface StartTestRequest {
  test_type: 'placement' | 'periodic';
}

export interface TestQuestion {
  question_order: number;
  word: {
    id: string;
    english: string;
  };
  choices: string[];  // 4 choices (1 correct + 3 wrong)
}

export interface StartTestResponse {
  test_session: TestSession;
  questions: TestQuestion[];
}

// POST /api/v1/tests/:id/answer
export interface SubmitAnswerRequest {
  word_id: string;
  selected_answer: string;
  question_order: number;
}

export interface SubmitAnswerResponse {
  is_correct: boolean;
  correct_answer: string;
}

// GET /api/v1/tests/:id/result
export interface TestResultResponse {
  test_session: TestSession;
  answers: {
    question_order: number;
    word_english: string;
    correct_answer: string;
    selected_answer: string | null;
    is_correct: boolean;
  }[];
}

// GET /api/v1/tests (teacher: student's test history)
export interface ListTestsResponse {
  tests: TestSession[];
}
