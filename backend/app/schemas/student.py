"""Student management schemas."""
from typing import Optional
from pydantic import BaseModel


class CreateStudentRequest(BaseModel):
    username: str
    password: str
    name: str


class UpdateStudentRequest(BaseModel):
    name: Optional[str] = None
    password: Optional[str] = None
