"""Student management endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.student import CreateStudentRequest, UpdateStudentRequest
from app.schemas.user import UserResponse
from app.core.deps import CurrentTeacher
from app.services.student import (
    get_student_by_username,
    create_student,
    list_students_by_teacher,
    get_student_by_id,
    update_student,
    delete_student,
)

router = APIRouter(prefix="/students", tags=["students"])


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_student_endpoint(
    student_in: CreateStudentRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new student account (teacher only)."""
    existing = await get_student_by_username(db, student_in.username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already taken",
        )

    student = await create_student(
        db,
        username=student_in.username,
        password=student_in.password,
        name=student_in.name,
        teacher_id=teacher.id,
    )
    return student


@router.get("", response_model=list[UserResponse])
async def list_students_endpoint(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all students belonging to the current teacher."""
    students = await list_students_by_teacher(db, teacher.id)
    return students


@router.patch("/{student_id}", response_model=UserResponse)
async def update_student_endpoint(
    student_id: str,
    student_in: UpdateStudentRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a student's info (teacher only)."""
    student = await get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    updated = await update_student(
        db, student, name=student_in.name, password=student_in.password
    )
    return updated


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student_endpoint(
    student_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a student account (teacher only)."""
    student = await get_student_by_id(db, student_id)
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    await delete_student(db, student)
    return None
