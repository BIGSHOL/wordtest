"""Test configuration management endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.test_config import (
    CreateTestConfigRequest,
    UpdateTestConfigRequest,
    TestConfigResponse,
    AssignToConfigRequest,
)
from app.schemas.test_assignment import TestAssignmentResponse
from app.core.deps import CurrentTeacher, CurrentUser
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.user import User
from app.services.test_assignment import (
    build_test_config,
    create_assignments_for_config,
    _build_lesson_range,
)

router = APIRouter(prefix="/test-configs", tags=["test-configs"])


def _config_to_response(config: TestConfig, assignment_count: int = 0) -> TestConfigResponse:
    """Convert a TestConfig ORM object to a TestConfigResponse."""
    return TestConfigResponse(
        id=config.id,
        teacher_id=config.teacher_id,
        name=config.name,
        test_code=config.test_code,
        test_type=config.test_type,
        question_count=config.question_count,
        time_limit_seconds=config.time_limit_seconds,
        is_active=config.is_active,
        book_name=config.book_name,
        book_name_end=config.book_name_end,
        level_range_min=config.level_range_min,
        level_range_max=config.level_range_max,
        per_question_time_seconds=config.per_question_time_seconds,
        total_time_override_seconds=config.total_time_override_seconds,
        question_types=config.question_types,
        question_type_counts=config.question_type_counts,
        lesson_range_start=config.lesson_range_start,
        lesson_range_end=config.lesson_range_end,
        assignment_count=assignment_count,
        created_at=str(config.created_at),
        updated_at=str(config.updated_at),
    )


@router.get("", response_model=list[TestConfigResponse])
async def list_test_configs(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all active test configs for the current teacher with assignment counts."""
    count_subq = (
        select(func.count(TestAssignment.id))
        .where(TestAssignment.test_config_id == TestConfig.id)
        .correlate(TestConfig)
        .scalar_subquery()
    )

    query = (
        select(TestConfig, count_subq.label("assignment_count"))
        .where(
            TestConfig.teacher_id == teacher.id,
            TestConfig.is_active == True,
        )
        .order_by(TestConfig.created_at.desc())
    )
    result = await db.execute(query)
    rows = result.all()
    return [
        _config_to_response(config, assignment_count)
        for config, assignment_count in rows
    ]


@router.post("", response_model=TestConfigResponse, status_code=status.HTTP_201_CREATED)
async def create_test_config(
    config_in: CreateTestConfigRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a new test config with auto-generated name and level range."""
    config = await build_test_config(
        db,
        teacher.id,
        engine=config_in.engine,
        question_count=config_in.question_count,
        per_question_time_seconds=config_in.per_question_time_seconds,
        question_types=config_in.question_types,
        book_name=config_in.book_name,
        book_name_end=config_in.book_name_end,
        lesson_range_start=config_in.lesson_range_start,
        lesson_range_end=config_in.lesson_range_end,
        total_time_override_seconds=config_in.total_time_override_seconds,
        question_type_counts=config_in.question_type_counts,
        is_active=config_in.is_active,
        name=config_in.name,
    )
    await db.commit()
    await db.refresh(config)

    return _config_to_response(config, assignment_count=0)


@router.post(
    "/{config_id}/assign",
    response_model=list[TestAssignmentResponse],
    status_code=status.HTTP_201_CREATED,
)
async def assign_students_to_config(
    config_id: str,
    body: AssignToConfigRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign students to an existing test config."""
    # Load config and verify ownership
    result = await db.execute(
        select(TestConfig).where(TestConfig.id == config_id)
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found",
        )
    if config.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only assign students to your own test configs",
        )

    # Create assignments
    try:
        assignments = await create_assignments_for_config(
            db, teacher.id, config, body.student_ids, config.test_type,
        )
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="One or more students are already assigned to this config",
        )

    # Refresh to get IDs and timestamps
    for a in assignments:
        await db.refresh(a)

    # Fetch student info
    student_result = await db.execute(
        select(User).where(User.id.in_(body.student_ids))
    )
    students_map = {s.id: s for s in student_result.scalars().all()}

    book_end = config.book_name_end or config.book_name
    is_cross_book = book_end != config.book_name
    lesson_range = _build_lesson_range(
        config.book_name, book_end,
        config.lesson_range_start, config.lesson_range_end,
        is_cross_book, config.level_range_min, config.level_range_max,
    )

    responses = []
    for a in assignments:
        student = students_map.get(a.student_id)
        responses.append(
            TestAssignmentResponse(
                id=a.id,
                test_config_id=config.id,
                student_id=a.student_id,
                student_name=student.name if student else "",
                student_school=student.school_name if student else None,
                student_grade=student.grade if student else None,
                test_code=a.test_code,
                test_type=config.test_type,
                question_count=config.question_count,
                per_question_time_seconds=config.per_question_time_seconds,
                question_types=config.question_types,
                lesson_range=lesson_range,
                assignment_type=a.assignment_type,
                engine_type=a.engine_type,
                status=a.status,
                assigned_at=a.assigned_at,
                total_time_override_seconds=config.total_time_override_seconds,
                question_type_counts=config.question_type_counts,
                test_session_id=a.test_session_id,
            )
        )
    return responses


@router.patch("/{config_id}", response_model=TestConfigResponse)
async def update_test_config(
    config_id: str,
    config_in: UpdateTestConfigRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Update a test config (teacher only, own configs)."""
    result = await db.execute(select(TestConfig).where(TestConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found",
        )

    # Verify ownership
    if config.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own test configs",
        )

    # Update fields if provided
    update_data = config_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(config, field, value)

    await db.commit()
    await db.refresh(config)

    return _config_to_response(config)


@router.delete("/{config_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_test_config(
    config_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a test config (teacher only, own configs, no assignments)."""
    result = await db.execute(select(TestConfig).where(TestConfig.id == config_id))
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found",
        )

    # Verify ownership
    if config.teacher_id != teacher.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own test configs",
        )

    # Check for existing assignments
    count_result = await db.execute(
        select(func.count(TestAssignment.id)).where(
            TestAssignment.test_config_id == config_id
        )
    )
    assignment_count = count_result.scalar() or 0
    if assignment_count > 0:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cannot delete config with {assignment_count} existing assignment(s). Remove assignments first.",
        )

    await db.delete(config)
    await db.commit()
    return None


@router.get("/code/{code}", response_model=TestConfigResponse)
async def get_config_by_code(
    code: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Look up a test config by its 6-digit code (any authenticated user)."""
    result = await db.execute(
        select(TestConfig).where(
            TestConfig.test_code == code.upper(),
            TestConfig.is_active == True,
        )
    )
    config = result.scalar_one_or_none()

    if not config:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test config not found or inactive",
        )

    return _config_to_response(config)
