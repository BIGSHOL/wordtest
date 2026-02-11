"""Test assignment schemas."""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel


class AssignTestRequest(BaseModel):
    student_ids: list[str]
    question_count: int
    per_question_time_seconds: int
    question_types: list[str]
    book_name: str
    lesson_range_start: str
    lesson_range_end: str


class TestAssignmentResponse(BaseModel):
    id: str
    student_name: str
    student_school: Optional[str] = None
    student_grade: Optional[str] = None
    test_code: str
    question_count: int
    per_question_time_seconds: Optional[int] = None
    question_types: Optional[str] = None
    lesson_range: Optional[str] = None
    status: str
    assigned_at: datetime
    test_session_id: Optional[str] = None

    class Config:
        from_attributes = True
