"""Test assignment endpoints."""
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.core.deps import CurrentTeacher
from app.schemas.test_assignment import AssignTestRequest, TestAssignmentResponse
from app.services.test_assignment import (
    assign_test,
    list_assignments_by_teacher,
    delete_assignment,
    reset_assignment,
)

router = APIRouter(prefix="/test-assignments", tags=["test-assignments"])


@router.post("", response_model=list[TestAssignmentResponse], status_code=status.HTTP_201_CREATED)
async def create_assignments(
    data: AssignTestRequest,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Assign a test to multiple students (teacher only)."""
    assignments = await assign_test(db, teacher.id, data)
    return assignments


@router.get("", response_model=list[TestAssignmentResponse])
async def list_assignments(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """List all test assignments for the current teacher."""
    return await list_assignments_by_teacher(db, teacher.id)


@router.delete("/{assignment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_assignment(
    assignment_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Delete a pending test assignment (teacher only)."""
    deleted = await delete_assignment(db, assignment_id, teacher.id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found or not in pending status",
        )
    return None


@router.patch("/{assignment_id}/reset", status_code=status.HTTP_204_NO_CONTENT)
async def reset_assignment_endpoint(
    assignment_id: str,
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Reset a completed/in_progress assignment back to pending (teacher only)."""
    ok = await reset_assignment(db, assignment_id, teacher.id)
    if not ok:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Assignment not found or already pending",
        )
    return None
