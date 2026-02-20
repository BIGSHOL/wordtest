/**
 * Enhanced test report types matching backend EnhancedTestReport schema.
 */
import type { TestSessionData, AnswerDetail } from '../services/test';

export interface RadarMetrics {
  vocabulary_level: number; // 어휘수준 0-10
  accuracy: number;         // 정답률 0-10
  speed: number;            // 속도 0-10
  vocabulary_size: number;  // 어휘사이즈 0-10
}

export interface MetricDetail {
  key: string;        // "vocabulary_level" | "accuracy" | "speed" | "vocabulary_size"
  name: string;       // "어휘수준" | "정답률" | "속도" | "어휘사이즈"
  my_score: number;
  avg_score: number;
  description: string;
  raw_value?: string | null;
}

export interface PeerRanking {
  percentile: number;
  total_peers: number;
}

export interface EnhancedTestReport {
  test_session: TestSessionData;
  answers: AnswerDetail[];
  radar_metrics: RadarMetrics;
  metric_details: MetricDetail[];
  peer_ranking?: PeerRanking | null;
  grade_level: string;
  vocab_description: string;
  recommended_book: string;
  total_time_seconds?: number | null;
  category_times: Record<string, number>;
}

// --- Mastery Report ---

export interface MasteryAnswerDetail {
  question_order: number;
  word_english: string;
  word_korean: string;
  correct_answer: string;
  selected_answer: string | null;
  is_correct: boolean;
  word_level: number;
  time_taken_seconds: number | null;
  stage: number;
}

export interface MasteryWordSummary {
  word_id: string;
  english: string;
  korean: string;
  final_stage: number;
  total_attempts: number;
  correct_count: number;
  accuracy: number;
  avg_time_sec: number | null;
  mastered: boolean;
}

export interface MasterySessionData {
  id: string;
  student_id: string;
  total_questions: number;
  correct_count: number;
  determined_level: number | null;
  score: number | null;
  started_at: string | null;
  completed_at: string | null;
  best_combo: number;
  words_practiced: number;
  words_advanced: number;
  words_demoted: number;
}

export interface MasteryReport {
  session: MasterySessionData;
  answers: MasteryAnswerDetail[];
  radar_metrics: RadarMetrics;
  metric_details: MetricDetail[];
  peer_ranking?: PeerRanking | null;
  grade_level: string;
  vocab_description: string;
  recommended_book: string;
  total_time_seconds?: number | null;
  total_word_count?: number;
  word_summaries: MasteryWordSummary[];
  student_name?: string | null;
  student_grade?: string | null;
  student_school?: string | null;
  test_type?: string | null;
}
