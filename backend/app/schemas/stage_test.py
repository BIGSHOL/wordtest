"""Stage Test system schemas - separate from mastery/level-up system."""
from typing import Optional
from pydantic import BaseModel

from app.schemas.mastery import MasteryQuestion


# --- Request schemas ---

class StartStageTestRequest(BaseModel):
    test_code: str
    allow_restart: bool = False


class StageTestQuestionsRequest(BaseModel):
    word_mastery_ids: list[str]
    error_counts: Optional[dict[str, int]] = None


class StageTestAnswerRequest(BaseModel):
    word_mastery_id: str
    selected_answer: str
    time_taken_seconds: Optional[float] = None
    stage: int
    question_type: Optional[str] = None
    context_mode: Optional[str] = None


class StageTestCompleteRequest(BaseModel):
    session_id: str
    mastered_count: int = 0
    skipped_count: int = 0
    total_answered: int = 0
    best_combo: int = 0


# --- Response schemas ---

class StageWordInfo(BaseModel):
    word_mastery_id: str
    word_id: str
    english: str
    korean: Optional[str] = None
    stage: int
    level: int
    lesson: str
    difficulty_score: float = 0.0


class StartStageTestResponse(BaseModel):
    session_id: str
    assignment_id: str
    words: list[StageWordInfo]
    initial_questions: list[MasteryQuestion]
    total_words: int
    max_fails: int = 3
    access_token: Optional[str] = None
    student_name: Optional[str] = None
    assignment_type: str = "stage_test"
    engine_type: Optional[str] = None


class StageTestAnswerResponse(BaseModel):
    is_correct: bool
    almost_correct: bool = False
    correct_answer: str
    new_stage: int
    word_mastered: bool = False