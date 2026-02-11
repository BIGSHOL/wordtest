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
