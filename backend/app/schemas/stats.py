"""Statistics schemas."""
from typing import Optional
from pydantic import BaseModel


class LevelDistribution(BaseModel):
    level: int
    count: int


class RecentTest(BaseModel):
    id: str
    student_name: str
    score: Optional[int]
    determined_level: Optional[int]
    completed_at: Optional[str]


class ScoreTrend(BaseModel):
    date: str
    avg_score: float
    count: int


class DashboardStats(BaseModel):
    total_students: int
    total_words: int
    total_tests: int
    avg_score: float
    avg_time_seconds: float
    level_distribution: list[LevelDistribution]
    recent_tests: list[RecentTest]
    weekly_test_count: int
    score_trend: list[ScoreTrend]
