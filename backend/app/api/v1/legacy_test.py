"""Legacy test engine API endpoints."""
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

from app.db.session import get_db
from app.core.security import create_access_token
from app.schemas.legacy_test import (
    StartLegacyRequest,
    LegacyAnswerRequest,
    CompleteLegacyRequest,
)
from app.services import legacy_service

router = APIRouter(prefix="/legacy", tags=["legacy"])


@router.post("/start-by-code", status_code=status.HTTP_201_CREATED)
async def start_legacy_by_code(
    body: StartLegacyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start a fixed-difficulty legacy test session by test code."""
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    try:
        result = await legacy_service.start_session(
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


@router.post("/{session_id}/answer")
async def submit_legacy_answer(
    session_id: str,
    body: LegacyAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit an answer for a legacy test question."""
    try:
        result = await legacy_service.submit_answer(
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


@router.post("/complete")
async def complete_legacy(
    body: CompleteLegacyRequest,
    db: AsyncSession = Depends(get_db),
):
    """Complete a legacy test session."""
    try:
        result = await legacy_service.complete_session(
            db,
            session_id=body.session_id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return result
