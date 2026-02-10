"""Word model - FEAT-1: 단어 데이터."""
import uuid
from datetime import datetime
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
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )

    __table_args__ = (
        Index("idx_word_level", "level"),
        Index("idx_word_english", "english"),
    )
