"""Listening Test schemas - simple listen-and-pick-word test mode."""
from typing import Optional
from pydantic import BaseModel


# --- Request schemas ---

class StartListeningTestRequest(BaseModel):
    test_code: str
    allow_restart: bool = False


class ListeningAnswerRequest(BaseModel):
    word_mastery_id: str
    selected_answer: str
    time_taken_seconds: Optional[float] = None


class ListeningCompleteRequest(BaseModel):
    session_id: str


# --- Response schemas ---

class ListeningQuestion(BaseModel):
    word_mastery_id: str
    word_id: str
    english: str
    choices: list[str]
    question_index: int
    timer_seconds: int


class StartListeningTestResponse(BaseModel):
    session_id: str
    assignment_id: str
    questions: list[ListeningQuestion]
    total_words: int
    per_question_time: int
    access_token: Optional[str] = None
    student_name: Optional[str] = None
    assignment_type: str = "listening"


class ListeningAnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str


class ListeningCompleteResponse(BaseModel):
    accuracy: float
    total_answered: int
    correct_count: int
