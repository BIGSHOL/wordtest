"""GrammarChapter model - chapter within a grammar book."""
import uuid

from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GrammarChapter(Base):
    __tablename__ = "grammar_chapters"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    book_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_books.id", ondelete="CASCADE"), nullable=False
    )
    chapter_num: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-12
    title: Mapped[str] = mapped_column(String(200), nullable=False)

    __table_args__ = (
        Index("idx_grammar_chapter_book", "book_id"),
    )
