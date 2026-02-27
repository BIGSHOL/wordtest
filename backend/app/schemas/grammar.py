"""Pydantic schemas for Grammar test API."""
from typing import Optional
from pydantic import BaseModel, ConfigDict


# ── Question data schemas (per type) ────────────────────────────────────

class GrammarBlankData(BaseModel):
    stem: str
    choices: list[str]
    correct_index: int
    sentence_ko: Optional[str] = None
    grammar_point: Optional[str] = None


class GrammarErrorData(BaseModel):
    prompt: str
    sentences: list[str]
    correct_indices: list[int]
    invert: bool = False  # True = "올바른 문장을 고르세요"
    select_count: int = 1


class GrammarCommonData(BaseModel):
    sentences: list[str]
    prompt: str
    choices: list[str]
    correct_index: int
    different_sentences: Optional[list[str]] = None


class GrammarUsageData(BaseModel):
    prompt: str
    sentences: list[str]
    correct_index: int
    underlined_word: Optional[str] = None


class GrammarTransformData(BaseModel):
    original: str
    instruction: str
    correct_answer: str
    acceptable_answers: list[str] = []


class GrammarOrderData(BaseModel):
    words: list[str]
    correct_answer: str
    sentence_ko: Optional[str] = None


class GrammarTranslateData(BaseModel):
    sentence_ko: str
    correct_answer: str
    acceptable_answers: list[str] = []
    hint_words: list[str] = []


class GrammarPairData(BaseModel):
    stem: str
    paired_choices: list[list[str]]
    correct_index: int


# ── Config / Assignment ─────────────────────────────────────────────────

class CreateGrammarConfigRequest(BaseModel):
    name: str
    book_ids: list[str]
    chapter_ids: Optional[list[str]] = None
    question_count: int = 20
    time_limit_seconds: int = 600
    per_question_seconds: Optional[int] = None
    time_mode: str = "per_question"
    question_types: Optional[list[str]] = None
    question_type_counts: Optional[dict[str, int]] = None


class GrammarConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    teacher_id: str
    name: str
    book_ids: Optional[str] = None
    chapter_ids: Optional[str] = None
    question_count: int
    time_limit_seconds: int
    per_question_seconds: Optional[int] = None
    time_mode: str
    question_types: Optional[str] = None
    question_type_counts: Optional[str] = None
    is_active: bool


class AssignGrammarRequest(BaseModel):
    student_ids: list[str]


class AssignGrammarResponse(BaseModel):
    assignments: list[dict]


# ── Book / Chapter ──────────────────────────────────────────────────────

class GrammarBookResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    title: str
    level: int


class GrammarChapterResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    book_id: str
    chapter_num: int
    title: str


# ── Session / Test ──────────────────────────────────────────────────────

class StartGrammarRequest(BaseModel):
    test_code: str
    allow_restart: bool = False


class GrammarQuestionOut(BaseModel):
    """A single grammar question sent to the student."""
    id: str
    question_type: str
    question_data: dict
    question_order: int


class StartGrammarResponse(BaseModel):
    session_id: str
    student_id: str
    student_name: str
    questions: list[GrammarQuestionOut]
    total_questions: int
    time_limit_seconds: int
    per_question_seconds: Optional[int] = None
    time_mode: str
    access_token: Optional[str] = None


class GrammarAnswerRequest(BaseModel):
    question_id: str
    selected_answer: str
    time_taken_seconds: Optional[float] = None


class GrammarAnswerResponse(BaseModel):
    is_correct: bool
    correct_answer: str
    question_id: str


class GrammarBatchSubmitRequest(BaseModel):
    answers: list[GrammarAnswerRequest]


class CompleteGrammarResponse(BaseModel):
    session_id: str
    total_questions: int
    correct_count: int
    score: int
    results: list[dict]


# ── Database browsing ──────────────────────────────────────────────────

class GrammarChapterWithStats(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    book_id: str
    chapter_num: int
    title: str
    question_count: int = 0


class GrammarQuestionBrowse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    book_id: str
    chapter_id: str
    question_type: str
    question_data: dict
    source: str
    difficulty: int
