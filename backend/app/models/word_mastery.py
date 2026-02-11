"""WordMastery model - tracks per-student, per-word mastery stage."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Float, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class WordMastery(Base):
    __tablename__ = "word_mastery"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    word_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("words.id", ondelete="CASCADE"), nullable=False
    )
    assignment_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("test_assignments.id", ondelete="SET NULL"), nullable=True
    )
    stage: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    stage_streak: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_correct: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    combo_best: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_practiced_at: Mapped[Optional[datetime]] = mapped_column(TZDateTime(), nullable=True)
    mastered_at: Mapped[Optional[datetime]] = mapped_column(TZDateTime(), nullable=True)
    review_due_at: Mapped[Optional[datetime]] = mapped_column(TZDateTime(), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, onupdate=now_kst, nullable=False
    )

    __table_args__ = (
        UniqueConstraint("student_id", "word_id", name="uq_mastery_student_word"),
        Index("idx_mastery_student_id", "student_id"),
        Index("idx_mastery_student_stage", "student_id", "stage"),
        Index("idx_mastery_assignment", "assignment_id"),
        Index("idx_mastery_review_due", "student_id", "review_due_at"),
    )
