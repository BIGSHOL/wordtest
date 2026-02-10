"""Word schemas."""
from typing import Optional
from pydantic import BaseModel


class WordResponse(BaseModel):
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

    class Config:
        from_attributes = True
