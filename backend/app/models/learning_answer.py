"""LearningAnswer model - records each answer in a mastery learning session."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class LearningAnswer(Base):
    __tablename__ = "learning_answers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("learning_sessions.id", ondelete="CASCADE"), nullable=False
    )
    word_mastery_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("word_mastery.id", ondelete="CASCADE"), nullable=False
    )
    word_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="RESTRICT"), nullable=False
    )
    stage: Mapped[int] = mapped_column(Integer, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    selected_answer: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(500), nullable=False)
    time_taken_sec: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    answered_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    question_type: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)

    __table_args__ = (
        Index("idx_lanswer_session", "session_id"),
        Index("idx_lanswer_mastery", "word_mastery_id"),
    )
