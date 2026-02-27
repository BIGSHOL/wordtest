"""GrammarSession model - student grammar test session."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class GrammarSession(Base):
    __tablename__ = "grammar_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assignment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_assignments.id", ondelete="CASCADE"), nullable=False
    )
    grammar_config_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("grammar_configs.id", ondelete="SET NULL"), nullable=True
    )
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        TZDateTime(), nullable=True
    )

    __table_args__ = (
        Index("idx_grammar_session_student", "student_id"),
        Index("idx_grammar_session_assignment", "assignment_id"),
    )
