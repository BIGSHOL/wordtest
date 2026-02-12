"""Stage Test service - wave-based word mastery through stages 1→5.

Completely separate from the mastery/level-up system.
Words progress through 5 stages; wrong answers do NOT demote stage.
"""
import uuid
import random
from datetime import timedelta

from sqlalchemy import select, func, Integer, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig
from app.models.user import User
from app.core.timezone import now_kst
from app.services.mastery_engine import (
    generate_stage_questions, generate_word_questions, generate_listen_questions,
    check_typing_answer,
)
from app.services.mastery import (
    _get_assignment_and_config,
    _get_words_for_config,
    _ensure_mastery_records,
)
from app.schemas.mastery import MasteryQuestion

INITIAL_BATCH = 8
MAX_FAILS_DEFAULT = 3
REVIEW_INTERVALS = [3, 7, 30]


async def start_by_code(
    db: AsyncSession, code: str, allow_restart: bool = False
) -> dict:
    """Start a stage test session by test code.

    Returns dict with session, words, initial questions, etc.
    """
    lookup = await _get_assignment_and_config(db, code)
    if not lookup:
        raise ValueError("Invalid or inactive test code")

    assignment, config = lookup

    engine_type = assignment.engine_type
    # Allow legacy_stage, legacy_listen, legacy_word engines + fallback for periodic
    if engine_type not in ("legacy_stage", "legacy_listen", "legacy_word", None):
        raise ValueError("This test code is not for a stage/legacy test")
    if engine_type is None and config.test_type != "periodic":
        raise ValueError("This test code is not for a stage test")

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

    # Ensure mastery records exist
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
        # Reusing existing session: clear old answers & reset
        await db.execute(
            delete(LearningAnswer).where(LearningAnswer.session_id == session.id)
        )
        session.words_practiced = 0
        session.words_advanced = 0
        session.words_demoted = 0
        session.best_combo = 0
        session.started_at = now_kst()

        # Reset mastery stages for all words in this session
        for m in masteries:
            m.stage = 1
            m.stage_streak = 0
            m.mastered_at = None
            m.review_due_at = None
    else:
        session = LearningSession(
            id=str(uuid.uuid4()),
            student_id=assignment.student_id,
            assignment_id=assignment.id,
        )
        db.add(session)
        await db.flush()

        # Reset all mastery records to stage 1 for fresh start
        for m in masteries:
            m.stage = 1
            m.stage_streak = 0
            m.mastered_at = None
            m.review_due_at = None

    # Build word info list
    words_map = {w.id: w for w in all_words}
    mastery_by_word = {m.word_id: m for m in masteries}

    word_infos = []
    for word in all_words:
        m = mastery_by_word.get(word.id)
        if m:
            word_infos.append({
                "word_mastery_id": m.id,
                "word_id": word.id,
                "english": word.english,
                "korean": word.korean,
                "stage": m.stage,
                "level": word.level,
                "lesson": word.lesson,
            })

    # Generate initial batch of questions (first wave at stage 1)
    random.shuffle(masteries)
    initial_masteries = masteries[:INITIAL_BATCH]
    if engine_type == "legacy_listen":
        initial_questions = generate_listen_questions(initial_masteries, words_map, all_words)
    elif engine_type == "legacy_word":
        initial_questions = generate_word_questions(initial_masteries, words_map, all_words)
    else:
        initial_questions = generate_stage_questions(initial_masteries, words_map, 1, all_words)
    random.shuffle(initial_questions)

    await db.commit()

    return {
        "session_id": session.id,
        "assignment_id": assignment.id,
        "words": word_infos,
        "initial_questions": initial_questions,
        "total_words": len(all_words),
        "max_fails": MAX_FAILS_DEFAULT,
        "student_name": student.name or "학생",
        "student_id": assignment.student_id,
        "engine_type": engine_type,
    }


async def generate_questions_for_words(
    db: AsyncSession,
    session_id: str,
    word_mastery_ids: list[str],
) -> list[MasteryQuestion]:
    """Generate questions for specific words at their current DB stage."""
    if not word_mastery_ids:
        return []

    # Load session to get assignment
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    # Load mastery records
    mastery_result = await db.execute(
        select(WordMastery).where(WordMastery.id.in_(word_mastery_ids))
    )
    masteries = list(mastery_result.scalars().all())
    if not masteries:
        return []

    # Load words
    word_ids = [m.word_id for m in masteries]
    word_result = await db.execute(
        select(Word).where(Word.id.in_(word_ids))
    )
    words = list(word_result.scalars().all())
    words_map = {w.id: w for w in words}

    # Load all words for distractors (from assignment's config)
    assignment_result = await db.execute(
        select(TestAssignment).where(TestAssignment.id == session.assignment_id)
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        return []

    config_result = await db.execute(
        select(TestConfig).where(TestConfig.id == assignment.test_config_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        return []

    all_words = await _get_words_for_config(db, config)

    # Dispatch by engine_type
    engine_type = assignment.engine_type

    # Group masteries by stage and generate
    stage_groups: dict[int, list[WordMastery]] = {}
    for m in masteries:
        stage = m.stage
        if stage not in stage_groups:
            stage_groups[stage] = []
        stage_groups[stage].append(m)

    all_questions: list[MasteryQuestion] = []
    for stage, stage_masteries in stage_groups.items():
        if engine_type == "legacy_listen":
            questions = generate_listen_questions(stage_masteries, words_map, all_words)
        elif engine_type == "legacy_word":
            questions = generate_word_questions(stage_masteries, words_map, all_words)
        else:
            questions = generate_stage_questions(stage_masteries, words_map, stage, all_words)
        all_questions.extend(questions)

    random.shuffle(all_questions)
    return all_questions


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    word_mastery_id: str,
    selected_answer: str,
    stage: int,
    time_taken_seconds: float | None = None,
    question_type: str | None = None,
) -> dict:
    """Submit answer for stage test. Wrong answers do NOT demote stage."""
    # Look up mastery record
    mastery_result = await db.execute(
        select(WordMastery).where(WordMastery.id == word_mastery_id)
    )
    mastery = mastery_result.scalar_one_or_none()
    if not mastery:
        raise ValueError("Word mastery record not found")

    # Look up the word
    word_result = await db.execute(
        select(Word).where(Word.id == mastery.word_id)
    )
    word = word_result.scalar_one_or_none()
    if not word:
        raise ValueError("Word not found")

    # Determine correct answer based on question_type
    if question_type:
        if question_type in ('word_to_meaning', 'listen_to_meaning'):
            correct = word.korean
        else:
            correct = word.english
    elif stage in (1, 4):
        correct = word.korean
    else:
        correct = word.english

    # Check answer
    is_typing_stage = stage in (3, 5)
    is_correct = False
    almost_correct = False

    if is_typing_stage:
        is_correct, almost_correct = check_typing_answer(selected_answer, correct)
    else:
        is_correct = selected_answer.strip() == correct.strip()

    word_mastered = False
    now = now_kst()

    # Update mastery record
    mastery.total_attempts += 1
    mastery.last_practiced_at = now

    new_stage = mastery.stage

    if not almost_correct:
        if is_correct:
            mastery.total_correct += 1
            # Advance stage (stage test: always advance on correct)
            new_stage = mastery.stage + 1
            mastery.stage_streak = 0

            if new_stage > 5:
                # Word mastered!
                mastery.stage = 5
                mastery.mastered_at = now
                mastery.review_due_at = now + timedelta(days=REVIEW_INTERVALS[0])
                word_mastered = True
                new_stage = 5
            else:
                mastery.stage = new_stage
        else:
            # Wrong answer: STAY at same stage (no demotion in stage test)
            # Stage and streak unchanged
            pass

    # Record answer
    answer = LearningAnswer(
        id=str(uuid.uuid4()),
        session_id=session_id,
        word_mastery_id=word_mastery_id,
        word_id=mastery.word_id,
        stage=stage,
        is_correct=is_correct,
        selected_answer=selected_answer,
        correct_answer=correct,
        time_taken_sec=time_taken_seconds,
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
        "new_stage": new_stage,
        "word_mastered": word_mastered,
    }


async def complete_session(
    db: AsyncSession,
    session_id: str,
    mastered_count: int = 0,
    skipped_count: int = 0,
    total_answered: int = 0,
    best_combo: int = 0,
) -> dict:
    """Complete a stage test session."""
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

    session.best_combo = best_combo
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
        "mastered_count": mastered_count,
        "skipped_count": skipped_count,
    }
