"""Level test engine - progressive difficulty with rank + sublevel system.

Rank System (10 ranks, LoL-style):
  1 Iron     | 2 Bronze   | 3 Silver    | 4 Gold      | 5 Platinum
  6 Emerald  | 7 Diamond  | 8 Master    | 9 Grandmaster | 10 Challenger

Each rank has sub-levels matching the number of lessons in that book.
  e.g. Iron 1-1, Iron 1-2, ..., Iron 1-25  (Power Voca 5000-01, 25 Lessons)
  Passing the last sub-level (MAX) promotes to the next rank.

Book → Rank mapping:
  - Power Voca 5000-01~10  (word level 1-10)  → Rank 1-10
  - 수능기출 5000-01~05    (word level 11-15) → Rank 10 (advanced tier)
"""
import random
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.word import Word

MAX_RANK = 10

RANK_NAMES = {
    1: "Iron",
    2: "Bronze",
    3: "Silver",
    4: "Gold",
    5: "Platinum",
    6: "Emerald",
    7: "Diamond",
    8: "Master",
    9: "Grandmaster",
    10: "Challenger",
}

RANK_NAMES_KO = {
    1: "아이언",
    2: "브론즈",
    3: "실버",
    4: "골드",
    5: "플래티넘",
    6: "에메랄드",
    7: "다이아몬드",
    8: "마스터",
    9: "그랜드마스터",
    10: "챌린저",
}


def word_level_to_rank(word_level: int) -> int:
    """Map word DB level (1-15) to rank (1-10)."""
    return min(word_level, MAX_RANK)


def format_rank_label(rank: int, sublevel: int, max_sublevel: int | None = None) -> str:
    """Format rank display label, e.g. 'Iron 1-5' or 'Iron 1-MAX'."""
    name = RANK_NAMES.get(rank, f"Rank {rank}")
    if max_sublevel and sublevel >= max_sublevel:
        return f"{name} {rank}-MAX"
    return f"{name} {rank}-{sublevel}"



async def generate_questions(
    db: AsyncSession,
    num_questions: int = 20,
    level_min: int = 1,
    level_max: int = 15,
    book_name: str | None = None,
) -> list[dict]:
    """Generate progressive difficulty questions from Rank 1 Lesson 01 → Rank 10.

    Questions are ordered from easiest to hardest. Within each rank,
    words are picked from early and late lessons to help estimate sublevel.

    Each question includes the word's level and lesson for sublevel
    determination after the test completes.
    """
    query = select(Word).where(
        Word.level >= level_min,
        Word.level <= level_max,
    )
    if book_name:
        query = query.where(Word.book_name == book_name)
    query = query.order_by(Word.level.asc(), Word.lesson.asc()).limit(1000)

    result = await db.execute(query)
    all_words = list(result.scalars().all())

    if len(all_words) < 4:
        return []

    # Group words by DB level
    words_by_level: dict[int, list[Word]] = defaultdict(list)
    for word in all_words:
        words_by_level[word.level].append(word)

    levels = sorted(words_by_level.keys())
    if not levels:
        return []

    # Distribute: 2 questions per level, capped by num_questions
    questions_per_level: dict[int, int] = {}
    remaining = num_questions
    for level in levels:
        if remaining <= 0:
            break
        count = min(2, len(words_by_level[level]), remaining)
        questions_per_level[level] = count
        remaining -= count

    # Distribute remaining budget
    for level in levels:
        if remaining <= 0:
            break
        current = questions_per_level.get(level, 0)
        if current < len(words_by_level[level]):
            questions_per_level[level] = current + 1
            remaining -= 1

    # Select words: pick from EVENLY SPACED lessons within each level
    # This enables adaptive testing at lesson granularity
    question_words: list[Word] = []
    for level in levels:
        count = questions_per_level.get(level, 0)
        if count == 0:
            continue

        level_words = words_by_level[level]
        by_lesson: dict[str, list[Word]] = defaultdict(list)
        for w in level_words:
            by_lesson[w.lesson].append(w)

        lessons_sorted = sorted(by_lesson.keys())
        selected: list[Word] = []

        if len(lessons_sorted) <= count:
            # Fewer lessons than needed: pick one from each lesson
            for lesson in lessons_sorted:
                selected.append(random.choice(by_lesson[lesson]))
        else:
            # Pick from evenly spaced lessons across the range
            step = len(lessons_sorted) / count
            for i in range(count):
                idx = int(i * step)
                lesson = lessons_sorted[min(idx, len(lessons_sorted) - 1)]
                selected.append(random.choice(by_lesson[lesson]))

        # Fill remaining if needed
        if len(selected) < count:
            selected_ids = {w.id for w in selected}
            extras = [w for w in level_words if w.id not in selected_ids]
            if extras:
                selected.extend(random.sample(
                    extras, min(count - len(selected), len(extras))
                ))

        question_words.extend(selected)

    # Pre-group words by korean meaning for O(1) wrong-answer filtering
    words_by_korean: dict[str, list[Word]] = defaultdict(list)
    for w in all_words:
        words_by_korean[w.korean].append(w)
    unique_korean_meanings = [k for k in words_by_korean if True]

    # Build questions (ordered easy → hard)
    questions = []
    for i, word in enumerate(question_words):
        # Pick 3 wrong meanings (exclude correct answer's korean)
        wrong_meanings = [k for k in unique_korean_meanings if k != word.korean]
        sampled_meanings = random.sample(wrong_meanings, min(3, len(wrong_meanings)))

        choices = [word.korean] + sampled_meanings
        random.shuffle(choices)

        questions.append({
            "question_order": i + 1,
            "word": word,
            "correct_answer": word.korean,
            "choices": choices,
        })

    return questions


def determine_level(
    answers_with_details: list[tuple[int, str, bool]],
) -> tuple[int, int]:
    """Determine student rank and sublevel from progressive answers.

    Args:
        answers_with_details: list of (word_level, lesson, is_correct) tuples,
            ordered from easiest to hardest.

    Returns:
        (rank, sublevel) tuple.
        rank: 1-10 (mapped from word_level via word_level_to_rank).
        sublevel: lesson index (1-based) within that rank.

    Algorithm:
        1. Group answers by rank.
        2. A rank is "passed" if the student got ≥50% correct.
        3. Student's rank = highest passed rank before failing 2 consecutive.
        4. Sublevel within the rank:
           - If both early + late lesson correct → MAX sublevel (mastered)
           - If only early lesson correct → mid sublevel
           - If neither correct → sublevel 1
    """
    if not answers_with_details:
        return (1, 1)

    # Group by rank
    rank_results: dict[int, list[tuple[str, bool]]] = defaultdict(list)
    for word_level, lesson, is_correct in answers_with_details:
        rank = word_level_to_rank(word_level)
        rank_results[rank].append((lesson, is_correct))

    # Find highest passed rank
    determined_rank = 1
    consecutive_fails = 0

    for rank in sorted(rank_results.keys()):
        entries = rank_results[rank]
        correct_count = sum(1 for _, c in entries if c)
        total = len(entries)
        passed = correct_count > 0 and correct_count >= total / 2

        if passed:
            determined_rank = rank
            consecutive_fails = 0
        else:
            consecutive_fails += 1
            if consecutive_fails >= 2:
                break

    # Determine sublevel within the determined rank
    sublevel = 1
    if determined_rank in rank_results:
        entries = rank_results[determined_rank]
        lessons_sorted = sorted(set(lesson for lesson, _ in entries))
        correct_lessons = sorted(
            set(lesson for lesson, c in entries if c)
        )

        if correct_lessons:
            # Sublevel = index of the highest correct lesson (1-based)
            all_lessons = lessons_sorted
            highest_correct = correct_lessons[-1]
            sublevel = all_lessons.index(highest_correct) + 1

            # If they got ALL questions right for this rank, estimate MAX
            # Require at least 2 answers to avoid single-question flukes
            correct_count = sum(1 for _, c in entries if c)
            if correct_count == len(entries) and len(entries) >= 2:
                # All correct → they likely mastered the whole book
                # Set sublevel to total lessons (will display as MAX)
                sublevel = 25  # default max; caller can adjust with actual data

    return (determined_rank, sublevel)


def calculate_score(correct_count: int, total_questions: int) -> int:
    """Calculate test score as percentage (0-100)."""
    if total_questions == 0:
        return 0
    return round((correct_count / total_questions) * 100)
