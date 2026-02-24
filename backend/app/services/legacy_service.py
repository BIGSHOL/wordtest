"""Legacy Test Engine - fixed difficulty within teacher's book range.

Teacher selects the book/lesson range. Questions are generated from that
exact range with no adaptive difficulty adjustment. Ordered easy → hard.
Simple accuracy scoring at the end.
"""
import json
import uuid
import random

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.core.timezone import now_kst
from app.services.question_engines import resolve_name
from app.services.test_common import (
    get_assignment_and_config,
    get_student,
    get_words_for_config,
    ensure_mastery_records,
    check_already_completed,
    find_or_create_session,
    compute_accuracy,
    mark_assignment_completed,
    check_typing_answer,
    is_typing_question,
    determine_correct_answer,
    filter_loanwords,
    filter_compatible_words,
    dedup_words,
    generate_questions_for_words,
)


async def start_session(
    db: AsyncSession, code: str, allow_restart: bool = False
) -> dict:
    """Start a legacy fixed-difficulty test session.

    All questions are generated upfront, ordered easy → hard.
    """
    lookup = await get_assignment_and_config(db, code)
    if not lookup:
        raise ValueError("Invalid or inactive test code")

    assignment, config = lookup

    # Accept "legacy", old "legacy_*" types, and NULL
    et = assignment.engine_type
    if et and et != "legacy" and not et.startswith("legacy_"):
        raise ValueError("This test code is not for a legacy test")

    student = await get_student(db, assignment.student_id)

    # Get all words in teacher's range
    all_words = await get_words_for_config(db, config)
    if len(all_words) < 4:
        raise ValueError("Not enough words in the selected range (minimum 4)")

    # Filter loanwords + deduplicate
    filtered = dedup_words(filter_loanwords(all_words))

    # Ensure mastery records
    masteries = await ensure_mastery_records(
        db, assignment.student_id, assignment.id, filtered
    )

    # Session lifecycle
    await check_already_completed(db, assignment, allow_restart)
    session = await find_or_create_session(db, assignment)

    # Parse question types from config
    question_types = _parse_question_types(config.question_types)
    timer_seconds = config.per_question_time_seconds or 10
    question_count = config.question_count or 20
    total_time = config.total_time_override_seconds or question_count * timer_seconds

    # Parse question_type_counts if available
    question_type_counts = None
    if config.question_type_counts:
        try:
            question_type_counts = json.loads(config.question_type_counts)
        except (json.JSONDecodeError, ValueError):
            question_type_counts = None

    # Filter to words compatible with selected question types (e.g. emoji-only)
    compatible = filter_compatible_words(filtered, question_types)
    if len(compatible) < 4:
        raise ValueError("Not enough compatible words for the selected question types (minimum 4)")

    # Sort words: easy → hard (level ASC, lesson ASC) - already sorted from DB
    # Select question_count words evenly distributed across the range
    selected_words = _select_distributed_words(compatible, question_count)

    # Generate ALL questions at once
    questions = generate_questions_for_words(
        words=selected_words,
        all_words=all_words,
        question_types=question_types,
        timer_seconds=timer_seconds,
        masteries=masteries,
        question_type_counts=question_type_counts,
    )

    await db.commit()

    return {
        "session_id": session.id,
        "assignment_id": assignment.id,
        "questions": questions,
        "total_words": len(questions),
        "question_count": len(questions),
        "student_name": student.name or "학생",
        "student_id": assignment.student_id,
        "engine_type": "legacy",
        "per_question_time": timer_seconds,
        "total_time_seconds": total_time,
        "time_mode": "total" if config.total_time_override_seconds else "per_question",
        "book_name": config.book_name,
        "book_name_end": config.book_name_end or config.book_name,
        "lesson_range_start": config.lesson_range_start,
        "lesson_range_end": config.lesson_range_end,
    }


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    word_mastery_id: str,
    selected_answer: str,
    time_taken_seconds: float | None = None,
    question_type: str | None = None,
) -> dict:
    """Submit an answer for a legacy test question. Simple correct/incorrect."""
    # Look up mastery record
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

    # Determine correct answer
    correct = determine_correct_answer(word, question_type)

    # Check answer
    is_correct = False
    almost_correct = False

    if is_typing_question(question_type):
        is_correct, almost_correct = check_typing_answer(selected_answer, correct)
    else:
        is_correct = selected_answer.strip() == correct.strip()

    # Update mastery stats
    mastery.total_attempts += 1
    mastery.last_practiced_at = now_kst()
    if is_correct and not almost_correct:
        mastery.total_correct += 1

    # Resolve canonical question type
    canonical_qt = resolve_name(question_type) if question_type else "en_to_ko"

    # Record answer
    answer = LearningAnswer(
        id=str(uuid.uuid4()),
        session_id=session_id,
        word_mastery_id=word_mastery_id,
        word_id=mastery.word_id,
        stage=1,
        is_correct=is_correct,
        selected_answer=selected_answer,
        correct_answer=correct,
        time_taken_sec=time_taken_seconds,
        question_type=canonical_qt,
    )
    db.add(answer)

    # Update session counters
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if session:
        session.words_practiced += 1
        if is_correct and not almost_correct:
            session.words_advanced += 1

    await db.commit()

    return {
        "is_correct": is_correct,
        "almost_correct": almost_correct,
        "correct_answer": correct,
    }


async def complete_session(
    db: AsyncSession,
    session_id: str,
) -> dict:
    """Complete a legacy test session. Simple accuracy scoring."""
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    session.completed_at = now_kst()

    # Compute accuracy
    total_count, correct_count, accuracy = await compute_accuracy(db, session_id)

    # Mark assignment completed
    if session.assignment_id:
        await mark_assignment_completed(db, session.assignment_id)

    await db.commit()

    return {
        "accuracy": accuracy,
        "total_answered": total_count,
        "correct_count": correct_count,
    }


async def submit_batch_and_complete(
    db: AsyncSession,
    session_id: str,
    answers: list[dict],
) -> dict:
    """Submit all answers in batch and complete the session."""
    from app.services.test_common import process_batch_answers

    await process_batch_answers(db, session_id, answers)

    # Complete session
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    session.completed_at = now_kst()

    total_count, correct_count, accuracy = await compute_accuracy(db, session_id)

    if session.assignment_id:
        await mark_assignment_completed(db, session.assignment_id)

    await db.commit()

    return {
        "accuracy": accuracy,
        "total_answered": total_count,
        "correct_count": correct_count,
    }


# ── Internal Helpers ─────────────────────────────────────────────────────────

def _parse_question_types(config_types: str | None) -> list[str]:
    """Parse question types from config string."""
    if not config_types:
        return ["en_to_ko", "ko_to_en"]

    types = [t.strip() for t in config_types.split(",") if t.strip()]
    resolved = [resolve_name(t) for t in types]
    return resolved if resolved else ["en_to_ko", "ko_to_en"]


def _select_distributed_words(words: list[Word], count: int) -> list[Word]:
    """Select words evenly distributed across the range.

    Words are assumed to be sorted by level ASC, lesson ASC (easy → hard).
    Returns selected words maintaining the easy→hard order.
    """
    if len(words) <= count:
        return words

    # Evenly spaced indices
    step = len(words) / count
    selected = []
    for i in range(count):
        idx = int(i * step)
        selected.append(words[min(idx, len(words) - 1)])

    return selected
