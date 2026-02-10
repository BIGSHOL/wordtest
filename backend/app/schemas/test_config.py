"""Test configuration schemas."""
from typing import Optional
from pydantic import BaseModel


class TestConfigResponse(BaseModel):
    id: str
    teacher_id: str
    name: str
    test_code: str
    test_type: str
    question_count: int
    time_limit_seconds: int
    is_active: bool
    book_name: Optional[str] = None
    level_range_min: int
    level_range_max: int
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class CreateTestConfigRequest(BaseModel):
    name: str
    test_type: str
    question_count: int = 20
    time_limit_seconds: int = 300
    is_active: bool = True
    book_name: Optional[str] = None
    level_range_min: int = 1
    level_range_max: int = 15


class UpdateTestConfigRequest(BaseModel):
    name: Optional[str] = None
    test_type: Optional[str] = None
    question_count: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    is_active: Optional[bool] = None
    book_name: Optional[str] = None
    level_range_min: Optional[int] = None
    level_range_max: Optional[int] = None
