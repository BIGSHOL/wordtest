"""Level test schemas."""
from typing import Optional
from pydantic import BaseModel, ConfigDict


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
    korean: Optional[str] = None
    example_en: Optional[str] = None
    emoji: Optional[str] = None
    level: int = 1  # word DB level (1-15)
    lesson: str = ""  # lesson name within book


class TestQuestion(BaseModel):
    question_order: int
    word: TestQuestionWord
    choices: list[str]
    correct_answer: str
    question_type: str = "word_meaning"
    emoji: Optional[str] = None


class TestSessionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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


class StartTestResponse(BaseModel):
    test_session: TestSessionResponse
    questions: list[TestQuestion]


class AnswerDetail(BaseModel):
    question_order: int
    word_english: str
    correct_answer: str
    selected_answer: Optional[str] = None
    is_correct: bool
    word_level: int = 1
    time_taken_seconds: Optional[float] = None
    question_type: Optional[str] = None


class TestResultResponse(BaseModel):
    test_session: TestSessionResponse
    answers: list[AnswerDetail]


class ListTestsResponse(BaseModel):
    tests: list[TestSessionResponse]


class StartByCodeRequest(BaseModel):
    test_code: str


class StartByCodeResponse(BaseModel):
    access_token: str
    test_session: TestSessionResponse
    questions: list[TestQuestion]
    student_name: str
