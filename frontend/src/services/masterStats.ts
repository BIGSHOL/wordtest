import api from './api';

// Types
export interface DailyGrowth {
  date: string;
  learning_sessions: number;
  grammar_sessions: number;
  new_students: number;
}

export interface SystemOverview {
  total_students: number;
  total_teachers: number;
  total_learning_sessions: number;
  total_grammar_sessions: number;
  total_learning_answers: number;
  total_grammar_answers: number;
  total_words: number;
  total_grammar_questions: number;
  daily_growth: DailyGrowth[];
}

export interface WordCalibrationItem {
  word_id: string;
  english: string;
  korean: string;
  book_name: string;
  lesson: string;
  curriculum_level: number;
  actual_accuracy: number;
  attempt_count: number;
  avg_time_sec: number | null;
  suggested_level: number;
  gap: number;
}

export interface GrammarCalibrationItem {
  question_id: string;
  question_type: string;
  question_type_label: string;
  book_title: string;
  chapter_title: string;
  assigned_difficulty: number;
  actual_accuracy: number;
  attempt_count: number;
  avg_time_sec: number | null;
  suggested_difficulty: number;
  gap: number;
}

export interface CalibrationResponse {
  word_calibrations: WordCalibrationItem[];
  grammar_calibrations: GrammarCalibrationItem[];
}

export interface BadQuestionItem {
  question_id: string;
  question_type: string;
  question_type_label: string;
  book_title: string;
  chapter_title: string;
  difficulty: number;
  accuracy: number;
  attempt_count: number;
  avg_time_sec: number | null;
  flag_reason: string;
}

export interface BadWordItem {
  word_id: string;
  english: string;
  korean: string;
  book_name: string;
  curriculum_level: number;
  accuracy: number;
  attempt_count: number;
  flag_reason: string;
}

export interface BadQuestionResponse {
  grammar_issues: BadQuestionItem[];
  word_issues: BadWordItem[];
}

export interface ConfusedPair {
  correct_answer: string;
  wrong_answer: string;
  confusion_count: number;
}

export interface QuestionTypeAccuracy {
  question_type: string;
  label: string;
  total: number;
  correct: number;
  accuracy_pct: number;
  avg_time_sec: number | null;
}

export interface ErrorPatternResponse {
  confused_word_pairs: ConfusedPair[];
  word_question_type_breakdown: QuestionTypeAccuracy[];
  grammar_question_type_breakdown: QuestionTypeAccuracy[];
}

export interface StageCount {
  stage: number;
  count: number;
}

export interface StageDuration {
  stage: number;
  avg_days: number;
}

export interface SrsOptimizationData {
  stage_distribution: StageCount[];
  avg_days_per_stage: StageDuration[];
  total_mastered: number;
}

export const masterStatsService = {
  getOverview: () => api.get<SystemOverview>('/api/v1/master-stats/overview').then(r => r.data),
  getCalibration: () => api.get<CalibrationResponse>('/api/v1/master-stats/calibration').then(r => r.data),
  getBadQuestions: () => api.get<BadQuestionResponse>('/api/v1/master-stats/bad-questions').then(r => r.data),
  getErrorPatterns: () => api.get<ErrorPatternResponse>('/api/v1/master-stats/error-patterns').then(r => r.data),
  getSrsData: () => api.get<SrsOptimizationData>('/api/v1/master-stats/srs-data').then(r => r.data),
};
