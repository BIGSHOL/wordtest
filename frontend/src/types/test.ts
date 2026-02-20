/**
 * Legacy test types - used for viewing historical test results.
 * These types match the old TestSession/TestAnswer backend models.
 */

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

export interface AnswerDetail {
  question_order: number;
  word_english: string;
  correct_answer: string;
  selected_answer: string | null;
  is_correct: boolean;
  word_level: number;
  time_taken_seconds: number | null;
  question_type?: string;
}
