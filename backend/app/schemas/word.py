"""Word schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


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
