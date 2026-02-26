"""Teacher management endpoints (master only)."""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.teacher import CreateTeacherRequest, UpdateTeacherRequest
from app.schemas.user import UserResponse
from app.core.deps import CurrentMaster
from app.models.user import User
from app.services.teacher import (
    create_teacher,
    list_all_teachers,
    get_teacher_by_id,
    update_teacher,
    delete_teacher,
    get_student_count_by_teacher,
)

router = APIRouter(prefix="/teachers", tags=["teachers"])


class TeacherWithStatsResponse(UserResponse):
    student_count: int = 0


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_teacher_endpoint(
    teacher_in: CreateTeacherRequest,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new teacher account (master only)."""
    # Check username uniqueness across ALL users
    existing = await db.execute(
        select(User).where(User.username == teacher_in.username)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="이미 사용 중인 아이디입니다",
        )

    teacher = await create_teacher(
        db,
        username=teacher_in.username,
        password=teacher_in.password,
        name=teacher_in.name,
        phone_number=teacher_in.phone_number,
        school_name=teacher_in.school_name,
    )
    return teacher


@router.get("", response_model=list[TeacherWithStatsResponse])
async def list_teachers_endpoint(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all teachers with student count (master only)."""
    teachers = await list_all_teachers(db)
    responses = []
    for t in teachers:
        count = await get_student_count_by_teacher(db, t.id)
        responses.append(
            TeacherWithStatsResponse(
                id=t.id,
                email=t.email,
                username=t.username,
                name=t.name,
                role=t.role,
                teacher_id=t.teacher_id,
                school_name=t.school_name,
                grade=t.grade,
                phone_number=t.phone_number,
                created_at=t.created_at,
                updated_at=t.updated_at,
                student_count=count,
            )
        )
    return responses


@router.patch("/{teacher_id}", response_model=UserResponse)
async def update_teacher_endpoint(
    teacher_id: str,
    teacher_in: UpdateTeacherRequest,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a teacher's info (master only)."""
    teacher = await get_teacher_by_id(db, teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="선생님을 찾을 수 없습니다",
        )

    updated = await update_teacher(
        db,
        teacher,
        name=teacher_in.name,
        password=teacher_in.password,
        phone_number=teacher_in.phone_number,
        school_name=teacher_in.school_name,
    )
    return updated


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_teacher_endpoint(
    teacher_id: str,
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a teacher account (master only)."""
    if teacher_id == master.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="자신의 계정은 삭제할 수 없습니다",
        )

    teacher = await get_teacher_by_id(db, teacher_id)
    if not teacher:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="선생님을 찾을 수 없습니다",
        )

    await delete_teacher(db, teacher)
    return None
