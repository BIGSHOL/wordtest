"""Stage Test API endpoints - separate from mastery/level-up system."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import CurrentUser
from app.core.security import create_access_token
from app.schemas.stage_test import (
    StartStageTestRequest,
    StartStageTestResponse,
    StageWordInfo,
    StageTestQuestionsRequest,
    StageTestAnswerRequest,
    StageTestAnswerResponse,
    StageTestCompleteRequest,
)
from app.services.stage_test import (
    start_by_code,
    generate_questions_for_words,
    submit_answer,
    complete_session,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stage-test", tags=["stage-test"])


@router.post("/start-by-code", response_model=StartStageTestResponse, status_code=status.HTTP_201_CREATED)
async def start_stage_test_by_code(
    body: StartStageTestRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a stage test session by test code."""
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

    return StartStageTestResponse(
        session_id=result["session_id"],
        assignment_id=result["assignment_id"],
        words=[StageWordInfo(**w) for w in result["words"]],
        initial_questions=result["initial_questions"],
        total_words=result["total_words"],
        max_fails=result["max_fails"],
        access_token=access_token,
        student_name=result["student_name"],
        engine_type=result.get("engine_type"),
    )


@router.post("/{session_id}/questions")
async def get_stage_test_questions(
    session_id: str,
    body: StageTestQuestionsRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Generate questions for specific words at their current stage."""
    try:
        questions = await generate_questions_for_words(
            db, session_id, body.word_mastery_ids
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return {"questions": questions}


@router.post("/{session_id}/answer", response_model=StageTestAnswerResponse)
async def submit_stage_test_answer(
    session_id: str,
    body: StageTestAnswerRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit an answer. Wrong answers do NOT demote stage."""
    try:
        result = await submit_answer(
            db,
            session_id=session_id,
            word_mastery_id=body.word_mastery_id,
            selected_answer=body.selected_answer,
            stage=body.stage,
            time_taken_seconds=body.time_taken_seconds,
            question_type=body.question_type,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return StageTestAnswerResponse(**result)


@router.post("/complete")
async def complete_stage_test(
    body: StageTestCompleteRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Complete a stage test session. No auth - session_id acts as token."""
    try:
        result = await complete_session(
            db,
            session_id=body.session_id,
            mastered_count=body.mastered_count,
            skipped_count=body.skipped_count,
            total_answered=body.total_answered,
            best_combo=body.best_combo,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("complete_stage_test failed: session=%s", body.session_id)
        raise HTTPException(status_code=500, detail=str(e))

    return result
