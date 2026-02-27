"""GrammarSentence model - numbered example sentence (001-1001)."""
import uuid
from typing import Optional

from sqlalchemy import String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GrammarSentence(Base):
    __tablename__ = "grammar_sentences"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    book_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_books.id", ondelete="CASCADE"), nullable=False
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_chapters.id", ondelete="CASCADE"), nullable=False
    )
    point_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("grammar_points.id", ondelete="SET NULL"), nullable=True
    )
    sentence_num: Mapped[int] = mapped_column(Integer, nullable=False)
    sentence_en: Mapped[str] = mapped_column(Text, nullable=False)
    sentence_ko: Mapped[str] = mapped_column(Text, nullable=False)
    grammar_note: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    __table_args__ = (
        Index("idx_grammar_sentence_book", "book_id"),
        Index("idx_grammar_sentence_chapter", "chapter_id"),
    )
