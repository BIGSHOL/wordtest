/**
 * Adaptive Mastery Learning System types.
 *
 * - No visible stages to users
 * - 50 questions per batch, mixed question types
 * - Adaptive level progression (Level 1-15)
 * - Question types determined by internal mastery stage (invisible to user)
 */

// --- Question type configuration ---

export type QuestionType =
  | 'word_to_meaning'    // English → pick Korean (choice)
  | 'meaning_to_word'    // Korean → pick English (choice)
  | 'listen_and_type'    // Listen → type English
  | 'listen_to_meaning'  // Listen → pick Korean (choice)
  | 'meaning_and_type';  // Korean → type English

export function isTypingQuestion(type: string): boolean {
  return type === 'listen_and_type' || type === 'meaning_and_type';
}

export function isListenQuestion(type: string): boolean {
  return type === 'listen_and_type' || type === 'listen_to_meaning';
}

export function isChoiceQuestion(type: string): boolean {
  return type === 'word_to_meaning' || type === 'meaning_to_word' || type === 'listen_to_meaning';
}

/** Get timer for a question type */
export function getQuestionTimer(type: string): number {
  switch (type) {
    case 'word_to_meaning':
    case 'meaning_to_word':
      return 5;
    case 'listen_to_meaning':
      return 10;
    case 'listen_and_type':
    case 'meaning_and_type':
      return 15;
    default:
      return 5;
  }
}

// --- Stage config (internal only, kept for backward compat) ---

export type StageNumber = 1 | 2 | 3 | 4 | 5;

export const STAGE_CONFIG = {
  1: { name: '단어 뜻 고르기', timer: 5, type: 'choice' as const, color: '#86EFAC' },
  2: { name: '영단어 고르기', timer: 5, type: 'choice' as const, color: '#4ADE80' },
  3: { name: '발음 듣고 쓰기', timer: 15, type: 'typing' as const, color: '#22C55E' },
  4: { name: '발음 듣고 뜻 고르기', timer: 10, type: 'choice' as const, color: '#16A34A' },
  5: { name: '뜻 보고 영단어 쓰기', timer: 15, type: 'typing' as const, color: '#15803D' },
} as const;

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
  question_count: number;
  access_token?: string;
  student_name?: string;
  assignment_type: string;
  current_level: number;
}

export interface MasteryBatchResponse {
  questions: MasteryQuestion[];
  remaining_in_stage: number;
  stage_summary: StageSummary;
  current_level: number;
  previous_level: number;
  level_changed: boolean;
}

export interface CompleteBatchResponse {
  current_level: number;
  previous_level: number;
  level_changed: boolean;
  accuracy: number;
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
  current_level: number;
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
