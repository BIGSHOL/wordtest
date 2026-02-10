// ===== Common Types =====

export interface User {
  id: string;
  email: string | null;
  username: string | null;
  name: string;
  role: 'teacher' | 'student';
  teacher_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Word {
  id: string;
  english: string;
  korean: string;
  level: number;
  category: string | null;
}

export interface TestSession {
  id: string;
  student_id: string;
  test_type: 'placement' | 'periodic';
  total_questions: number;
  correct_count: number;
  determined_level: number | null;
  score: number | null;
  started_at: string;
  completed_at: string | null;
}

export interface TestAnswer {
  id: string;
  test_session_id: string;
  word_id: string;
  selected_answer: string | null;
  correct_answer: string;
  is_correct: boolean;
  question_order: number;
  answered_at: string | null;
}

// ===== API Response Envelope =====

export interface ApiResponse<T> {
  data: T;
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
