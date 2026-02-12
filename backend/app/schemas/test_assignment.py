"""Test assignment schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class AssignTestRequest(BaseModel):
    student_ids: list[str]
    test_type: str = "periodic"  # periodic / placement
    question_count: int = 20
    per_question_time_seconds: int = 15
    question_types: list[str] = ["word_meaning"]
    book_name: Optional[str] = None
    book_name_end: Optional[str] = None
    lesson_range_start: Optional[str] = None
    lesson_range_end: Optional[str] = None


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
    test_session_id: Optional[str] = None
    learning_session_id: Optional[str] = None
