"""Grammar test API endpoints."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.security import create_access_token
from app.core.deps import get_current_user
from app.models.grammar_book import GrammarBook
from app.models.grammar_chapter import GrammarChapter
from app.models.grammar_question import GrammarQuestion
from app.models.user import User
from app.schemas.grammar import (
    CreateGrammarConfigRequest,
    GrammarConfigResponse,
    AssignGrammarRequest,
    GrammarBookResponse,
    GrammarChapterResponse,
    GrammarChapterWithStats,
    GrammarQuestionBrowse,
    StartGrammarRequest,
    GrammarAnswerRequest,
    GrammarBatchSubmitRequest,
)
from app.services import grammar_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/grammar", tags=["grammar"])


# ── Books & Chapters ────────────────────────────────────────────────────

@router.get("/books")
async def list_books(db: AsyncSession = Depends(get_db)):
    """List all grammar books."""
    result = await db.execute(
        select(GrammarBook).order_by(GrammarBook.level)
    )
    books = result.scalars().all()
    return [GrammarBookResponse.model_validate(b) for b in books]


@router.get("/books/{book_id}/chapters")
async def list_chapters(
    book_id: str,
    db: AsyncSession = Depends(get_db),
):
    """List chapters for a grammar book with question counts."""
    result = await db.execute(
        select(
            GrammarChapter,
            func.count(GrammarQuestion.id).label("question_count"),
        )
        .outerjoin(GrammarQuestion, GrammarQuestion.chapter_id == GrammarChapter.id)
        .where(GrammarChapter.book_id == book_id)
        .group_by(GrammarChapter.id)
        .order_by(GrammarChapter.chapter_num)
    )
    rows = result.all()
    return [
        GrammarChapterWithStats(
            id=ch.id,
            book_id=ch.book_id,
            chapter_num=ch.chapter_num,
            title=ch.title,
            question_count=qc,
        )
        for ch, qc in rows
    ]


@router.get("/questions")
async def list_questions(
    db: AsyncSession = Depends(get_db),
    book_id: Optional[str] = Query(None),
    chapter_id: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
):
    """Browse grammar questions with filters."""
    query = select(GrammarQuestion)
    count_query = select(func.count(GrammarQuestion.id))

    if book_id:
        query = query.where(GrammarQuestion.book_id == book_id)
        count_query = count_query.where(GrammarQuestion.book_id == book_id)
    if chapter_id:
        query = query.where(GrammarQuestion.chapter_id == chapter_id)
        count_query = count_query.where(GrammarQuestion.chapter_id == chapter_id)
    if question_type:
        query = query.where(GrammarQuestion.question_type == question_type)
        count_query = count_query.where(GrammarQuestion.question_type == question_type)

    total = (await db.execute(count_query)).scalar() or 0
    result = await db.execute(
        query.order_by(GrammarQuestion.question_type, GrammarQuestion.difficulty)
        .offset(skip).limit(limit)
    )
    questions = result.scalars().all()
    return {
        "questions": [GrammarQuestionBrowse.model_validate(q) for q in questions],
        "total": total,
    }


# ── Config CRUD ─────────────────────────────────────────────────────────

@router.post("/configs", status_code=status.HTTP_201_CREATED)
async def create_config(
    body: CreateGrammarConfigRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Create a grammar test configuration."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers only")

    config = await grammar_service.create_config(
        db,
        teacher_id=current_user.id,
        name=body.name,
        book_ids=body.book_ids,
        chapter_ids=body.chapter_ids,
        question_count=body.question_count,
        time_limit_seconds=body.time_limit_seconds,
        per_question_seconds=body.per_question_seconds,
        time_mode=body.time_mode,
        question_types=body.question_types,
        question_type_counts=body.question_type_counts,
    )
    await db.commit()
    return GrammarConfigResponse.model_validate(config)


@router.get("/configs")
async def list_configs(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List grammar configs for the current teacher."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers only")
    configs = await grammar_service.list_configs(db, current_user.id)
    return [GrammarConfigResponse.model_validate(c) for c in configs]


@router.delete("/configs/{config_id}")
async def delete_config(
    config_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Soft-delete a grammar config."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers only")
    ok = await grammar_service.delete_config(db, config_id, current_user.id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")
    await db.commit()
    return {"ok": True}


# ── Assignment ──────────────────────────────────────────────────────────

@router.post("/configs/{config_id}/assign", status_code=status.HTTP_201_CREATED)
async def assign_grammar(
    config_id: str,
    body: AssignGrammarRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Assign grammar test to students."""
    if current_user.role != "teacher":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Teachers only")

    try:
        assignments = await grammar_service.assign_students(
            db, config_id, current_user.id, body.student_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()
    return {"assignments": assignments}


# ── Student Session ─────────────────────────────────────────────────────

@router.post("/start-by-code", status_code=status.HTTP_201_CREATED)
async def start_grammar_by_code(
    body: StartGrammarRequest,
    db: AsyncSession = Depends(get_db),
):
    """Start a grammar test session by test code."""
    try:
        result = await grammar_service.start_session(
            db, body.test_code, allow_restart=body.allow_restart,
        )
    except ValueError as e:
        msg = str(e)
        if "ALREADY_COMPLETED" in msg:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    access_token = create_access_token(subject=result["student_id"])
    await db.commit()

    return {**result, "access_token": access_token}


@router.post("/{session_id}/answer")
async def submit_answer(
    session_id: str,
    body: GrammarAnswerRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit a single grammar answer."""
    try:
        result = await grammar_service.submit_answer(
            db,
            session_id=session_id,
            question_id=body.question_id,
            selected_answer=body.selected_answer,
            time_taken_seconds=body.time_taken_seconds,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()
    return result


@router.post("/{session_id}/batch-submit")
async def batch_submit(
    session_id: str,
    body: GrammarBatchSubmitRequest,
    db: AsyncSession = Depends(get_db),
):
    """Submit all answers in batch and complete session (exam mode)."""
    try:
        answers = [a.model_dump() for a in body.answers]
        result = await grammar_service.submit_batch_and_complete(
            db,
            session_id=session_id,
            answers=answers,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()
    return result


@router.post("/{session_id}/complete")
async def complete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
):
    """Complete a grammar test session (for real-time mode)."""
    try:
        result = await grammar_service.complete_session(db, session_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    await db.commit()
    return result
