"""Level test schemas."""
from typing import Optional
from pydantic import BaseModel


class StartTestRequest(BaseModel):
    test_type: str = "placement"  # placement / periodic
    test_code: Optional[str] = None


class SubmitAnswerRequest(BaseModel):
    word_id: str
    selected_answer: str
    question_order: int


class SubmitAnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str


class TestQuestionWord(BaseModel):
    id: str
    english: str


class TestQuestion(BaseModel):
    question_order: int
    word: TestQuestionWord
    choices: list[str]


class TestSessionResponse(BaseModel):
    id: str
    student_id: str
    test_type: str
    total_questions: int
    correct_count: int
    determined_level: Optional[int] = None
    determined_sublevel: Optional[int] = None
    rank_name: Optional[str] = None
    rank_label: Optional[str] = None  # e.g. "Iron 1-5" or "Iron 1-MAX"
    score: Optional[int] = None
    test_config_id: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None

    class Config:
        from_attributes = True


class StartTestResponse(BaseModel):
    test_session: TestSessionResponse
    questions: list[TestQuestion]


class AnswerDetail(BaseModel):
    question_order: int
    word_english: str
    correct_answer: str
    selected_answer: Optional[str] = None
    is_correct: bool


class TestResultResponse(BaseModel):
    test_session: TestSessionResponse
    answers: list[AnswerDetail]


class ListTestsResponse(BaseModel):
    tests: list[TestSessionResponse]
