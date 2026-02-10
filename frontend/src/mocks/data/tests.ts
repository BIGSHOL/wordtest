/**
 * Mock test data.
 * Types inlined to avoid cross-boundary imports from contracts/.
 */

interface MockTestSession {
  id: string;
  student_id: string;
  test_type: string;
  total_questions: number;
  correct_count: number;
  determined_level: number | null;
  score: number | null;
  started_at: string;
  completed_at: string | null;
}

interface MockTestQuestion {
  question_order: number;
  word: { id: string; english: string };
  choices: string[];
}

export const mockTestSession: MockTestSession = {
  id: 'test-001',
  student_id: 'student-001',
  test_type: 'placement',
  total_questions: 20,
  correct_count: 0,
  determined_level: null,
  score: null,
  started_at: '2026-01-10T10:00:00Z',
  completed_at: null,
};

export const mockQuestions: MockTestQuestion[] = [
  {
    question_order: 1,
    word: { id: 'word-001', english: 'apple' },
    choices: ['사과', '배', '포도', '수박'],
  },
  {
    question_order: 2,
    word: { id: 'word-002', english: 'book' },
    choices: ['책', '연필', '지우개', '가방'],
  },
  {
    question_order: 3,
    word: { id: 'word-003', english: 'computer' },
    choices: ['컴퓨터', '전화기', '텔레비전', '라디오'],
  },
];

export const mockCompletedSession: MockTestSession = {
  ...mockTestSession,
  id: 'test-002',
  correct_count: 15,
  determined_level: 3,
  score: 75,
  completed_at: '2026-01-10T10:30:00Z',
};
