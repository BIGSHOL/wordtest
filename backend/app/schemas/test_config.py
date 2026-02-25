"""Test configuration schemas."""
from typing import Optional
from pydantic import BaseModel, ConfigDict


class TestConfigResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    teacher_id: str
    name: str
    test_code: Optional[str] = None
    test_type: str
    question_count: int
    time_limit_seconds: int
    is_active: bool
    book_name: Optional[str] = None
    book_name_end: Optional[str] = None
    level_range_min: int
    level_range_max: int
    per_question_time_seconds: Optional[int] = None
    total_time_override_seconds: Optional[int] = None
    question_types: Optional[str] = None
    question_type_counts: Optional[str] = None
    lesson_range_start: Optional[str] = None
    lesson_range_end: Optional[str] = None
    assignment_count: int = 0
    created_at: str
    updated_at: str


class CreateTestConfigRequest(BaseModel):
    name: Optional[str] = None  # user-defined name; auto-generated if omitted
    engine: str = "levelup"  # "levelup" or "legacy"
    question_count: int = 20
    per_question_time_seconds: int = 15
    question_types: list[str] = ["en_to_ko", "ko_to_en"]
    book_name: Optional[str] = None
    book_name_end: Optional[str] = None
    lesson_range_start: Optional[str] = None
    lesson_range_end: Optional[str] = None
    total_time_override_seconds: Optional[int] = None
    question_type_counts: Optional[dict[str, int]] = None
    is_active: bool = True


class UpdateTestConfigRequest(BaseModel):
    name: Optional[str] = None
    test_type: Optional[str] = None
    question_count: Optional[int] = None
    time_limit_seconds: Optional[int] = None
    is_active: Optional[bool] = None
    book_name: Optional[str] = None
    level_range_min: Optional[int] = None
    level_range_max: Optional[int] = None
    per_question_time_seconds: Optional[int] = None
    total_time_override_seconds: Optional[int] = None
    question_types: Optional[str] = None
    lesson_range_start: Optional[str] = None
    lesson_range_end: Optional[str] = None


class AssignToConfigRequest(BaseModel):
    student_ids: list[str]
