"""GrammarQuestion model - pre-authored grammar test question with JSONB data."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import JSONB

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class GrammarQuestion(Base):
    __tablename__ = "grammar_questions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    book_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_books.id", ondelete="CASCADE"), nullable=False
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_chapters.id", ondelete="CASCADE"), nullable=False
    )
    question_type: Mapped[str] = mapped_column(String(30), nullable=False)
    question_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="pdf")
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    point_refs: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )

    __table_args__ = (
        Index("idx_grammar_question_book", "book_id"),
        Index("idx_grammar_question_chapter", "chapter_id"),
        Index("idx_grammar_question_type", "question_type"),
    )
