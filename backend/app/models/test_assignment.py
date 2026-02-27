"""TestAssignment model - tracks test assignments to students."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class TestAssignment(Base):
    __tablename__ = "test_assignments"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    test_config_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("test_configs.id", ondelete="CASCADE"), nullable=True
    )
    student_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    test_session_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("test_sessions.id", ondelete="SET NULL"), nullable=True
    )
    test_code: Mapped[str] = mapped_column(
        String(8), unique=True, nullable=False
    )
    assignment_type: Mapped[str] = mapped_column(
        String(20), nullable=False, default="mastery"
    )
    grammar_config_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("grammar_configs.id", ondelete="SET NULL"), nullable=True
    )
    engine_type: Mapped[Optional[str]] = mapped_column(
        String(20), nullable=True, default=None
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="pending"
    )
    assigned_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        TZDateTime(), nullable=True
    )

    # Relationships
    test_config: Mapped["TestConfig"] = relationship("TestConfig", lazy="noload")
    student: Mapped["User"] = relationship("User", foreign_keys=[student_id], lazy="noload")
    teacher: Mapped["User"] = relationship("User", foreign_keys=[teacher_id], lazy="noload")

    __table_args__ = (
        UniqueConstraint("test_config_id", "student_id", name="uq_assignment_config_student"),
        Index("idx_assignment_student_id", "student_id"),
        Index("idx_assignment_teacher_id", "teacher_id"),
        Index("idx_assignment_status", "status"),
        Index("idx_assignment_test_code", "test_code", unique=True),
    )
