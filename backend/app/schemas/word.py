"""Word schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class WordExampleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    example_en: str
    example_ko: str
    order_index: int


class WordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    english: str
    korean: str
    level: int
    category: Optional[str] = None
    book_name: str = ""
    lesson: str = ""
    part_of_speech: Optional[str] = None
    example_en: Optional[str] = None
    example_ko: Optional[str] = None
    examples: list[WordExampleResponse] = []
    compatible_engines: Optional[str] = None
    created_at: Optional[datetime] = None


class CreateWordRequest(BaseModel):
    english: str
    korean: str
    level: int
    category: Optional[str] = None
    book_name: Optional[str] = ""
    lesson: Optional[str] = ""
    part_of_speech: Optional[str] = None
    example_en: Optional[str] = None
    example_ko: Optional[str] = None


class UpdateWordRequest(BaseModel):
    english: Optional[str] = None
    korean: Optional[str] = None
    level: Optional[int] = None
    category: Optional[str] = None
    book_name: Optional[str] = None
    lesson: Optional[str] = None
    part_of_speech: Optional[str] = None
    example_en: Optional[str] = None
    example_ko: Optional[str] = None


class WordListResponse(BaseModel):
    words: list[WordResponse]
    total: int


# ── Engine Audit Schemas ─────────────────────────────────────────────────────


class EngineCoverage(BaseModel):
    count: int
    pct: float


class ProblemWord(BaseModel):
    id: str
    english: str
    korean: str
    compatible_engines: list[str]
    issue: str


class EngineAuditResponse(BaseModel):
    total_words: int
    engine_coverage: dict[str, EngineCoverage]
    problem_words: list[ProblemWord]
    unmapped_count: int


class EngineAuditRefreshResponse(BaseModel):
    updated_count: int
    total_words: int
    engine_coverage: dict[str, EngineCoverage]
