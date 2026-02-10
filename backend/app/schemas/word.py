"""Word schemas."""
from typing import Optional
from pydantic import BaseModel


class WordResponse(BaseModel):
    id: str
    english: str
    korean: str
    level: int
    category: Optional[str] = None

    class Config:
        from_attributes = True
