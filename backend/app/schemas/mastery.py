"""Mastery learning system schemas."""
from typing import Optional
from pydantic import BaseModel


# --- Stage configuration ---

STAGE_TIMERS = {1: 5, 2: 5, 3: 15, 4: 10, 5: 15}

STAGE_QUESTION_TYPES = {
    1: "word_to_meaning",     # English word → pick Korean meaning
    2: "meaning_to_word",     # Korean meaning → pick English word
    3: "listen_and_type",     # Listen pronunciation → type English word
    4: "listen_to_meaning",   # Listen pronunciation → pick Korean meaning
    5: "meaning_and_type",    # Korean meaning → type English word
}


# --- Request schemas ---

class StartMasteryByCodeRequest(BaseModel):
    test_code: str


class MasteryBatchRequest(BaseModel):
    session_id: str
    level: Optional[int] = None  # explicit level for lazy loading
    batch_size: int = 10


class SubmitMasteryAnswerRequest(BaseModel):
    word_mastery_id: str
    selected_answer: str
    time_taken_seconds: Optional[float] = None
    stage: int


# --- Response schemas ---

class MasteryQuestionWord(BaseModel):
    id: str
    english: str
    korean: Optional[str] = None
    example_en: Optional[str] = None
    example_ko: Optional[str] = None
    level: int
    lesson: str
    part_of_speech: Optional[str] = None


class MasteryQuestion(BaseModel):
    word_mastery_id: str
    word: MasteryQuestionWord
    stage: int
    question_type: str
    choices: Optional[list[str]] = None  # None for typing stages (3, 5)
    correct_answer: str
    timer_seconds: int
    context_mode: str = "word"              # "word" | "sentence"
    sentence_blank: Optional[str] = None    # English sentence with ____ for fill-in-blank


class StageSummary(BaseModel):
    stage_1: int = 0
    stage_2: int = 0
    stage_3: int = 0
    stage_4: int = 0
    stage_5: int = 0
    mastered: int = 0


class MasterySessionInfo(BaseModel):
    id: str
    assignment_id: str
    current_stage: int
    words_practiced: int
    words_advanced: int
    best_combo: int
    started_at: str


class StartMasteryResponse(BaseModel):
    session: MasterySessionInfo
    stage_summary: StageSummary
    questions: list[MasteryQuestion]
    total_words: int
    access_token: Optional[str] = None
    student_name: Optional[str] = None
    assignment_type: str = "mastery"
    current_level: int = 1


class MasteryBatchResponse(BaseModel):
    questions: list[MasteryQuestion]
    remaining_in_stage: int
    stage_summary: StageSummary
    current_level: int = 1
    previous_level: int = 1
    level_changed: bool = False


class MasteryAnswerResult(BaseModel):
    is_correct: bool
    almost_correct: bool = False  # edit distance == 1
    correct_answer: str
    new_stage: int
    previous_stage: int
    word_mastered: bool
    stage_streak: int = 0         # current consecutive correct at this stage
    required_streak: int = 2      # needed to advance
    example_en: Optional[str] = None
    example_ko: Optional[str] = None
    current_level: int = 1


class WordMasteryDetail(BaseModel):
    word_id: str
    english: str
    korean: str
    stage: int
    total_attempts: int
    total_correct: int
    mastered: bool
    last_practiced_at: Optional[str] = None


class MasteryProgressResponse(BaseModel):
    assignment_id: str
    student_name: str
    total_words: int
    stage_summary: StageSummary
    mastery_rate: float
    last_practiced_at: Optional[str] = None
    word_details: list[WordMasteryDetail]
