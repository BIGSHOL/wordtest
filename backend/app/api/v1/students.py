"""Student management endpoints."""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.student import CreateStudentRequest, UpdateStudentRequest
from app.schemas.user import UserResponse
from app.core.deps import CurrentTeacher
from app.models.user import User
from app.models.test_session import TestSession
from app.services.test_common import format_rank_label
from app.services.student import (
    get_student_by_username,
    create_student,
    list_students_by_teacher,
    get_student_by_id,
    update_student,
    delete_student,
)

router = APIRouter(prefix="/students", tags=["students"])


class StudentWithLevelResponse(UserResponse):
    latest_level: Optional[int] = None
    latest_rank: Optional[str] = None
    latest_sublevel: Optional[int] = None
    latest_rank_label: Optional[str] = None


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

    # Check for duplicate name among same teacher's students
    name_check = await db.execute(
        select(User).where(User.teacher_id == teacher.id, User.name == student_in.name)
    )
    if name_check.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="같은 이름의 학생이 이미 존재합니다",
        )

    student = await create_student(
        db,
        username=student_in.username,
        password=student_in.password,
        name=student_in.name,
        teacher_id=teacher.id,
        phone_number=student_in.phone_number,
        school_name=student_in.school_name,
        grade=student_in.grade,
    )
    return student


@router.get("", response_model=list[StudentWithLevelResponse])
async def list_students_endpoint(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all students belonging to the current teacher, with latest level info."""
    students = await list_students_by_teacher(db, teacher.id)

    # Fetch latest completed test session per student in one query
    student_ids = [s.id for s in students]
    if not student_ids:
        return []

    # Subquery: latest completed_at per student
    from sqlalchemy import func
    latest_sub = (
        select(
            TestSession.student_id,
            func.max(TestSession.completed_at).label("max_completed"),
        )
        .where(
            TestSession.student_id.in_(student_ids),
            TestSession.completed_at.isnot(None),
        )
        .group_by(TestSession.student_id)
        .subquery()
    )

    result = await db.execute(
        select(
            TestSession.student_id,
            TestSession.determined_level,
            TestSession.rank_name,
            TestSession.determined_sublevel,
        )
        .join(
            latest_sub,
            and_(
                TestSession.student_id == latest_sub.c.student_id,
                TestSession.completed_at == latest_sub.c.max_completed,
            ),
        )
    )
    level_map = {}
    for row in result.all():
        level_map[row[0]] = {"level": row[1], "rank": row[2], "sublevel": row[3]}

    responses = []
    for s in students:
        info = level_map.get(s.id, {})
        responses.append(
            StudentWithLevelResponse(
                id=s.id,
                email=s.email,
                username=s.username,
                name=s.name,
                role=s.role,
                teacher_id=s.teacher_id,
                school_name=s.school_name,
                grade=s.grade,
                phone_number=s.phone_number,
                created_at=s.created_at,
                updated_at=s.updated_at,
                latest_level=info.get("level"),
                latest_rank=info.get("rank"),
                latest_sublevel=info.get("sublevel"),
                latest_rank_label=(
                    format_rank_label(info["level"], info["sublevel"])
                    if info.get("level") and info.get("sublevel") else None
                ),
            )
        )
    return responses


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
    if student.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your student",
        )

    updated = await update_student(
        db,
        student,
        name=student_in.name,
        password=student_in.password,
        phone_number=student_in.phone_number,
        school_name=student_in.school_name,
        grade=student_in.grade,
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
    if student.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your student",
        )

    await delete_student(db, student)
    return None
