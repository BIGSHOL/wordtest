"""Level Test request/response schemas."""

from pydantic import BaseModel, field_validator


class LevelTestCreateRequest(BaseModel):
    student_ids: list[str]

    @field_validator("student_ids")
    @classmethod
    def validate_ids(cls, v: list[str]) -> list[str]:
        if not v:
            raise ValueError("At least one student must be selected")
        if len(v) > 50:
            raise ValueError("Maximum 50 students per batch")
        return v


class LevelTestStudentResult(BaseModel):
    student_name: str
    student_id: str
    test_code: str
    assignment_id: str
    grade: str
    level_range: str


class LevelTestCreateResponse(BaseModel):
    question_count: int
    students: list[LevelTestStudentResult]
