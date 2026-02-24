"""Level-Up test engine API endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.db.session import get_db
from app.core.security import create_access_token
from app.models.test_assignment import TestAssignment
from app.schemas.levelup import (
    StartLevelupRequest,
    LevelupBatchRequest,
    LevelupAnswerRequest,
    CompleteLevelupRequest,
    LevelupBatchSubmitRequest,
)
from app.services import levelup_service

router = APIRouter(prefix="/levelup", tags=["levelup"])


class CheckCodeRequest(BaseModel):
    test_code: str


@router.post("/check-code")
async def check_test_code(
    body: CheckCodeRequest,
    db: AsyncSession = Depends(get_db),
):
    """Check engine type for a test code without starting a session."""
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.test_code == code,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or inactive test code",
        )

    # Map old engine types to new ones
    engine = assignment.engine_type or "levelup"
    if engine.startswith("xp_"):
        engine = "levelup"
    elif engine.startswith("legacy_"):
        engine = "legacy"

    return {
        "engine_type": engine,
        "status": assignment.status,
        "assignment_id": assignment.id,
    }


@router.post("/start-by-code", status_code=status.HTTP_201_CREATED)
async def start_levelup_by_code(
    body: StartLevelupRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start an adaptive level-up test session by test code."""
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    try:
        result = await levelup_service.start_session(
            db, code, allow_restart=body.allow_restart,
        )
    except ValueError as e:
        msg = str(e)
        if "ALREADY_COMPLETED" in msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=msg,
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=msg,
        )

    # Generate access token for unauthenticated student access
    access_token = create_access_token(subject=result["student_id"])

    return {
        **result,
        "access_token": access_token,
    }


@router.post("/batch")
async def fetch_level_batch(
    body: LevelupBatchRequest,
    db: AsyncSession = Depends(get_db),
):
    """Fetch more questions for a specific level (on level up/down)."""
    try:
        questions = await levelup_service.fetch_level_questions(
            db,
            session_id=body.session_id,
            target_level=body.level,
            batch_size=body.batch_size,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return {
        "questions": questions,
        "level": body.level,
    }


@router.post("/{session_id}/answer")
async def submit_levelup_answer(
    session_id: str,
    body: LevelupAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit an answer for a level-up test question."""
    try:
        result = await levelup_service.submit_answer(
            db,
            session_id=session_id,
            word_mastery_id=body.word_mastery_id,
            selected_answer=body.selected_answer,
            time_taken_seconds=body.time_taken_seconds,
            question_type=body.question_type,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return result


@router.post("/{session_id}/submit-batch")
async def submit_levelup_batch(
    session_id: str,
    body: LevelupBatchSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit all answers in batch and complete the session (exam mode)."""
    try:
        answers = [a.model_dump() for a in body.answers]
        result = await levelup_service.submit_batch_and_complete(
            db,
            session_id=session_id,
            answers=answers,
            available_levels=body.available_levels,
            starting_level=body.starting_level,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    return result


@router.post("/complete")
async def complete_levelup(
    body: CompleteLevelupRequest,
    db: AsyncSession = Depends(get_db),
):
    """Complete a level-up test session."""
    try:
        result = await levelup_service.complete_session(
            db,
            session_id=body.session_id,
            final_level=body.final_level,
            best_combo=body.best_combo,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return result
