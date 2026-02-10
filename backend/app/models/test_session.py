"""TestSession model - FEAT-1: 테스트 세션."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TestSession(Base):
    __tablename__ = "test_sessions"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    test_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # placement / periodic
    total_questions: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    determined_level: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    started_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # Relationships
    student: Mapped["User"] = relationship("User", lazy="selectin")
    answers: Mapped[list["TestAnswer"]] = relationship(
        "TestAnswer", back_populates="test_session", cascade="all, delete-orphan"
    )

    __table_args__ = (
        Index("idx_test_student_id", "student_id"),
        Index("idx_test_completed_at", completed_at.desc()),
        Index("idx_test_type", "test_type"),
    )
