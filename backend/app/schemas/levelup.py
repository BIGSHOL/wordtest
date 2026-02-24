"""Level-Up test engine schemas."""
from typing import Optional
from pydantic import BaseModel


class StartLevelupRequest(BaseModel):
    test_code: str
    allow_restart: bool = False


class LevelupBatchRequest(BaseModel):
    session_id: str
    level: int
    batch_size: int = 10


class LevelupAnswerRequest(BaseModel):
    word_mastery_id: str
    selected_answer: str
    time_taken_seconds: Optional[float] = None
    question_type: Optional[str] = None


class CompleteLevelupRequest(BaseModel):
    session_id: str
    final_level: int
    best_combo: int = 0


class BatchAnswerItem(BaseModel):
    word_mastery_id: str
    selected_answer: str  # empty string for unanswered
    question_type: Optional[str] = None


class LevelupBatchSubmitRequest(BaseModel):
    answers: list[BatchAnswerItem]
    available_levels: list[int]
    starting_level: int
