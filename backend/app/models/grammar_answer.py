"""GrammarAnswer model - per-question answer for grammar sessions."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, Boolean, Text, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class GrammarAnswer(Base):
    __tablename__ = "grammar_answers"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    grammar_session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_sessions.id", ondelete="CASCADE"), nullable=False
    )
    grammar_question_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("grammar_questions.id", ondelete="RESTRICT"), nullable=False
    )
    question_order: Mapped[int] = mapped_column(Integer, nullable=False)
    question_type: Mapped[str] = mapped_column(String(30), nullable=False)
    selected_answer: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    correct_answer: Mapped[str] = mapped_column(Text, nullable=False)
    is_correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    time_taken_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    answered_at: Mapped[Optional[datetime]] = mapped_column(
        TZDateTime(), nullable=True
    )

    __table_args__ = (
        Index("idx_grammar_answer_session", "grammar_session_id"),
        Index("idx_grammar_answer_question", "grammar_question_id"),
    )
