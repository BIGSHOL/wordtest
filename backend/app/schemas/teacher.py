"""Teacher management schemas."""
from typing import Optional
from pydantic import BaseModel, field_validator


class CreateTeacherRequest(BaseModel):
    name: str
    username: str
    password: str
    phone_number: Optional[str] = None
    school_name: Optional[str] = None

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


class UpdateTeacherRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    school_name: Optional[str] = None
