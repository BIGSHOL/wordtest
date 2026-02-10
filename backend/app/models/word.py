"""Word model - FEAT-1: 단어 데이터."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, DateTime, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Word(Base):
    __tablename__ = "words"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    english: Mapped[str] = mapped_column(String(100), nullable=False)
    korean: Mapped[str] = mapped_column(String(200), nullable=False)
    level: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    book_name: Mapped[str] = mapped_column(String(100), nullable=False, default="")
    lesson: Mapped[str] = mapped_column(String(50), nullable=False, default="")
    part_of_speech: Mapped[Optional[str]] = mapped_column(String(30), nullable=True)
    example_en: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    example_ko: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        Index("idx_word_level", "level"),
        Index("idx_word_english", "english"),
        Index("idx_word_book_lesson", "book_name", "lesson"),
    )
