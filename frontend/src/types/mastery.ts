/**
 * 5-Stage Word Mastery System types & configuration.
 *
 * Visual metaphor: Seed → Sprout → Sapling → Tree → Fruit
 */

// --- Stage configuration ---

export const STAGE_CONFIG = {
  1: { name: '단어 뜻 고르기', icon: 'seed', timer: 5, type: 'choice' as const, color: '#9CA3AF', label: '씨앗' },
  2: { name: '영단어 고르기', icon: 'sprout', timer: 5, type: 'choice' as const, color: '#10B981', label: '새싹' },
  3: { name: '발음 듣고 쓰기', icon: 'sapling', timer: 15, type: 'typing' as const, color: '#3B82F6', label: '묘목' },
  4: { name: '발음 듣고 뜻 고르기', icon: 'tree', timer: 10, type: 'choice' as const, color: '#F59E0B', label: '나무' },
  5: { name: '뜻 보고 영단어 쓰기', icon: 'fruit', timer: 15, type: 'typing' as const, color: '#EF4444', label: '열매' },
} as const;

export type StageNumber = 1 | 2 | 3 | 4 | 5;

// --- API response types ---

export interface MasteryQuestionWord {
  id: string;
  english: string;
  korean?: string;
  example_en?: string;
  example_ko?: string;
  level: number;
  lesson: string;
  part_of_speech?: string;
}

export interface MasteryQuestion {
  word_mastery_id: string;
  word: MasteryQuestionWord;
  stage: number;
  question_type: string;
  choices: string[] | null;
  correct_answer: string;
  timer_seconds: number;
  context_mode: 'word' | 'sentence';
  sentence_blank: string | null;
}

export interface StageSummary {
  stage_1: number;
  stage_2: number;
  stage_3: number;
  stage_4: number;
  stage_5: number;
  mastered: number;
}

export interface MasterySessionInfo {
  id: string;
  assignment_id: string;
  current_stage: number;
  words_practiced: number;
  words_advanced: number;
  best_combo: number;
  started_at: string;
}

export interface StartMasteryResponse {
  session: MasterySessionInfo;
  stage_summary: StageSummary;
  questions: MasteryQuestion[];
  total_words: number;
  access_token?: string;
  student_name?: string;
  assignment_type: string;
}

export interface MasteryBatchResponse {
  questions: MasteryQuestion[];
  remaining_in_stage: number;
  stage_summary: StageSummary;
}

export interface MasteryAnswerResult {
  is_correct: boolean;
  almost_correct: boolean;
  correct_answer: string;
  new_stage: number;
  previous_stage: number;
  word_mastered: boolean;
  stage_streak: number;
  required_streak: number;
  example_en?: string;
  example_ko?: string;
}

export interface MasteryProgressResponse {
  assignment_id: string;
  student_name: string;
  total_words: number;
  stage_summary: StageSummary;
  mastery_rate: number;
  last_practiced_at?: string;
  word_details: WordMasteryDetail[];
}

export interface WordMasteryDetail {
  word_id: string;
  english: string;
  korean: string;
  stage: number;
  total_attempts: number;
  total_correct: number;
  mastered: boolean;
  last_practiced_at?: string;
}
