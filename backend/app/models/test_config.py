"""TestConfig model - test configuration management."""
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, Integer, Boolean, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


class TestConfig(Base):
    __tablename__ = "test_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    test_code: Mapped[Optional[str]] = mapped_column(String(8), nullable=True)
    test_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # placement / periodic
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    time_limit_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=300
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    book_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    book_name_end: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    level_range_min: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    level_range_max: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    per_question_time_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    total_time_override_seconds: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    question_types: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    question_type_counts: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    lesson_range_start: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    lesson_range_end: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, onupdate=now_kst, nullable=False
    )

    __table_args__ = (
        Index("idx_test_config_teacher_id", "teacher_id"),
        Index("idx_test_config_active", "is_active"),
    )
