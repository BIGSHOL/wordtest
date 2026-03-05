"""User model - FEAT-0: 사용자 관리."""
import secrets
import string
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy import String, ForeignKey, Index
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.core.timezone import now_kst, TZDateTime


def _generate_invite_code() -> str:
    """Generate a 8-char uppercase alphanumeric invite code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True
    )
    username: Mapped[Optional[str]] = mapped_column(
        String(50), unique=True, nullable=True
    )
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)  # teacher / student
    teacher_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    school_name: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    grade: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    phone_number: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    invite_code: Mapped[Optional[str]] = mapped_column(
        String(8), unique=True, nullable=True, default=_generate_invite_code
    )
    invited_by: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        TZDateTime(), default=now_kst, onupdate=now_kst, nullable=False
    )

    # Relationships
    teacher: Mapped[Optional["User"]] = relationship(
        "User", remote_side=[id], back_populates="students",
        foreign_keys=[teacher_id],
    )
    students: Mapped[list["User"]] = relationship(
        "User", back_populates="teacher",
        foreign_keys=[teacher_id],
    )
    inviter: Mapped[Optional["User"]] = relationship(
        "User", remote_side=[id], foreign_keys=[invited_by],
    )

    __table_args__ = (
        Index("idx_user_teacher_id", "teacher_id"),
        Index("idx_user_role", "role"),
        Index("idx_user_invite_code", "invite_code"),
    )
