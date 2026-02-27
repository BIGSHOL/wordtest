/** Grammar test type definitions */

export interface GrammarBook {
  id: string;
  title: string;
  level: number;
}

export interface GrammarChapter {
  id: string;
  book_id: string;
  chapter_num: number;
  title: string;
  question_count?: number;
}

export interface GrammarQuestionBrowse {
  id: string;
  book_id: string;
  chapter_id: string;
  question_type: GrammarQuestionType;
  question_data: Record<string, any>;
  source: string;
  difficulty: number;
}

export interface GrammarConfig {
  id: string;
  teacher_id: string;
  name: string;
  book_ids: string | null;
  chapter_ids: string | null;
  question_count: number;
  time_limit_seconds: number;
  per_question_seconds: number | null;
  time_mode: string;
  question_types: string | null;
  question_type_counts: string | null;
  is_active: boolean;
}

export interface GrammarQuestion {
  id: string;
  question_type: GrammarQuestionType;
  question_data: Record<string, any>;
  question_order: number;
}

export type GrammarQuestionType =
  | 'grammar_blank'
  | 'grammar_error'
  | 'grammar_common'
  | 'grammar_usage'
  | 'grammar_transform'
  | 'grammar_order'
  | 'grammar_translate'
  | 'grammar_pair';

export const GRAMMAR_TYPE_LABELS: Record<GrammarQuestionType, string> = {
  grammar_blank: '빈칸 채우기',
  grammar_error: '오류 탐지',
  grammar_common: '공통 단어',
  grammar_usage: '쓰임 구별',
  grammar_transform: '문장 전환',
  grammar_order: '단어 배열',
  grammar_translate: '영작',
  grammar_pair: '(A)(B) 짝짓기',
};

export interface GrammarAssignment {
  student_id: string;
  student_name: string;
  test_code: string;
  assignment_id: string;
}

export interface StartGrammarResponse {
  session_id: string;
  student_id: string;
  student_name: string;
  questions: GrammarQuestion[];
  total_questions: number;
  time_limit_seconds: number;
  per_question_seconds: number | null;
  time_mode: string;
  access_token: string;
}

export interface GrammarAnswerResult {
  is_correct: boolean;
  correct_answer: string;
  question_id: string;
}

export interface GrammarCompleteResult {
  session_id: string;
  total_questions: number;
  correct_count: number;
  score: number;
  results: {
    question_id: string;
    question_type: string;
    is_correct: boolean;
    selected_answer: string;
    correct_answer: string;
  }[];
}
