"""Test session service."""
from datetime import timedelta
from typing import Optional
from app.core.timezone import now_kst
from app.core.config import settings
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from sqlalchemy.orm import selectinload
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.word import Word
from app.services.level_engine import (
    generate_questions, determine_level, calculate_score,
    RANK_NAMES, format_rank_label,
)
from app.services.test_config import get_config_by_code
from app.models.test_assignment import TestAssignment


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
        # Adaptive mode: generate large pool, present only 20 questions
        ADAPTIVE_POOL_SIZE = 60
        ADAPTIVE_ANSWER_COUNT = 20
        questions = await generate_questions(db, num_questions=ADAPTIVE_POOL_SIZE)

    if not questions:
        raise ValueError("Not enough words to generate test questions")

    # For adaptive (no test_code): total_questions = 20, pool may be larger
    # For config-based: total_questions = actual question count
    actual_count = len(questions) if test_code else min(ADAPTIVE_ANSWER_COUNT, len(questions))

    session = TestSession(
        student_id=student_id,
        test_type=test_type,
        test_config_id=test_config_id,
        total_questions=actual_count,
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
    """Submit an answer for a test question.

    Optimized: PK lookup for session (db.get), single query for answer,
    SQL COUNT instead of loading all answers, Word JOIN only on last question.
    """
    # 1) PK lookup — uses identity map, no SQL if already cached
    session = await db.get(TestSession, test_session_id)
    if not session:
        return None

    # Authorization
    if student_id and session.student_id != student_id:
        raise ValueError("Not authorized for this test session")

    # Completion guard
    if session.completed_at is not None:
        raise ValueError("Test session already completed")

    # Timeout guard
    timeout_cutoff = session.started_at + timedelta(minutes=settings.TEST_SESSION_TIMEOUT_MINUTES)
    if now_kst() > timeout_cutoff:
        session.completed_at = now_kst()
        session.score = 0
        await db.commit()
        raise ValueError("Test session has expired")

    # 2) Find the answer record (uses composite index)
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

    if is_correct:
        session.correct_count += 1

    # 3) Check completion: answered >= total_questions (adaptive pool may have more)
    count_result = await db.execute(
        select(func.count()).select_from(TestAnswer).where(
            TestAnswer.test_session_id == test_session_id,
            TestAnswer.answered_at.isnot(None),
        )
    )
    answered_count = count_result.scalar()

    if answered_count >= session.total_questions:
        # Enough answered — complete the test
        # COUNT correct answers (only answered ones) in SQL
        correct_result = await db.execute(
            select(func.count()).select_from(TestAnswer).where(
                TestAnswer.test_session_id == test_session_id,
                TestAnswer.answered_at.isnot(None),
                TestAnswer.is_correct.is_(True),
            )
        )
        correct_total = correct_result.scalar()
        session.correct_count = correct_total
        session.completed_at = now_kst()

        # Load ANSWERED answers + words for level determination
        detail_result = await db.execute(
            select(TestAnswer.is_correct, Word.level, Word.lesson)
            .join(Word, TestAnswer.word_id == Word.id)
            .where(
                TestAnswer.test_session_id == test_session_id,
                TestAnswer.answered_at.isnot(None),
            )
            .order_by(TestAnswer.question_order)
        )
        answers_with_details = [
            (level, lesson, is_c) for is_c, level, lesson in detail_result.all()
        ]

        rank, sublevel = determine_level(answers_with_details)
        session.determined_level = rank
        session.determined_sublevel = sublevel
        session.rank_name = RANK_NAMES.get(rank, f"Rank {rank}")
        session.score = calculate_score(correct_total, session.total_questions)

        # Update linked TestAssignment if exists
        if session.test_config_id:
            assign_result = await db.execute(
                select(TestAssignment).where(
                    TestAssignment.test_config_id == session.test_config_id,
                    TestAssignment.student_id == session.student_id,
                )
            )
            linked_assignment = assign_result.scalar_one_or_none()
            if linked_assignment:
                linked_assignment.status = "completed"
                linked_assignment.completed_at = now_kst()
                linked_assignment.test_session_id = session.id

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

    # Only include answered questions (adaptive pool may have unanswered ones)
    answered = [a for a in session.answers if a.answered_at is not None]
    sorted_answers = sorted(answered, key=lambda a: a.question_order)
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
        .limit(50)
    )
    return list(result.scalars().all())
