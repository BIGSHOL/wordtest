"""Level Test API endpoints."""

from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import CurrentTeacher
from app.core.level_test_presets import LEVEL_TEST_QUESTION_COUNT
from app.schemas.level_test import (
    LevelTestCreateRequest,
    LevelTestCreateResponse,
    LevelTestStudentResult,
)
from app.schemas.test_assignment import TestAssignmentResponse
from app.services.level_test import create_level_test, list_level_test_assignments, delete_level_test_assignment

router = APIRouter(prefix="/level-test", tags=["level-test"])


@router.post(
    "",
    response_model=LevelTestCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_level_test_endpoint(
    data: LevelTestCreateRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Create a level test from existing students.

    Each student's registered grade determines their book range.
    """
    try:
        results = await create_level_test(
            db, str(teacher.id), data.student_ids,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return LevelTestCreateResponse(
        question_count=LEVEL_TEST_QUESTION_COUNT,
        students=[LevelTestStudentResult(**r) for r in results],
    )


@router.get("/assignments", response_model=list[TestAssignmentResponse])
async def list_level_test_assignments_endpoint(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all level test assignments for the current teacher."""
    return await list_level_test_assignments(db, str(teacher.id))


@router.delete("/assignments/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_level_test_assignment_endpoint(
    assignment_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a level-test assignment (any teacher can delete)."""
    deleted = await delete_level_test_assignment(db, assignment_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Level test assignment not found",
        )
