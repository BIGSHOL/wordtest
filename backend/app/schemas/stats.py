"""Statistics schemas."""
from typing import Optional
from pydantic import BaseModel
from app.schemas.test import TestSessionResponse, AnswerDetail


class LevelDistribution(BaseModel):
    level: int
    count: int


class RecentTest(BaseModel):
    id: str
    student_id: str
    student_name: str
    student_school: Optional[str] = None
    student_grade: Optional[str] = None
    score: Optional[int] = None
    determined_level: Optional[int] = None
    rank_name: Optional[str] = None
    rank_label: Optional[str] = None
    total_questions: int = 0
    correct_count: int = 0
    duration_seconds: Optional[int] = None
    completed_at: Optional[str] = None
    test_type: str = "test"  # "test" | "mastery"


class ScoreTrend(BaseModel):
    date: str
    avg_score: float
    count: int


class TestHistoryItem(BaseModel):
    test_date: str
    accuracy: int
    determined_level: Optional[int] = None
    rank_name: Optional[str] = None
    rank_label: Optional[str] = None
    correct_count: int
    total_questions: int
    duration_seconds: Optional[int] = None


class TestHistoryResponse(BaseModel):
    history: list[TestHistoryItem]


class WordStat(BaseModel):
    word_id: str
    english: str
    korean: str
    accuracy: float  # 0-100
    attempt_count: int
    avg_time_seconds: Optional[float] = None


class WordStatsResponse(BaseModel):
    lowest_accuracy: list[WordStat]
    slowest_response: list[WordStat]


class RadarMetrics(BaseModel):
    vocabulary_level: float  # 어휘수준 0-10
    accuracy: float          # 정답률 0-10
    speed: float             # 속도 0-10
    vocabulary_size: float   # 어휘사이즈 0-10


class MetricDetail(BaseModel):
    key: str        # "vocabulary_level" | "accuracy" | "speed" | "vocabulary_size"
    name: str       # "어휘수준" | "정답률" | "속도" | "어휘사이즈"
    my_score: float
    avg_score: float
    description: str
    raw_value: Optional[str] = None


class PeerRanking(BaseModel):
    percentile: int
    total_peers: int


class EnhancedTestReport(BaseModel):
    test_session: TestSessionResponse
    answers: list[AnswerDetail]
    radar_metrics: RadarMetrics
    metric_details: list[MetricDetail]
    peer_ranking: Optional[PeerRanking] = None
    grade_level: str
    vocab_description: str
    recommended_book: str
    total_time_seconds: Optional[int] = None
    category_times: dict[str, int] = {}


class MasteryAnswerDetail(BaseModel):
    question_order: int
    word_english: str
    word_korean: str
    correct_answer: str
    selected_answer: Optional[str] = None
    is_correct: bool
    word_level: int
    time_taken_seconds: Optional[float] = None
    stage: int


class MasteryWordSummary(BaseModel):
    word_id: str
    english: str
    korean: str
    final_stage: int
    total_attempts: int
    correct_count: int
    accuracy: float  # 0-100
    avg_time_sec: Optional[float] = None
    mastered: bool


class MasterySessionData(BaseModel):
    id: str
    student_id: str
    total_questions: int
    correct_count: int
    determined_level: Optional[int] = None
    score: Optional[int] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    best_combo: int = 0
    words_practiced: int = 0
    words_advanced: int = 0
    words_demoted: int = 0


class MasteryReportResponse(BaseModel):
    session: MasterySessionData
    answers: list[MasteryAnswerDetail]
    radar_metrics: RadarMetrics
    metric_details: list[MetricDetail]
    peer_ranking: Optional[PeerRanking] = None
    grade_level: str
    vocab_description: str
    recommended_book: str
    total_time_seconds: Optional[int] = None
    word_summaries: list[MasteryWordSummary] = []


class DashboardStats(BaseModel):
    total_students: int
    total_words: int
    total_tests: int
    avg_score: float
    avg_time_seconds: float
    level_distribution: list[LevelDistribution]
    recent_tests: list[RecentTest]
    weekly_test_count: int
    today_test_count: int
    score_trend: list[ScoreTrend]
