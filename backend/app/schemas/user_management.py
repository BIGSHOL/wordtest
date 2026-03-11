"""User management schemas (master only)."""
from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.user import UserResponse


class UserWithActivityResponse(UserResponse):
    teacher_name: Optional[str] = None
    last_active: Optional[datetime] = None
    total_sessions: int = 0
    accuracy_pct: Optional[float] = None


class UserListResponse(BaseModel):
    users: list[UserWithActivityResponse]
    total: int
    page: int
    page_size: int


class CreateUserRequest(BaseModel):
    name: str
    username: str
    password: str
    role: Literal["student", "teacher", "master"]
    email: Optional[str] = None
    phone_number: Optional[str] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None
    teacher_id: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("이름을 입력해주세요")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_min_length(cls, v: str) -> str:
        if len(v) < 4:
            raise ValueError("비밀번호는 4자 이상이어야 합니다")
        return v


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None
    role: Optional[str] = None
    teacher_id: Optional[str] = None


class ResetPasswordResponse(BaseModel):
    temporary_password: str


class UserDetailSessionItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    session_id: str
    session_type: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    total_questions: int
    correct_count: int
    accuracy_pct: Optional[float] = None
    duration_seconds: Optional[int] = None


class UserDetailResponse(BaseModel):
    user: UserWithActivityResponse
    sessions: list[UserDetailSessionItem]
