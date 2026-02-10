"""TestConfig model - test configuration management."""
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import String, Integer, Boolean, DateTime, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestConfig(Base):
    __tablename__ = "test_configs"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    teacher_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    test_code: Mapped[str] = mapped_column(String(6), unique=True, nullable=False)
    test_type: Mapped[str] = mapped_column(
        String(20), nullable=False
    )  # placement / periodic
    question_count: Mapped[int] = mapped_column(Integer, nullable=False, default=20)
    time_limit_seconds: Mapped[int] = mapped_column(
        Integer, nullable=False, default=300
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    book_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    level_range_min: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    level_range_max: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False
    )

    __table_args__ = (
        Index("idx_test_config_teacher_id", "teacher_id"),
        Index("idx_test_config_active", "is_active"),
        Index("idx_test_config_test_code", "test_code", unique=True),
    )
