"""Level-Up Test Engine - adaptive difficulty within teacher's book range.

Difficulty adjusts based on correctness + speed:
- Correct + fast → move to harder words (higher level)
- Wrong → move to easier words (lower level)
- Converges to student's appropriate level, then tests there.

Word level (1-15) is the difficulty axis. Question types are orthogonal
and selected by the teacher at test creation time.
"""
import json
import uuid
import random
from collections import defaultdict

from sqlalchemy import select, func, Integer
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
    is_likely_loanword,
    check_typing_answer,
    is_typing_question,
    determine_correct_answer,
    filter_loanwords,
    filter_compatible_words,
    dedup_words,
    generate_questions_for_words,
)

SEGMENT_SIZE = 10  # Questions per level batch

# Grade → recommended starting book level (교재 순서대로)
# Levels 1-10: POWER VOCA 5000-01~10, Levels 11-15: 수능기출 01~05
GRADE_TO_START_LEVEL: dict[str, int] = {
    "초5": 1, "초6": 1,
    "중1": 2,
    "중2": 3,
    "중3": 4,
    "고1": 5,
    "고2": 8,
    "고3": 13,
}


def _normalize_grade(grade: str) -> str:
    """Normalize variant grade formats to standard short form.

    '초등5' → '초5', '중등1' → '중1', '고등2' → '고2', etc.
    """
    if not grade:
        return ""
    g = grade.strip()
    for long, short in [("초등", "초"), ("중등", "중"), ("고등", "고")]:
        if g.startswith(long):
            return short + g[len(long):]
    return g


async def start_session(
    db: AsyncSession, code: str, allow_restart: bool = False
) -> dict:
    """Start a level-up adaptive test session.

    Returns session info + initial question pool grouped by level.
    """
    lookup = await get_assignment_and_config(db, code)
    if not lookup:
        raise ValueError("Invalid or inactive test code")

    assignment, config = lookup

    # Accept "levelup", old "xp_*" types, and NULL
    et = assignment.engine_type
    if et and et != "levelup" and not et.startswith("xp_"):
        raise ValueError("This test code is not for a level-up test")

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
    total_time = config.total_time_override_seconds or config.question_count * timer_seconds

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

    # Group words by level for adaptive serving
    words_by_level: dict[int, list[Word]] = defaultdict(list)
    for w in compatible:
        words_by_level[w.level].append(w)

    available_levels = sorted(words_by_level.keys())
    if not available_levels:
        raise ValueError("No words available after filtering")

    # Grade-based starting level: find first available level >= student's recommended level
    recommended = GRADE_TO_START_LEVEL.get(_normalize_grade(student.grade or ""), 1)
    start_level = available_levels[-1]  # default: if above all, start at highest
    for lvl in available_levels:
        if lvl >= recommended:
            start_level = lvl
            break
    session.current_level = start_level

    # Generate initial question pool: current level + up to 4 more
    mastery_map = {m.word_id: m for m in masteries}
    initial_questions = _generate_multi_level_pool(
        words_by_level=words_by_level,
        all_words=all_words,
        mastery_map=mastery_map,
        start_level=start_level,
        max_levels=5,
        per_level=SEGMENT_SIZE,
        question_types=question_types,
        timer_seconds=timer_seconds,
        question_type_counts=question_type_counts,
    )

    # Level metadata for frontend
    level_info = {
        level: len(words)
        for level, words in words_by_level.items()
    }

    await db.commit()

    return {
        "session_id": session.id,
        "assignment_id": assignment.id,
        "questions": initial_questions,
        "total_words": len(compatible),
        "question_count": config.question_count,
        "student_name": student.name or "학생",
        "student_school": student.school_name or "",
        "student_grade": student.grade or "",
        "student_id": assignment.student_id,
        "engine_type": "levelup",
        "current_level": start_level,
        "level_info": level_info,
        "available_levels": available_levels,
        "per_question_time": timer_seconds,
        "total_time_seconds": total_time,
        "time_mode": "total" if config.total_time_override_seconds else "per_question",
        "book_name": config.book_name,
        "book_name_end": config.book_name_end or config.book_name,
        "lesson_range_start": config.lesson_range_start,
        "lesson_range_end": config.lesson_range_end,
        "question_types": config.question_types,
        "config_name": config.name or "",
    }


async def fetch_level_questions(
    db: AsyncSession,
    session_id: str,
    target_level: int,
    batch_size: int = SEGMENT_SIZE,
) -> list[dict]:
    """Fetch more questions for a specific level (called when student levels up/down).

    Excludes already-answered words in this session.
    """
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    # Get config for question types
    from app.models.test_assignment import TestAssignment
    from app.models.test_config import TestConfig

    assign_result = await db.execute(
        select(TestAssignment, TestConfig)
        .join(TestConfig, TestAssignment.test_config_id == TestConfig.id)
        .where(TestAssignment.id == session.assignment_id)
    )
    row = assign_result.first()
    if not row:
        raise ValueError("Assignment not found")
    assignment, config = row[0], row[1]

    question_types = _parse_question_types(config.question_types)
    timer_seconds = config.per_question_time_seconds or 10

    # Get all words in range, filter for compatibility
    all_words = await get_words_for_config(db, config)
    filtered = filter_compatible_words(
        dedup_words(filter_loanwords(all_words)), question_types
    )

    # Find already-answered word IDs in this session
    answered_result = await db.execute(
        select(LearningAnswer.word_id).where(
            LearningAnswer.session_id == session_id,
        ).distinct()
    )
    answered_word_ids = set(answered_result.scalars().all())

    # Get masteries for this student
    word_ids = [w.id for w in filtered]
    mastery_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == session.student_id,
            WordMastery.word_id.in_(word_ids),
        )
    )
    mastery_map = {m.word_id: m for m in mastery_result.scalars().all()}

    # Get unanswered words at target level (+ adjacent if needed)
    # Prioritize harder words (longer, verbs, phrases)
    target_words = [
        w for w in filtered
        if w.level == target_level and w.id not in answered_word_ids
    ]
    target_words.sort(key=_word_difficulty_score, reverse=True)
    batch = target_words[:batch_size]

    # Fill from adjacent levels if not enough
    if len(batch) < batch_size:
        adjacent = [
            w for w in filtered
            if w.level != target_level and w.id not in answered_word_ids
            and abs(w.level - target_level) <= 2
        ]
        adjacent.sort(key=lambda w: abs(w.level - target_level))
        random.shuffle(adjacent)
        batch.extend(adjacent[:batch_size - len(batch)])

    if not batch:
        return []

    questions = generate_questions_for_words(
        words=batch,
        all_words=all_words,
        question_types=question_types,
        timer_seconds=timer_seconds,
        masteries=list(mastery_map.values()),
    )

    return questions


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    word_mastery_id: str,
    selected_answer: str,
    time_taken_seconds: float | None = None,
    question_type: str | None = None,
) -> dict:
    """Submit an answer for a level-up test question.

    Simple correct/incorrect check. No stage progression.
    """
    # Look up mastery record
    mastery_result = await db.execute(
        select(WordMastery).where(WordMastery.id == word_mastery_id)
    )
    mastery = mastery_result.scalar_one_or_none()
    if not mastery:
        raise ValueError("Word mastery record not found")

    # Look up word with examples
    from sqlalchemy.orm import selectinload
    word_result = await db.execute(
        select(Word).options(selectinload(Word.examples)).where(Word.id == mastery.word_id)
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

    # Resolve canonical question type for storage
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

    # Prefer first example from word_examples, fallback to legacy columns
    ex_en = word.example_en
    ex_ko = word.example_ko
    if word.examples:
        ex_en = word.examples[0].example_en
        ex_ko = word.examples[0].example_ko

    return {
        "is_correct": is_correct,
        "almost_correct": almost_correct,
        "correct_answer": correct,
        "word_level": word.level,
        "example_en": ex_en,
        "example_ko": ex_ko,
    }


async def complete_session(
    db: AsyncSession,
    session_id: str,
    final_level: int,
    best_combo: int = 0,
) -> dict:
    """Complete a level-up test session.

    Persists the frontend-determined final level and computes accuracy.
    """
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    # Save final level
    session.current_level = max(1, min(final_level, 15))
    session.best_combo = best_combo
    session.completed_at = now_kst()

    # Compute accuracy
    total_count, correct_count, accuracy = await compute_accuracy(db, session_id)

    # Mark assignment completed
    if session.assignment_id:
        await mark_assignment_completed(db, session.assignment_id)

    await db.commit()

    return {
        "final_level": session.current_level,
        "accuracy": accuracy,
        "total_answered": total_count,
        "correct_count": correct_count,
        "best_combo": best_combo,
    }


async def submit_batch_and_complete(
    db: AsyncSession,
    session_id: str,
    answers: list[dict],
    available_levels: list[int],
    starting_level: int,
) -> dict:
    """Submit all answers in batch and complete the session.

    Simulates XP progression server-side to determine final_level.
    No speed bonus in exam mode (no per-question timing).
    """
    from app.services.test_common import process_batch_answers

    results = await process_batch_answers(db, session_id, answers)

    # Simulate XP to determine final level
    final_level = _simulate_xp_progression(
        results=results,
        available_levels=available_levels,
        starting_level=starting_level,
    )

    # Complete session
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    session.current_level = max(1, min(final_level, 15))
    session.completed_at = now_kst()

    total_count, correct_count, accuracy = await compute_accuracy(db, session_id)

    if session.assignment_id:
        await mark_assignment_completed(db, session.assignment_id)

    await db.commit()

    return {
        "final_level": session.current_level,
        "accuracy": accuracy,
        "total_answered": total_count,
        "correct_count": correct_count,
        "best_combo": 0,
    }


def _get_lesson_xp(book: int, num_levels: int = 15) -> int:
    """XP needed to level up at a given book level.

    Scales inversely with the number of available levels so that
    small ranges (e.g. 2-3 books) require more answers per level-up.
    """
    import math
    return (4 + book) * max(1, math.ceil(15 / num_levels)) * 4


def _compute_xp_change(
    is_correct: bool,
    question_level: int,
    current_book: int,
    combo: int,
    consecutive_wrong: int,
) -> int:
    """Compute XP change for a single answer (no speed bonus in exam mode)."""
    if is_correct:
        base = max(4, current_book) if question_level < current_book else 8 + current_book * 2
        # No speed bonus in exam mode
        combo_bonus = min(combo // 5 + 1, 5) if combo >= 3 else 0
        return base + combo_bonus
    else:
        if consecutive_wrong >= 2:
            return -(8 + current_book)
        elif consecutive_wrong >= 1:
            return -(5 + current_book)
        else:
            return -(3 + current_book)


def _simulate_xp_progression(
    results: list[dict],
    available_levels: list[int],
    starting_level: int,
) -> int:
    """Simulate XP-based level progression from batch results."""
    if not available_levels:
        return starting_level

    current_book = starting_level
    xp = 0
    combo = 0
    consecutive_wrong = 0

    for r in results:
        is_correct = r["is_correct"]
        question_level = r.get("word_level", current_book)

        if is_correct:
            combo += 1
            consecutive_wrong = 0
        else:
            combo = 0
            consecutive_wrong += 1

        xp_change = _compute_xp_change(
            is_correct=is_correct,
            question_level=question_level,
            current_book=current_book,
            combo=combo,
            consecutive_wrong=consecutive_wrong,
        )
        xp += xp_change

        lesson_xp = _get_lesson_xp(current_book, len(available_levels))

        # Level up
        if xp >= lesson_xp:
            next_levels = [l for l in available_levels if l > current_book]
            if next_levels:
                current_book = next_levels[0]
                xp = 0
        # Level down
        elif xp < 0:
            prev_levels = [l for l in available_levels if l < current_book]
            if prev_levels:
                current_book = prev_levels[-1]
                xp = _get_lesson_xp(current_book, len(available_levels)) // 2
            else:
                xp = 0

    return current_book


# ── Internal Helpers ─────────────────────────────────────────────────────────

def _parse_question_types(config_types: str | None) -> list[str]:
    """Parse question types from config string.

    Handles both canonical names and legacy names.
    """
    if not config_types:
        return ["en_to_ko", "ko_to_en"]

    types = [t.strip() for t in config_types.split(",") if t.strip()]
    # Resolve any legacy names to canonical
    resolved = [resolve_name(t) for t in types]
    return resolved if resolved else ["en_to_ko", "ko_to_en"]


def _generate_multi_level_pool(
    words_by_level: dict[int, list[Word]],
    all_words: list[Word],
    mastery_map: dict[str, WordMastery],
    start_level: int,
    max_levels: int,
    per_level: int,
    question_types: list[str],
    timer_seconds: int,
    question_type_counts: dict[str, int] | None = None,
) -> list[dict]:
    """Generate a multi-level question pool for initial serving.

    Limits active levels to max_levels from start_level.
    Adaptive mode uses current-level-heavy distribution (most words at starting level).
    Exam mode uses wider distribution across all available levels.
    """
    available_levels = sorted(words_by_level.keys())
    all_active = [l for l in available_levels if l >= start_level]

    if not all_active:
        return []

    if question_type_counts:
        # Exam mode: use ALL available levels with weighted distribution
        total_needed = sum(question_type_counts.values())
        pool_size = max(total_needed, total_needed * 2)

        combined_words = _weighted_word_selection(
            words_by_level, all_active, pool_size,
        )
        random.shuffle(combined_words)

        pool_masteries = [
            mastery_map[w.id] for w in combined_words if w.id in mastery_map
        ]
        return generate_questions_for_words(
            words=combined_words,
            all_words=all_words,
            question_types=question_types,
            timer_seconds=timer_seconds,
            masteries=pool_masteries,
            question_type_counts=question_type_counts,
        )

    # Adaptive mode: cap to max_levels from start, current-level-heavy distribution
    active_levels = all_active[:max_levels]
    total_budget = max_levels * per_level
    combined_words = _adaptive_word_selection(
        words_by_level, active_levels, total_budget, start_level,
    )

    if not combined_words:
        return []

    batch_masteries = [
        mastery_map[w.id] for w in combined_words if w.id in mastery_map
    ]

    return generate_questions_for_words(
        words=combined_words,
        all_words=all_words,
        question_types=question_types,
        timer_seconds=timer_seconds,
        masteries=batch_masteries,
    )


def _word_difficulty_score(word: Word) -> float:
    """General difficulty score for word pool selection. Higher = harder.

    Balanced across question types — word length is a minor factor.
    Primary factors: meaning complexity, POS difficulty, phrase/antonym.
    """
    score = 0.0
    # Phrases / multi-word entries are harder
    if ' ' in word.english:
        score += 10
    # Words with antonyms enable harder question types
    if word.antonym:
        score += 5
    # Part of speech: verbs/adverbs are harder than nouns
    pos = (word.part_of_speech or '').strip()
    if pos in ('v', 'verb', '동사'):
        score += 3
    elif pos in ('adv', 'adverb', '부사'):
        score += 4
    elif pos in ('adj', 'adjective', '형용사'):
        score += 2
    # Korean meaning complexity (multiple meanings = harder to remember)
    if word.korean:
        import re
        meaning_count = len(re.split(r'[,;]', word.korean))
        score += min(meaning_count - 1, 3)  # up to +3 for multiple meanings
    # Moderate word length bonus (reduced: secondary factor)
    score += len(word.english) * 0.5
    return score


def _adaptive_word_selection(
    words_by_level: dict[int, list[Word]],
    active_levels: list[int],
    total_budget: int,
    start_level: int,
) -> list[Word]:
    """Select words for adaptive mode: current level gets most words, fewer at higher levels.

    Distribution (5 levels): ~50% current, ~25% next, ~12% next, ~8%, ~5%
    This ensures the student sees mostly appropriate-difficulty words
    with some probing into harder levels.
    """
    # Inverse weighting: distance from start = less weight
    weights = {}
    for level in active_levels:
        dist = level - start_level  # 0, 1, 2, 3, 4 ...
        weights[level] = max(1, 8 - dist * 2)  # 8, 6, 4, 2, 1 ...

    total_weight = sum(weights.values())
    combined: list[Word] = []

    for level in active_levels:
        level_words = list(words_by_level.get(level, []))
        if not level_words:
            continue
        level_words.sort(key=_word_difficulty_score, reverse=True)
        allocation = max(1, round(total_budget * weights[level] / total_weight))
        combined.extend(level_words[:allocation])

    return combined


def _weighted_word_selection(
    words_by_level: dict[int, list[Word]],
    active_levels: list[int],
    total_budget: int,
) -> list[Word]:
    """Select words with higher levels AND harder words getting priority.

    Used for exam mode where all levels should be tested.
    Two-axis difficulty:
    1. Level weight: level 10 gets 10x the share of level 1
    2. Within each level: words sorted by difficulty score (hardest first)

    Guarantees at least 1 word per level if available.
    """
    total_weight = sum(active_levels)
    combined: list[Word] = []

    for level in active_levels:
        level_words = list(words_by_level.get(level, []))
        if not level_words:
            continue
        # Sort by difficulty score descending: hardest words first
        level_words.sort(key=_word_difficulty_score, reverse=True)
        # Allocate proportionally by weight, minimum 1
        allocation = max(1, round(total_budget * level / total_weight))
        combined.extend(level_words[:allocation])

    return combined
