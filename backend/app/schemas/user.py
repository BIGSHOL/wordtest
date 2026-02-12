"""User schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: Optional[str] = None
    username: Optional[str] = None
    name: str
    role: str
    teacher_id: Optional[str] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None
    phone_number: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class UserUpdate(BaseModel):
    name: Optional[str] = None
