"""Mastery learning API endpoints."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.session import get_db
from app.core.deps import CurrentUser
from app.core.security import create_access_token
from app.schemas.mastery import (
    StartMasteryByCodeRequest,
    StartMasteryResponse,
    MasteryBatchRequest,
    MasteryBatchResponse,
    SubmitMasteryAnswerRequest,
    MasteryAnswerResult,
    MasteryProgressResponse,
    MasterySessionInfo,
    StageSummary,
)
from app.services.mastery import (
    start_session_by_code,
    get_level_questions,
    submit_answer,
    complete_batch,
    get_mastery_progress,
    _compute_stage_summary,
    _get_words_for_config,
    SEGMENT_SIZE,
)
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig

router = APIRouter(prefix="/mastery", tags=["mastery"])


def _session_info(session: LearningSession) -> MasterySessionInfo:
    return MasterySessionInfo(
        id=session.id,
        assignment_id=session.assignment_id,
        current_stage=session.current_stage,
        words_practiced=session.words_practiced,
        words_advanced=session.words_advanced,
        best_combo=session.best_combo,
        started_at=session.started_at.isoformat(),
    )


@router.post("/start-by-code", response_model=StartMasteryResponse, status_code=status.HTTP_201_CREATED)
async def start_mastery_by_code(
    body: StartMasteryByCodeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a mastery session. Returns multi-level question pool."""
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    try:
        session, questions, masteries, all_words, assignment, student_name, current_level = \
            await start_session_by_code(db, code, allow_restart=body.allow_restart)
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

    access_token = create_access_token(subject=assignment.student_id)
    summary = await _compute_stage_summary(masteries)

    return StartMasteryResponse(
        session=_session_info(session),
        stage_summary=summary,
        questions=questions,
        total_words=len(all_words),
        access_token=access_token,
        student_name=student_name,
        assignment_type="mastery",
        current_level=current_level,
    )


@router.post("/batch", response_model=MasteryBatchResponse)
async def get_batch(
    body: MasteryBatchRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Fetch more questions at a specific level (lazy loading when pool runs out)."""
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == body.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Load assignment + config
    assignment_result = await db.execute(
        select(TestAssignment).where(TestAssignment.id == session.assignment_id)
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    config_result = await db.execute(
        select(TestConfig).where(TestConfig.id == assignment.test_config_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")

    all_words = await _get_words_for_config(db, config)
    words_map = {w.id: w for w in all_words}
    word_ids = [w.id for w in all_words]

    mastery_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == current_user.id,
            WordMastery.word_id.in_(word_ids),
        )
    )
    masteries = list(mastery_result.scalars().all())

    # Use explicit level if provided, else session.current_level
    target_level = body.level if body.level else session.current_level

    questions = await get_level_questions(
        db, session, masteries, words_map, all_words,
        target_level=target_level,
        batch_size=body.batch_size,
    )

    summary = await _compute_stage_summary(masteries)
    await db.commit()

    return MasteryBatchResponse(
        questions=questions,
        remaining_in_stage=0,
        stage_summary=summary,
        current_level=session.current_level,
        previous_level=session.current_level,
        level_changed=False,
    )


class CompleteBatchRequest(BaseModel):
    session_id: str
    final_level: int = 1


@router.post("/complete-batch")
async def complete_batch_endpoint(
    body: CompleteBatchRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Save frontend-determined final level after all 50 questions."""
    try:
        result = await complete_batch(db, body.session_id, body.final_level)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return result


@router.post("/{session_id}/answer", response_model=MasteryAnswerResult)
async def submit_mastery_answer(
    session_id: str,
    body: SubmitMasteryAnswerRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit an answer and process word mastery stage transition."""
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

    return MasteryAnswerResult(**result)


@router.get("/progress/{assignment_id}", response_model=MasteryProgressResponse)
async def mastery_progress(
    assignment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get mastery progress for an assignment."""
    try:
        result = await get_mastery_progress(db, assignment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return MasteryProgressResponse(**result)
