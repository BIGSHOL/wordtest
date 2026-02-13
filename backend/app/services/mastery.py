"""Mastery learning service - session management, answer processing, adaptive level."""
import re
import uuid
import random
from datetime import timedelta

from sqlalchemy import select, func, and_, delete, Integer
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
    generate_stage_questions, generate_mixed_questions,
    generate_word_questions, generate_listen_questions,
    check_typing_answer, is_likely_loanword,
)
from app.schemas.mastery import StageSummary, MasteryQuestion, STAGE_TIMERS


SEGMENT_SIZE = 10  # Questions per segment (5 segments = 50 total)
BATCH_SIZE_DEFAULT = 50
# SRS review intervals (days after mastering)
REVIEW_INTERVALS = [3, 7, 30]

# XP engine types that route through this service
XP_ENGINE_TYPES = {"xp_word", "xp_stage", "xp_listen"}


def _first_korean_meaning(korean: str | None) -> str:
    """Extract normalised first Korean meaning for deduplication."""
    if not korean:
        return ""
    first = re.split(r"[,;]", korean)[0].strip()
    first = re.sub(r"\(.*?\)", "", first).strip()
    first = re.sub(r"~", "", first).strip()
    return first


def _dedup_by_meaning(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
) -> list[WordMastery]:
    """Remove masteries whose word shares the same first Korean meaning.

    Keeps the first occurrence (by input order) for each unique meaning.
    """
    seen_korean: set[str] = set()
    seen_english: set[str] = set()
    result: list[WordMastery] = []
    for m in masteries:
        word = words_map.get(m.word_id)
        if not word:
            continue
        meaning = _first_korean_meaning(word.korean)
        en_lower = word.english.lower().strip()
        if meaning and meaning in seen_korean:
            continue
        if en_lower in seen_english:
            continue
        if meaning:
            seen_korean.add(meaning)
        seen_english.add(en_lower)
        result.append(m)
    return result


def _generate_by_engine(
    engine_type: str | None,
    masteries: list,
    words_map: dict,
    all_words: list,
    timer_override: int | None = None,
) -> list[MasteryQuestion]:
    """Dispatch question generation based on engine_type."""
    if engine_type == "xp_word":
        return generate_word_questions(masteries, words_map, all_words, timer_override=timer_override)
    elif engine_type == "xp_listen":
        return generate_listen_questions(masteries, words_map, all_words, timer_override=timer_override)
    else:
        # xp_stage or None (default) → mixed questions
        return generate_mixed_questions(masteries, words_map, all_words, timer_override=timer_override)


def get_required_streak(word_level: int) -> int:
    """Get consecutive correct answers needed to advance one stage.

    Returns 1: each correct answer immediately advances the stage.
    This avoids word repetition within a session and simplifies UX.
    """
    return 1



async def _get_assignment_and_config(
    db: AsyncSession, code: str
) -> tuple[TestAssignment, TestConfig] | None:
    """Look up assignment + config by test code."""
    result = await db.execute(
        select(TestAssignment, TestConfig)
        .join(TestConfig, TestAssignment.test_config_id == TestConfig.id)
        .where(
            TestAssignment.test_code == code.upper(),
            TestConfig.is_active == True,
        )
    )
    row = result.first()
    return (row[0], row[1]) if row else None


async def _get_words_for_config(db: AsyncSession, config: TestConfig) -> list[Word]:
    """Get all words matching a test config's book/lesson range.

    Supports cross-book ranges when book_name != book_name_end.
    """
    from sqlalchemy import or_

    query = select(Word).where(
        Word.level >= config.level_range_min,
        Word.level <= config.level_range_max,
        Word.is_excluded == False,
    )

    effective_end = config.book_name_end or config.book_name
    is_cross_book = effective_end and config.book_name and effective_end != config.book_name

    if is_cross_book and config.lesson_range_start and config.lesson_range_end:
        query = query.where(
            or_(
                and_(Word.book_name == config.book_name, Word.lesson >= config.lesson_range_start),
                and_(Word.book_name != config.book_name, Word.book_name != effective_end),
                and_(Word.book_name == effective_end, Word.lesson <= config.lesson_range_end),
            )
        )
    elif config.book_name:
        query = query.where(Word.book_name == config.book_name)
        if config.lesson_range_start and config.lesson_range_end:
            query = query.where(
                Word.lesson >= config.lesson_range_start,
                Word.lesson <= config.lesson_range_end,
            )
    query = query.order_by(Word.level.asc(), Word.lesson.asc())

    result = await db.execute(query)
    return list(result.scalars().all())


async def _ensure_mastery_records(
    db: AsyncSession,
    student_id: str,
    assignment_id: str,
    words: list[Word],
) -> list[WordMastery]:
    """Create WordMastery records for words that don't have one yet."""
    word_ids = [w.id for w in words]

    # Find existing records
    existing_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == student_id,
            WordMastery.word_id.in_(word_ids),
        )
    )
    existing = {m.word_id: m for m in existing_result.scalars().all()}

    # Create missing records
    new_records = []
    for word in words:
        if word.id not in existing:
            mastery = WordMastery(
                id=str(uuid.uuid4()),
                student_id=student_id,
                word_id=word.id,
                assignment_id=assignment_id,
                stage=1,
            )
            db.add(mastery)
            new_records.append(mastery)

    if new_records:
        await db.flush()

    # Return all records (existing + new)
    all_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == student_id,
            WordMastery.word_id.in_(word_ids),
        ).order_by(WordMastery.stage.asc())
    )
    return list(all_result.scalars().all())


async def _compute_stage_summary(
    masteries: list[WordMastery],
) -> StageSummary:
    """Compute stage distribution from mastery records."""
    counts = {1: 0, 2: 0, 3: 0, 4: 0, 5: 0}
    mastered = 0
    for m in masteries:
        if m.mastered_at:
            mastered += 1
        elif m.stage in counts:
            counts[m.stage] += 1
    return StageSummary(
        stage_1=counts[1], stage_2=counts[2], stage_3=counts[3],
        stage_4=counts[4], stage_5=counts[5], mastered=mastered,
    )


async def start_session_by_code(
    db: AsyncSession, code: str, allow_restart: bool = False
) -> tuple[LearningSession, list[MasteryQuestion], list[WordMastery], list[Word], TestAssignment, str, int, int]:
    """Start or resume a mastery learning session by test code.

    Returns:
        (session, first_batch_questions, all_masteries, all_words, assignment, student_name, current_level)
    """
    lookup = await _get_assignment_and_config(db, code)
    if not lookup:
        raise ValueError("Invalid or inactive test code")

    assignment, config = lookup

    # Get student info
    student_result = await db.execute(
        select(User).where(User.id == assignment.student_id)
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")

    # Get words for this assignment
    all_words = await _get_words_for_config(db, config)
    if len(all_words) < 4:
        raise ValueError("Not enough words in the selected range (minimum 4)")

    # Ensure mastery records exist
    masteries = await _ensure_mastery_records(
        db, assignment.student_id, assignment.id, all_words
    )

    # Handle SRS review: mastered words with review_due_at <= now go back to stage 3
    now = now_kst()
    for m in masteries:
        if m.mastered_at and m.review_due_at and m.review_due_at <= now:
            m.stage = 3
            m.mastered_at = None
            m.review_due_at = None

    # Update assignment status
    if assignment.status == "pending":
        assignment.status = "in_progress"

    # Check for already-completed session (1회 사용 제한)
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
        # Reusing existing session: clear old answers & reset counters
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

    # Generate multi-level question pool (current_level + up to 4 more levels)
    words_map = {w.id: w for w in all_words}
    timer_override = config.per_question_time_seconds  # None = use stage timers
    engine_type = assignment.engine_type
    first_batch = await get_question_pool(
        db, session, masteries, words_map, all_words,
        per_level=SEGMENT_SIZE,
        max_levels=5,
        timer_override=timer_override,
        engine_type=engine_type,
    )

    await db.commit()

    return (session, first_batch, masteries, all_words, assignment, student.name or "학생", session.current_level, config.question_count)


async def get_question_pool(
    db: AsyncSession,
    session: LearningSession,
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    per_level: int = 10,
    max_levels: int = 5,
    timer_override: int | None = None,
    engine_type: str | None = None,
) -> list[MasteryQuestion]:
    """Generate a multi-level question pool for adaptive level progression.

    Returns questions from current_level to current_level + max_levels - 1,
    with per_level questions per level. Excludes already-answered words.
    """
    start_level = session.current_level
    all_questions: list[MasteryQuestion] = []

    # Exclude words already answered in this session
    answered_result = await db.execute(
        select(LearningAnswer.word_mastery_id).where(
            LearningAnswer.session_id == session.id,
        ).distinct()
    )
    answered_ids = set(answered_result.scalars().all())

    for i in range(max_levels):
        level = start_level + i
        if level > 15:
            break

        level_masteries = [
            m for m in masteries
            if not m.mastered_at
            and m.id not in answered_ids
            and words_map.get(m.word_id)
            and words_map[m.word_id].level == level
            and not is_likely_loanword(words_map[m.word_id].english, words_map[m.word_id].korean)
        ]

        # Sort by lesson (ascending) so easier words come first within a level
        def _lesson_key(m: WordMastery) -> int:
            w = words_map.get(m.word_id)
            try:
                return int(w.lesson) if w and w.lesson else 0
            except (ValueError, TypeError):
                return 0

        level_masteries.sort(key=_lesson_key)
        level_masteries = _dedup_by_meaning(level_masteries, words_map)
        batch = level_masteries[:per_level]
        if not batch:
            continue

        questions = _generate_by_engine(engine_type, batch, words_map, all_words, timer_override=timer_override)
        all_questions.extend(questions)

    return all_questions


async def get_level_questions(
    db: AsyncSession,
    session: LearningSession,
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    target_level: int,
    batch_size: int = SEGMENT_SIZE,
    timer_override: int | None = None,
    engine_type: str | None = None,
) -> list[MasteryQuestion]:
    """Get questions for a specific level with fallback to adjacent levels.

    Excludes words already answered in this session to prevent repetition.
    Falls back to adjacent levels if not enough at target.
    """
    # Exclude words already answered in this session
    answered_result = await db.execute(
        select(LearningAnswer.word_mastery_id).where(
            LearningAnswer.session_id == session.id,
        ).distinct()
    )
    answered_ids = set(answered_result.scalars().all())

    # Separate masteries by level proximity (excluding answered)
    target_masteries = []
    other_masteries = []

    for m in masteries:
        if m.mastered_at or m.id in answered_ids:
            continue
        word = words_map.get(m.word_id)
        if not word:
            continue
        if is_likely_loanword(word.english, word.korean):
            continue
        if word.level == target_level:
            target_masteries.append(m)
        else:
            other_masteries.append(m)

    # Sort by lesson (ascending) for natural difficulty progression
    def _lesson_key(m: WordMastery) -> int:
        w = words_map.get(m.word_id)
        try:
            return int(w.lesson) if w and w.lesson else 0
        except (ValueError, TypeError):
            return 0

    target_masteries.sort(key=_lesson_key)
    target_masteries = _dedup_by_meaning(target_masteries, words_map)
    batch = target_masteries[:batch_size]

    # Fill from adjacent levels if needed
    if len(batch) < batch_size:
        other_masteries.sort(key=_lesson_key)
        other_masteries = _dedup_by_meaning(other_masteries, words_map)
        batch.extend(other_masteries[:batch_size - len(batch)])

    if not batch:
        return []

    questions = _generate_by_engine(engine_type, batch, words_map, all_words, timer_override=timer_override)
    return questions


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    word_mastery_id: str,
    selected_answer: str,
    stage: int,
    time_taken_seconds: float | None = None,
    question_type: str | None = None,
    context_mode: str | None = None,
) -> dict:
    """Submit an answer and process stage transition.

    Returns dict with result info.
    """
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

    # Determine correct answer based on context_mode / question_type / stage
    # Sentence mode: answer is always English (fill in the blank)
    if context_mode == 'sentence':
        correct = word.english
    elif question_type:
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

    previous_stage = mastery.stage
    new_stage = previous_stage
    required = get_required_streak(word.level)

    word_mastered = False
    stage_advanced = False
    now = now_kst()

    # Update mastery record
    mastery.total_attempts += 1
    mastery.last_practiced_at = now

    # Process stage transition (skip for "almost" answers)
    if not almost_correct:
        if is_correct:
            mastery.total_correct += 1
            mastery.stage_streak += 1

            # Check if streak meets requirement to advance
            if mastery.stage_streak >= required:
                new_stage = min(previous_stage + 1, 6)  # 6 means mastered
                mastery.stage_streak = 0  # Reset streak for new stage
                stage_advanced = True

                if new_stage > 5:
                    # Word mastered!
                    mastery.stage = 5
                    mastery.mastered_at = now
                    mastery.review_due_at = now + timedelta(days=REVIEW_INTERVALS[0])
                    word_mastered = True
                    new_stage = 5
                else:
                    mastery.stage = new_stage
            # else: stay at same stage, streak keeps building
        else:
            # Wrong answer: demote stage and reset streak
            new_stage = max(previous_stage - 1, 1)
            mastery.stage = new_stage
            mastery.stage_streak = 0

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
        elif not is_correct and not almost_correct:
            session.words_demoted += 1

    await db.commit()

    return {
        "is_correct": is_correct,
        "almost_correct": almost_correct,
        "correct_answer": correct,
        "new_stage": new_stage,
        "previous_stage": previous_stage,
        "word_mastered": word_mastered,
        "stage_streak": mastery.stage_streak,
        "required_streak": required,
        "example_en": word.example_en if stage == 1 else None,
        "example_ko": word.example_ko if stage == 1 else None,
        "current_level": session.current_level if session else 1,
    }


async def complete_batch(
    db: AsyncSession,
    session_id: str,
    final_level: int,
    best_combo: int = 0,
) -> dict:
    """Save the frontend-determined final level after all 50 questions.

    The XP-based level progression is computed on the frontend in real-time.
    This endpoint persists the final level to the DB and computes overall accuracy.
    """
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    previous_level = session.current_level
    new_level = max(1, min(final_level, 15))

    # Compute overall session accuracy
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

    # Save final level + mark session completed
    session.current_level = new_level
    session.best_combo = best_combo
    session.completed_at = now_kst()

    # Update linked TestAssignment status to "completed"
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
        "current_level": new_level,
        "previous_level": previous_level,
        "level_changed": new_level != previous_level,
        "accuracy": accuracy,
    }


async def get_mastery_progress(
    db: AsyncSession,
    assignment_id: str,
) -> dict:
    """Get mastery progress for a specific assignment."""
    # Get assignment + student info
    assignment_result = await db.execute(
        select(TestAssignment, User)
        .join(User, TestAssignment.student_id == User.id)
        .where(TestAssignment.id == assignment_id)
    )
    row = assignment_result.first()
    if not row:
        raise ValueError("Assignment not found")

    assignment, student = row[0], row[1]

    # Get config for word range
    config_result = await db.execute(
        select(TestConfig).where(TestConfig.id == assignment.test_config_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise ValueError("Test config not found")

    # Get all words in range
    all_words = await _get_words_for_config(db, config)
    word_ids = [w.id for w in all_words]

    # Get mastery records
    mastery_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == assignment.student_id,
            WordMastery.word_id.in_(word_ids),
        )
    )
    masteries = list(mastery_result.scalars().all())
    mastery_map = {m.word_id: m for m in masteries}

    summary = await _compute_stage_summary(masteries)
    total_words = len(all_words)
    mastery_rate = (summary.mastered / total_words * 100) if total_words > 0 else 0

    word_details = []
    for word in all_words:
        m = mastery_map.get(word.id)
        word_details.append({
            "word_id": word.id,
            "english": word.english,
            "korean": word.korean,
            "stage": m.stage if m else 0,
            "total_attempts": m.total_attempts if m else 0,
            "total_correct": m.total_correct if m else 0,
            "mastered": bool(m and m.mastered_at),
            "last_practiced_at": m.last_practiced_at.isoformat() if m and m.last_practiced_at else None,
        })

    return {
        "assignment_id": assignment_id,
        "student_name": student.name or "학생",
        "total_words": total_words,
        "stage_summary": summary,
        "mastery_rate": round(mastery_rate, 1),
        "last_practiced_at": max(
            (m.last_practiced_at for m in masteries if m.last_practiced_at),
            default=None,
        ),
        "word_details": word_details,
    }
