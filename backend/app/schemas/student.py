"""Student management schemas."""
from typing import Optional
from pydantic import BaseModel


class CreateStudentRequest(BaseModel):
    username: str
    password: str
    name: str
    phone_number: Optional[str] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None


class UpdateStudentRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
    phone_number: Optional[str] = None
    school_name: Optional[str] = None
    grade: Optional[str] = None


class BatchDeleteRequest(BaseModel):
    student_ids: list[str]
