"""Test session service."""
from datetime import timedelta
from typing import Optional
from app.core.timezone import now_kst
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.word import Word
from app.services.level_engine import (
    generate_questions, determine_level, calculate_score,
    RANK_NAMES, format_rank_label,
)
from app.services.test_config import get_config_by_code


async def _expire_stale_sessions(db: AsyncSession, student_id: str) -> None:
    """Auto-expire incomplete sessions older than the configured timeout."""
    cutoff = now_kst() - timedelta(minutes=settings.TEST_SESSION_TIMEOUT_MINUTES)
    stale_result = await db.execute(
        select(TestSession).where(
            and_(
                TestSession.student_id == student_id,
                TestSession.completed_at.is_(None),
                TestSession.started_at < cutoff,
            )
        )
    )
    for session in stale_result.scalars().all():
        session.completed_at = now_kst()
        session.score = 0


async def start_test(
    db: AsyncSession,
    student_id: str,
    test_type: str = "placement",
    test_code: Optional[str] = None,
) -> tuple[TestSession, list[dict]]:
    """Start a new test session and generate questions.

    If test_code is provided, looks up the TestConfig and uses its settings.
    """
    # Auto-expire stale incomplete sessions before starting a new one
    await _expire_stale_sessions(db, student_id)

    test_config_id = None

    if test_code:
        config = await get_config_by_code(db, test_code)
        if not config:
            raise ValueError("Invalid or inactive test code")
        questions = await generate_questions(
            db,
            num_questions=config.question_count,
            level_min=config.level_range_min,
            level_max=config.level_range_max,
            book_name=config.book_name,
        )
        test_type = config.test_type
        test_config_id = config.id
    else:
        questions = await generate_questions(db)

    if not questions:
        raise ValueError("Not enough words to generate test questions")

    session = TestSession(
        student_id=student_id,
        test_type=test_type,
        test_config_id=test_config_id,
        total_questions=len(questions),
        correct_count=0,
    )
    db.add(session)
    await db.flush()

    # Pre-create answer records with correct_answer set
    for q in questions:
        answer = TestAnswer(
            test_session_id=session.id,
            word_id=q["word"].id,
            correct_answer=q["correct_answer"],
            is_correct=False,
            question_order=q["question_order"],
        )
        db.add(answer)

    await db.commit()
    await db.refresh(session)

    return session, questions


async def submit_answer(
    db: AsyncSession,
    test_session_id: str,
    word_id: str,
    selected_answer: str,
    question_order: int,
    student_id: str | None = None,
) -> dict:
    """Submit an answer for a test question."""
    # Load session for authorization and completion guard
    session_result = await db.execute(
        select(TestSession).where(TestSession.id == test_session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        return None

    # Authorization: verify the session belongs to the student
    if student_id and session.student_id != student_id:
        raise ValueError("Not authorized for this test session")

    # Completion guard: reject answers for already-completed sessions
    if session.completed_at is not None:
        raise ValueError("Test session already completed")

    # Timeout guard: reject answers for expired sessions
    timeout_cutoff = session.started_at + timedelta(minutes=settings.TEST_SESSION_TIMEOUT_MINUTES)
    if now_kst() > timeout_cutoff:
        session.completed_at = now_kst()
        session.score = 0
        await db.commit()
        raise ValueError("Test session has expired")

    # Find the answer record
    result = await db.execute(
        select(TestAnswer).where(
            TestAnswer.test_session_id == test_session_id,
            TestAnswer.word_id == word_id,
            TestAnswer.question_order == question_order,
        )
    )
    answer = result.scalar_one_or_none()
    if not answer:
        return None

    is_correct = selected_answer == answer.correct_answer
    answer.selected_answer = selected_answer
    answer.is_correct = is_correct
    answer.answered_at = now_kst()

    # Update session correct count if correct
    if is_correct:
        session.correct_count += 1

    # Check if all questions answered
    all_answers_result = await db.execute(
        select(TestAnswer).where(TestAnswer.test_session_id == test_session_id)
    )
    all_answers = list(all_answers_result.scalars().all())
    answered_count = sum(1 for a in all_answers if a.answered_at is not None)

    if answered_count == len(all_answers):
        # All questions answered - complete the test
        correct_total = sum(1 for a in all_answers if a.is_correct)
        session.correct_count = correct_total
        session.completed_at = now_kst()

        # Build (word_level, lesson, is_correct) list ordered by question_order
        sorted_answers = sorted(all_answers, key=lambda a: a.question_order)
        word_ids = [a.word_id for a in sorted_answers]
        words_result = await db.execute(
            select(Word).where(Word.id.in_(word_ids))
        )
        words_map = {w.id: w for w in words_result.scalars().all()}
        answers_with_details: list[tuple[int, str, bool]] = []
        for a in sorted_answers:
            word = words_map.get(a.word_id)
            if word:
                answers_with_details.append((word.level, word.lesson, a.is_correct))

        rank, sublevel = determine_level(answers_with_details)
        session.determined_level = rank
        session.determined_sublevel = sublevel
        session.rank_name = RANK_NAMES.get(rank, f"Rank {rank}")
        session.score = calculate_score(correct_total, session.total_questions)

    await db.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": answer.correct_answer,
    }


async def get_test_result(
    db: AsyncSession, test_session_id: str
) -> tuple[TestSession, list[TestAnswer]] | None:
    """Get test result with all answers."""
    result = await db.execute(
        select(TestSession)
        .options(selectinload(TestSession.answers))
        .where(TestSession.id == test_session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    # Batch load word data for answers (avoid N+1 queries)
    sorted_answers = sorted(session.answers, key=lambda a: a.question_order)
    word_ids = [a.word_id for a in sorted_answers]
    words_result = await db.execute(
        select(Word).where(Word.id.in_(word_ids))
    )
    words_map = {w.id: w for w in words_result.scalars().all()}
    answers_with_words = []
    for answer in sorted_answers:
        word = words_map.get(answer.word_id)
        answers_with_words.append({
            "question_order": answer.question_order,
            "word_english": word.english if word else "",
            "correct_answer": answer.correct_answer,
            "selected_answer": answer.selected_answer,
            "is_correct": answer.is_correct,
        })

    return session, answers_with_words


async def list_tests_by_student(
    db: AsyncSession, student_id: str
) -> list[TestSession]:
    """List all test sessions for a student."""
    result = await db.execute(
        select(TestSession)
        .where(TestSession.student_id == student_id)
        .order_by(TestSession.started_at.desc())
    )
    return list(result.scalars().all())
