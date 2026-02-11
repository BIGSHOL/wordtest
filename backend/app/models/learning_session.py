"""LearningSession model - tracks mastery learning sessions."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class LearningSession(Base):
    __tablename__ = "learning_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    assignment_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("test_assignments.id", ondelete="CASCADE"), nullable=False
    )
    current_stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    current_level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    words_practiced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    words_advanced: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    words_demoted: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    best_combo: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    started_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(TZDateTime(), nullable=True)

    __table_args__ = (
        Index("idx_lsession_student", "student_id"),
        Index("idx_lsession_assignment", "assignment_id"),
    )
