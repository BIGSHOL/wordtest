"""Legacy test engine schemas."""
from typing import Optional
from pydantic import BaseModel


class StartLegacyRequest(BaseModel):
    test_code: str
    allow_restart: bool = False


class LegacyAnswerRequest(BaseModel):
    word_mastery_id: str
    selected_answer: str
    time_taken_seconds: Optional[float] = None
    question_type: Optional[str] = None


class CompleteLegacyRequest(BaseModel):
    session_id: str


class BatchAnswerItem(BaseModel):
    word_mastery_id: str
    selected_answer: str
    question_type: Optional[str] = None


class LegacyBatchSubmitRequest(BaseModel):
    answers: list[BatchAnswerItem]
