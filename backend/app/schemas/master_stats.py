"""Master statistics schemas."""
from typing import Optional
from pydantic import BaseModel


class DailyGrowth(BaseModel):
    date: str
    learning_sessions: int
    grammar_sessions: int
    new_students: int


class SystemOverview(BaseModel):
    total_students: int
    total_teachers: int
    total_learning_sessions: int
    total_grammar_sessions: int
    total_learning_answers: int
    total_grammar_answers: int
    total_words: int
    total_grammar_questions: int
    daily_growth: list[DailyGrowth]


class WordCalibrationItem(BaseModel):
    word_id: str
    english: str
    korean: str
    book_name: str
    lesson: str
    curriculum_level: int
    actual_accuracy: float
    attempt_count: int
    avg_time_sec: Optional[float] = None
    suggested_level: int
    gap: int


class GrammarCalibrationItem(BaseModel):
    question_id: str
    question_type: str
    question_type_label: str
    book_title: str
    chapter_title: str
    assigned_difficulty: int
    actual_accuracy: float
    attempt_count: int
    avg_time_sec: Optional[float] = None
    suggested_difficulty: int
    gap: int


class CalibrationResponse(BaseModel):
    word_calibrations: list[WordCalibrationItem]
    grammar_calibrations: list[GrammarCalibrationItem]


class BadQuestionItem(BaseModel):
    question_id: str
    question_type: str
    question_type_label: str
    book_title: str
    chapter_title: str
    difficulty: int
    accuracy: float
    attempt_count: int
    avg_time_sec: Optional[float] = None
    flag_reason: str


class BadWordItem(BaseModel):
    word_id: str
    english: str
    korean: str
    book_name: str
    curriculum_level: int
    accuracy: float
    attempt_count: int
    flag_reason: str


class BadQuestionResponse(BaseModel):
    grammar_issues: list[BadQuestionItem]
    word_issues: list[BadWordItem]


class ConfusedPair(BaseModel):
    correct_answer: str
    wrong_answer: str
    confusion_count: int


class QuestionTypeAccuracy(BaseModel):
    question_type: str
    label: str
    total: int
    correct: int
    accuracy_pct: float
    avg_time_sec: Optional[float] = None


class ErrorPatternResponse(BaseModel):
    confused_word_pairs: list[ConfusedPair]
    word_question_type_breakdown: list[QuestionTypeAccuracy]
    grammar_question_type_breakdown: list[QuestionTypeAccuracy]


class StageCount(BaseModel):
    stage: int
    count: int


class StageDuration(BaseModel):
    stage: int
    avg_days: float


class SrsOptimizationData(BaseModel):
    stage_distribution: list[StageCount]
    avg_days_per_stage: list[StageDuration]
    total_mastered: int
