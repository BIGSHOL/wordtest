"""Word model - FEAT-1: 단어 데이터."""
import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import String, Integer, Boolean, Text, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime

if TYPE_CHECKING:
    from app.models.word_example import WordExample


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
    is_excluded: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    compatible_engines: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    area1_meaning: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area2_association: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area3_pronunciation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area4_inference: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area5_spelling: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    area6_context: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )

    examples: Mapped[list["WordExample"]] = relationship(
        "WordExample",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="WordExample.order_index",
    )

    __table_args__ = (
        Index("idx_word_level", "level"),
        Index("idx_word_english", "english"),
        Index("idx_word_book_lesson", "book_name", "lesson"),
    )
