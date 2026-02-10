"""TestAnswer model - FEAT-1: 테스트 답변."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TestAnswer(Base):
    __tablename__ = "test_answers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    test_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False
    )
    word_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="RESTRICT"), nullable=False
    )
    selected_answer: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    correct_answer: Mapped[str] = mapped_column(String(200), nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    question_order: Mapped[int] = mapped_column(Integer, nullable=False)
    answered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    test_session: Mapped["TestSession"] = relationship(
        "TestSession", back_populates="answers"
    )
    word: Mapped["Word"] = relationship("Word", lazy="selectin")

    __table_args__ = (
        Index("idx_answer_session_id", "test_session_id"),
        Index("idx_answer_word_id", "word_id"),
        Index("idx_answer_is_correct", "is_correct"),
    )
