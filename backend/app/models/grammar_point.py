"""GrammarPoint model - grammar rule (POINT) within a unit/chapter."""
import uuid
from typing import Optional

from sqlalchemy import String, Integer, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class GrammarPoint(Base):
    __tablename__ = "grammar_points"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    chapter_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_chapters.id", ondelete="CASCADE"), nullable=False
    )
    unit_num: Mapped[int] = mapped_column(Integer, nullable=False)  # 1-4
    point_num: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("idx_grammar_point_chapter", "chapter_id"),
    )
