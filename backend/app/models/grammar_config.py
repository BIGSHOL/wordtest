"""GrammarConfig model - teacher-created grammar test configuration."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class GrammarConfig(Base):
    __tablename__ = "grammar_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    book_ids: Mapped[Optional[str]] = mapped_column(
        String(200), nullable=True
    )  # comma-separated grammar_book IDs
    chapter_ids: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True
    )  # comma-separated grammar_chapter IDs (null = all)
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    time_limit_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=600
    )
    per_question_seconds: Mapped[Optional[int]] = mapped_column(
        Integer, nullable=True
    )
    time_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, default="per_question"
    )
    question_types: Mapped[Optional[str]] = mapped_column(
        String(300), nullable=True
    )  # comma-separated, e.g. "grammar_blank,grammar_error"
    question_type_counts: Mapped[Optional[str]] = mapped_column(
        Text, nullable=True
    )  # JSON string, e.g. '{"grammar_blank":10,"grammar_error":10}'
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, onupdate=now_kst, nullable=False
    )

    __table_args__ = (
        Index("idx_grammar_config_teacher", "teacher_id"),
    )
