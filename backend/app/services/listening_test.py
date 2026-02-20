"""Listening Test service - simple listen-and-pick-word test mode.

Students hear English pronunciation and pick the correct word from choices.
No XP, no stages, no levels. Just accuracy at the end.
"""
import uuid
import random

from sqlalchemy import select, func, Integer, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.test_assignment import TestAssignment
from app.models.user import User
from app.core.timezone import now_kst
from app.services.listening_engine import generate_listening_questions
from app.services.mastery import (
    _get_assignment_and_config,
    _get_words_for_config,
    _ensure_mastery_records,
)

DEFAULT_TIMER = 8  # seconds per question


async def start_by_code(
    db: AsyncSession, code: str, allow_restart: bool = False
) -> dict:
    """Start a listening test session by test code.

    Returns dict with session, questions (all at once), etc.
    """
    lookup = await _get_assignment_and_config(db, code)
    if not lookup:
        raise ValueError("Invalid or inactive test code")

    assignment, config = lookup

    if config.test_type != "listening":
        raise ValueError("This test code is not for a listening test")

    # Get student info
    student_result = await db.execute(
        select(User).where(User.id == assignment.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")

    # Get words for this config
    all_words = await _get_words_for_config(db, config)
    if len(all_words) < 4:
        raise ValueError("Not enough words in the selected range (minimum 4)")

    # Ensure mastery records (needed for LearningAnswer FK)
    masteries = await _ensure_mastery_records(
        db, assignment.student_id, assignment.id, all_words
    )

    # Update assignment status
    if assignment.status == "pending":
        assignment.status = "in_progress"

    # Check for already-completed session
    completed_result = await db.execute(
        select(LearningSession).where(
            LearningSession.assignment_id == assignment.id,
            LearningSession.student_id == assignment.student_id,
            LearningSession.completed_at != None,
        ).order_by(LearningSession.completed_at.desc()).limit(1)
    )
    completed_session = completed_result.scalar_one_or_none()
    if completed_session and not allow_restart:
        raise ValueError(f"ALREADY_COMPLETED|{completed_session.id}|{assignment.id}")

    # Find or create session
    session_result = await db.execute(
        select(LearningSession).where(
            LearningSession.assignment_id == assignment.id,
            LearningSession.student_id == assignment.student_id,
            LearningSession.completed_at == None,
        ).order_by(LearningSession.started_at.desc()).limit(1)
    )
    session = session_result.scalar_one_or_none()

    if session:
        # Reusing existing session: clear old answers
        await db.execute(
            delete(LearningAnswer).where(LearningAnswer.session_id == session.id)
        )
        session.words_practiced = 0
        session.words_advanced = 0
        session.words_demoted = 0
        session.best_combo = 0
        session.started_at = now_kst()
    else:
        session = LearningSession(
            id=str(uuid.uuid4()),
            student_id=assignment.student_id,
            assignment_id=assignment.id,
        )
        db.add(session)
        await db.flush()

    # Build words map
    words_map = {w.id: w for w in all_words}

    # Timer from config (or default)
    timer_seconds = config.per_question_time_seconds or DEFAULT_TIMER

    # Shuffle masteries for random question order
    random.shuffle(masteries)

    # Generate all questions at once
    questions = generate_listening_questions(
        masteries, words_map, all_words,
        choice_count=4,
        timer_seconds=timer_seconds,
    )

    await db.commit()

    return {
        "session_id": session.id,
        "assignment_id": assignment.id,
        "questions": questions,
        "total_words": len(questions),
        "per_question_time": timer_seconds,
        "student_name": student.name or "학생",
        "student_id": assignment.student_id,
    }


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    word_mastery_id: str,
    selected_answer: str,
    time_taken_seconds: float | None = None,
) -> dict:
    """Submit answer for listening test. Simple correct/incorrect check."""
    # Look up mastery record (for word_id and FK)
    mastery_result = await db.execute(
        select(WordMastery).where(WordMastery.id == word_mastery_id)
    )
    mastery = mastery_result.scalar_one_or_none()
    if not mastery:
        raise ValueError("Word mastery record not found")

    # Look up word
    word_result = await db.execute(
        select(Word).where(Word.id == mastery.word_id)
    )
    word = word_result.scalar_one_or_none()
    if not word:
        raise ValueError("Word not found")

    correct = word.english
    is_correct = selected_answer.strip().lower() == correct.strip().lower()

    # Record answer
    answer = LearningAnswer(
        id=str(uuid.uuid4()),
        session_id=session_id,
        word_mastery_id=word_mastery_id,
        word_id=mastery.word_id,
        stage=1,  # no stage concept, use 1 as default
        is_correct=is_correct,
        selected_answer=selected_answer,
        correct_answer=correct,
        time_taken_sec=time_taken_seconds,
    )
    db.add(answer)

    # Update session counter
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if session:
        session.words_practiced += 1
        if is_correct:
            session.words_advanced += 1

    await db.commit()

    return {
        "is_correct": is_correct,
        "correct_answer": correct,
    }


async def complete_session(
    db: AsyncSession,
    session_id: str,
) -> dict:
    """Complete a listening test session."""
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    # Compute accuracy from answers
    answers_result = await db.execute(
        select(
            func.count(LearningAnswer.id),
            func.sum(func.cast(LearningAnswer.is_correct, Integer)),
        ).where(LearningAnswer.session_id == session_id)
    )
    row = answers_result.one()
    total_count = row[0] or 0
    correct_count = row[1] or 0
    accuracy = round((correct_count / total_count * 100) if total_count > 0 else 0, 1)

    session.completed_at = now_kst()

    # Update linked TestAssignment status
    if session.assignment_id:
        assign_result = await db.execute(
            select(TestAssignment).where(TestAssignment.id == session.assignment_id)
        )
        linked_assignment = assign_result.scalar_one_or_none()
        if linked_assignment and linked_assignment.status != "completed":
            linked_assignment.status = "completed"
            linked_assignment.completed_at = now_kst()

    await db.commit()

    return {
        "accuracy": accuracy,
        "total_answered": total_count,
        "correct_count": int(correct_count),
    }
