"""Test assignment schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AssignTestRequest(BaseModel):
    student_ids: list[str]
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


class TestAssignmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    student_id: str
    student_name: str
    student_school: Optional[str] = None
    student_grade: Optional[str] = None
    test_code: str
    test_type: str = "periodic"
    question_count: int
    per_question_time_seconds: Optional[int] = None
    question_types: Optional[str] = None
    lesson_range: Optional[str] = None
    assignment_type: str = "mastery"
    engine_type: Optional[str] = None
    status: str
    assigned_at: datetime
    total_time_override_seconds: Optional[int] = None
    question_type_counts: Optional[str] = None
    test_session_id: Optional[str] = None
    learning_session_id: Optional[str] = None
