"""Listening Test API endpoints - simple listen-and-pick-word test mode."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import CurrentUser
from app.core.security import create_access_token
from app.schemas.listening_test import (
    StartListeningTestRequest,
    StartListeningTestResponse,
    ListeningQuestion,
    ListeningAnswerRequest,
    ListeningAnswerResponse,
    ListeningCompleteRequest,
    ListeningCompleteResponse,
)
from app.services.listening_test import (
    start_by_code,
    submit_answer,
    complete_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/listening-test", tags=["listening-test"])


@router.post("/start-by-code", response_model=StartListeningTestResponse, status_code=status.HTTP_201_CREATED)
async def start_listening_test_by_code(
    body: StartListeningTestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a listening test session by test code."""
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    try:
        result = await start_by_code(db, code, allow_restart=body.allow_restart)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("ALREADY_COMPLETED|"):
            parts = msg.split("|")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "ALREADY_COMPLETED",
                    "session_id": parts[1],
                    "assignment_id": parts[2],
                },
            )
        if "inactive" in msg.lower() or "invalid" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    access_token = create_access_token(subject=result["student_id"])

    return StartListeningTestResponse(
        session_id=result["session_id"],
        assignment_id=result["assignment_id"],
        questions=[ListeningQuestion(**q) for q in result["questions"]],
        total_words=result["total_words"],
        per_question_time=result["per_question_time"],
        access_token=access_token,
        student_name=result["student_name"],
    )


@router.post("/{session_id}/answer", response_model=ListeningAnswerResponse)
async def submit_listening_test_answer(
    session_id: str,
    body: ListeningAnswerRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit an answer for a listening test question."""
    try:
        result = await submit_answer(
            db,
            session_id=session_id,
            word_mastery_id=body.word_mastery_id,
            selected_answer=body.selected_answer,
            time_taken_seconds=body.time_taken_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return ListeningAnswerResponse(**result)


@router.post("/complete", response_model=ListeningCompleteResponse)
async def complete_listening_test(
    body: ListeningCompleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Complete a listening test session. No auth - session_id acts as token."""
    try:
        result = await complete_session(db, session_id=body.session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("complete_listening_test failed: session=%s", body.session_id)
        raise HTTPException(status_code=500, detail=str(e))

    return ListeningCompleteResponse(**result)
