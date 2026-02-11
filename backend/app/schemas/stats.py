"""Statistics schemas."""
from typing import Optional
from pydantic import BaseModel


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
