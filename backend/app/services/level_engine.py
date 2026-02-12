"""Level test engine - progressive difficulty with rank + sublevel system.

Rank System (10 ranks, LoL-style):
  1 Iron     | 2 Bronze   | 3 Silver    | 4 Gold      | 5 Platinum
  6 Emerald  | 7 Diamond  | 8 Master    | 9 Grandmaster | 10 Challenger

Each rank has sub-levels matching the number of lessons in that book.
  e.g. Iron 1-1, Iron 1-2, ..., Iron 1-25  (Power Voca 5000-01, 25 Lessons)
  Passing the last sub-level (MAX) promotes to the next rank.

Book → Rank mapping:
  - Power Voca 5000-01~10  (word level 1-10)  → Rank 1-10
  - 수능기출 5000-01~05    (word level 11-15) → Rank 11-15 (Legend tier)
"""
import random
from collections import defaultdict
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.word import Word

MAX_RANK = 15

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
    11: "Legend",
    12: "Legend",
    13: "Legend",
    14: "Legend",
    15: "Legend",
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
    11: "레전드",
    12: "레전드",
    13: "레전드",
    14: "레전드",
    15: "레전드",
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
    book_name_end: str | None = None,
    lesson_start: str | None = None,
    lesson_end: str | None = None,
    question_types: list[str] | None = None,
) -> list[dict]:
    """Generate questions filtered by book, level, and lesson range.

    Supports cross-book ranges: when book_name != book_name_end,
    lesson_start applies to the start book and lesson_end to the end book.
    """
    from sqlalchemy import or_, and_ as sa_and

    query = select(Word).where(
        Word.level >= level_min,
        Word.level <= level_max,
        Word.is_excluded == False,
    )

    effective_end = book_name_end or book_name
    is_cross_book = effective_end and book_name and effective_end != book_name

    if is_cross_book and lesson_start and lesson_end:
        # Cross-book range: apply lesson constraints at boundaries only
        query = query.where(
            or_(
                sa_and(Word.book_name == book_name, Word.lesson >= lesson_start),
                sa_and(Word.book_name != book_name, Word.book_name != effective_end),
                sa_and(Word.book_name == effective_end, Word.lesson <= lesson_end),
            )
        )
    elif book_name:
        query = query.where(Word.book_name == book_name)
        if lesson_start and lesson_end:
            query = query.where(
                Word.lesson >= lesson_start,
                Word.lesson <= lesson_end,
            )
    query = query.order_by(Word.level.asc(), Word.lesson.asc()).limit(5000)

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

    # Distribute questions evenly across levels, then fill remaining
    total_available = sum(len(words_by_level[l]) for l in levels)
    questions_per_level: dict[int, int] = {}
    remaining = min(num_questions, total_available)

    # First pass: proportional allocation based on available words per level
    for level in levels:
        available = len(words_by_level[level])
        share = max(1, round(remaining * available / total_available)) if total_available > 0 else 0
        questions_per_level[level] = min(share, available)

    # Adjust to match exact target
    allocated = sum(questions_per_level.values())
    remaining = min(num_questions, total_available) - allocated

    # Add more if under-allocated
    for level in levels:
        if remaining <= 0:
            break
        current = questions_per_level.get(level, 0)
        available = len(words_by_level[level])
        if current < available:
            add = min(available - current, remaining)
            questions_per_level[level] = current + add
            remaining -= add

    # Remove excess if over-allocated
    if remaining < 0:
        for level in reversed(levels):
            if remaining >= 0:
                break
            current = questions_per_level.get(level, 0)
            reduce = min(current - 1, -remaining) if current > 1 else 0
            questions_per_level[level] = current - reduce
            remaining += reduce

    # Select words: pick from EVENLY SPACED lessons within each level
    # This enables adaptive testing at lesson granularity
    question_words: list[Word] = []
    used_english: set[str] = set()  # Prevent duplicate english words across levels

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
                candidates = [w for w in by_lesson[lesson] if w.english not in used_english]
                if candidates:
                    pick = random.choice(candidates)
                    selected.append(pick)
                    used_english.add(pick.english)
        else:
            # Pick from evenly spaced lessons across the range
            step = len(lessons_sorted) / count
            for i in range(count):
                idx = int(i * step)
                lesson = lessons_sorted[min(idx, len(lessons_sorted) - 1)]
                candidates = [w for w in by_lesson[lesson] if w.english not in used_english]
                if candidates:
                    pick = random.choice(candidates)
                    selected.append(pick)
                    used_english.add(pick.english)

        # Fill remaining if needed
        if len(selected) < count:
            selected_ids = {w.id for w in selected}
            extras = [w for w in level_words
                      if w.id not in selected_ids and w.english not in used_english]
            if extras:
                fills = random.sample(extras, min(count - len(selected), len(extras)))
                for f in fills:
                    used_english.add(f.english)
                selected.extend(fills)

        question_words.extend(selected)

    # Pre-group for wrong-answer generation
    words_by_korean: dict[str, list[Word]] = defaultdict(list)
    unique_english_set: set[str] = set()
    for w in all_words:
        words_by_korean[w.korean].append(w)
        unique_english_set.add(w.english)
    unique_korean_meanings = list(words_by_korean.keys())
    unique_english_words = list(unique_english_set)

    if not question_types:
        question_types = ["word_meaning"]

    # Build questions (ordered easy → hard)
    questions = []
    for i, word in enumerate(question_words):
        qtype = question_types[i % len(question_types)]

        if qtype == "meaning_word":
            # Korean → English: show korean meaning, choices are english words
            wrong_words = [e for e in unique_english_words if e != word.english]
            sampled = random.sample(wrong_words, min(3, len(wrong_words)))
            choices = [word.english] + sampled
            correct = word.english
        elif qtype == "sentence_blank" and word.example_en:
            # Sentence blank: choices are english words
            wrong_words = [e for e in unique_english_words if e != word.english]
            sampled = random.sample(wrong_words, min(3, len(wrong_words)))
            choices = [word.english] + sampled
            correct = word.english
        else:
            # word_meaning (default): show english, choices are korean meanings
            # Match ~ prefix pattern so tilde answers don't stand out
            correct_has_tilde = word.korean.strip().startswith('~')
            same_type = [k for k in unique_korean_meanings
                         if k != word.korean and k.strip().startswith('~') == correct_has_tilde]
            if len(same_type) >= 3:
                sampled = random.sample(same_type, 3)
            else:
                other = [k for k in unique_korean_meanings
                         if k != word.korean and k.strip().startswith('~') != correct_has_tilde]
                pool = same_type + other
                sampled = random.sample(pool, min(3, len(pool)))
            choices = [word.korean] + sampled
            correct = word.korean
            qtype = "word_meaning"

        random.shuffle(choices)

        questions.append({
            "question_order": i + 1,
            "word": word,
            "correct_answer": correct,
            "choices": choices,
            "question_type": qtype,
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
        rank: 1-15 (mapped from word_level via word_level_to_rank).
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
