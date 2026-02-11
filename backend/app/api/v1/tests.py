"""Level test endpoints."""
from typing import Annotated, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.test import (
    StartTestRequest,
    StartTestResponse,
    StartByCodeRequest,
    StartByCodeResponse,
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    TestSessionResponse,
    TestQuestion,
    TestQuestionWord,
    TestResultResponse,
    AnswerDetail,
    ListTestsResponse,
)
from app.core.deps import CurrentUser
from app.core.security import create_access_token
from app.services.test import start_test, submit_answer, get_test_result, list_tests_by_student
from app.services.test_config import get_config_by_code
from app.services.level_engine import format_rank_label
from app.models.user import User
from sqlalchemy import select


def _session_response(session) -> TestSessionResponse:
    """Build a TestSessionResponse with rank_label from a TestSession ORM object."""
    rank_label = None
    if session.determined_level and session.determined_sublevel:
        rank_label = format_rank_label(
            session.determined_level, session.determined_sublevel
        )
    return TestSessionResponse(
        id=session.id,
        student_id=session.student_id,
        test_type=session.test_type,
        total_questions=session.total_questions,
        correct_count=session.correct_count,
        determined_level=session.determined_level,
        determined_sublevel=session.determined_sublevel,
        rank_name=session.rank_name,
        rank_label=rank_label,
        score=session.score,
        test_config_id=session.test_config_id,
        started_at=str(session.started_at),
        completed_at=str(session.completed_at) if session.completed_at else None,
    )


def _questions_response(questions: list[dict]) -> list[TestQuestion]:
    return [
        TestQuestion(
            question_order=q["question_order"],
            word=TestQuestionWord(
                id=q["word"].id,
                english=q["word"].english,
                korean=q["word"].korean,
                example_en=q["word"].example_en,
                level=q["word"].level,
                lesson=q["word"].lesson or "",
            ),
            choices=q["choices"],
            correct_answer=q["correct_answer"],
            question_type=q.get("question_type", "word_meaning"),
        )
        for q in questions
    ]

router = APIRouter(prefix="/tests", tags=["tests"])


@router.post("/start", response_model=StartTestResponse, status_code=status.HTTP_201_CREATED)
async def start_test_endpoint(
    test_in: StartTestRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a new level test."""
    try:
        session, questions = await start_test(
            db, current_user.id, test_in.test_type, test_in.test_code
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    return StartTestResponse(
        test_session=_session_response(session),
        questions=_questions_response(questions),
    )


@router.post("/start-by-code", response_model=StartByCodeResponse, status_code=status.HTTP_201_CREATED)
async def start_test_by_code_endpoint(
    body: StartByCodeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a test using only a test code (no authentication required).

    Looks up the assignment by code, verifies it's pending, starts the test,
    and returns a JWT for subsequent authenticated requests.
    """
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    # Look up assignment + config
    lookup = await get_config_by_code(db, code)
    if not lookup:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Invalid or inactive test code",
        )

    assignment, config = lookup

    if assignment.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This test code has already been used",
        )

    # Get student info
    student_result = await db.execute(
        select(User).where(User.id == assignment.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Student not found",
        )

    # Start the test
    try:
        session, questions = await start_test(
            db, assignment.student_id, config.test_type, code
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )

    # Issue JWT for subsequent requests
    access_token = create_access_token(subject=student.id)

    return StartByCodeResponse(
        access_token=access_token,
        test_session=_session_response(session),
        questions=_questions_response(questions),
        student_name=student.name,
    )


@router.post("/{test_id}/answer", response_model=SubmitAnswerResponse)
async def submit_answer_endpoint(
    test_id: str,
    answer_in: SubmitAnswerRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit an answer for a test question."""
    try:
        result = await submit_answer(
            db,
            test_session_id=test_id,
            word_id=answer_in.word_id,
            selected_answer=answer_in.selected_answer,
            question_order=answer_in.question_order,
            student_id=current_user.id,
        )
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=str(e),
        )
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Answer record not found",
        )

    return SubmitAnswerResponse(
        is_correct=result["is_correct"],
        correct_answer=result["correct_answer"],
    )


@router.get("/{test_id}/result", response_model=TestResultResponse)
async def get_test_result_endpoint(
    test_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get test result with answers."""
    result = await get_test_result(db, test_id)
    if result is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Test session not found",
        )

    session, answers = result
    # Authorization: students can only view their own results
    if current_user.role == "student" and session.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this result",
        )
    return TestResultResponse(
        test_session=_session_response(session),
        answers=[AnswerDetail(**a) for a in answers],
    )


@router.get("", response_model=ListTestsResponse)
async def list_tests_endpoint(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    student_id: Optional[str] = Query(None),
):
    """List test sessions. Teacher can filter by student_id."""
    if current_user.role == "student":
        # Students can only see their own tests
        target_student_id = current_user.id
    else:
        target_student_id = student_id if student_id else current_user.id
    sessions = await list_tests_by_student(db, target_student_id)

    return {
        "tests": [_session_response(s) for s in sessions]
    }
