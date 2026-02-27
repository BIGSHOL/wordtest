"""Common utilities shared across test engines (levelup, legacy).

Extracted from mastery.py, mastery_engine.py, stage_test.py, listening_test.py
to avoid duplication across the two unified engines.
"""
import re
import uuid
import random
from difflib import SequenceMatcher

from sqlalchemy import select, func, and_, or_, delete, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.user import User
from app.core.timezone import now_kst
from app.services.question_engines import (
    get_engine, build_pool, resolve_name,
)
from app.services.question_engines.base import QuestionSpec


# ── Rank System ─────────────────────────────────────────────────────────────

MAX_RANK = 15

RANK_NAMES = {
    1: "Iron", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Platinum",
    6: "Emerald", 7: "Diamond", 8: "Master", 9: "Grandmaster", 10: "Challenger",
    11: "Legend", 12: "Legend", 13: "Legend", 14: "Legend", 15: "Legend",
}

RANK_NAMES_KO = {
    1: "아이언", 2: "브론즈", 3: "실버", 4: "골드", 5: "플래티넘",
    6: "에메랄드", 7: "다이아몬드", 8: "마스터", 9: "그랜드마스터", 10: "챌린저",
    11: "레전드", 12: "레전드", 13: "레전드", 14: "레전드", 15: "레전드",
}


def format_rank_label(rank: int, sublevel: int, max_sublevel: int | None = None) -> str:
    """Format rank display label, e.g. 'Iron 1-5' or 'Iron 1-MAX'."""
    name = RANK_NAMES.get(rank, f"Rank {rank}")
    if max_sublevel and sublevel >= max_sublevel:
        return f"{name} {rank}-MAX"
    return f"{name} {rank}-{sublevel}"


# ── Legacy Test Result (for historical data) ────────────────────────────────

async def get_test_result(
    db: AsyncSession, test_session_id: str
) -> tuple[TestSession, list[dict]] | None:
    """Get old-style test result with all answers (for viewing historical data)."""
    result = await db.execute(
        select(TestSession)
        .options(selectinload(TestSession.answers))
        .where(TestSession.id == test_session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        return None

    answered = [a for a in session.answers if a.answered_at is not None]
    sorted_answers = sorted(answered, key=lambda a: a.question_order)
    word_ids = [a.word_id for a in sorted_answers]
    words_result = await db.execute(
        select(Word).where(Word.id.in_(word_ids))
    )
    words_map = {w.id: w for w in words_result.scalars().all()}
    answers_with_words = []
    for i, answer in enumerate(sorted_answers):
        word = words_map.get(answer.word_id)
        time_taken = None
        if answer.answered_at:
            prev_time = sorted_answers[i - 1].answered_at if i > 0 else session.started_at
            if prev_time:
                delta = answer.answered_at - prev_time
                time_taken = round(delta.total_seconds(), 1)
                if time_taken < 0:
                    time_taken = None
        answers_with_words.append({
            "question_order": answer.question_order,
            "word_english": word.english if word else "",
            "correct_answer": answer.correct_answer,
            "selected_answer": answer.selected_answer,
            "is_correct": answer.is_correct,
            "word_level": word.level if word else 1,
            "time_taken_seconds": time_taken,
            "question_type": answer.question_type,
        })

    return session, answers_with_words


# ── Assignment & Config Lookup ───────────────────────────────────────────────

async def get_assignment_and_config(
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


async def get_student(db: AsyncSession, student_id: str) -> User:
    """Get student by ID. Raises ValueError if not found."""
    result = await db.execute(select(User).where(User.id == student_id))
    student = result.scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")
    return student


# ── Word Fetching ────────────────────────────────────────────────────────────

async def get_words_for_config(db: AsyncSession, config: TestConfig) -> list[Word]:
    """Get all words matching a test config's book/lesson range.

    Supports cross-book ranges when book_name != book_name_end.
    """
    query = select(Word).options(selectinload(Word.examples)).where(
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
                and_(Word.book_name > config.book_name, Word.book_name < effective_end),
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


# ── Mastery Records ──────────────────────────────────────────────────────────

async def ensure_mastery_records(
    db: AsyncSession,
    student_id: str,
    assignment_id: str,
    words: list[Word],
) -> list[WordMastery]:
    """Create WordMastery records for words that don't have one yet."""
    word_ids = [w.id for w in words]

    existing_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == student_id,
            WordMastery.word_id.in_(word_ids),
        )
    )
    existing = {m.word_id: m for m in existing_result.scalars().all()}

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

    all_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == student_id,
            WordMastery.word_id.in_(word_ids),
        ).order_by(WordMastery.stage.asc())
    )
    return list(all_result.scalars().all())


# ── Session Lifecycle ────────────────────────────────────────────────────────

async def check_already_completed(
    db: AsyncSession,
    assignment: TestAssignment,
    allow_restart: bool,
) -> None:
    """Check if a test is already completed. Respects teacher reset (was_reset).

    Raises ValueError("ALREADY_COMPLETED|...") if completed and not allowing restart.
    Updates assignment status from 'pending' to 'in_progress' if teacher reset.
    """
    was_reset = assignment.status == "pending"
    if was_reset:
        assignment.status = "in_progress"

    if not was_reset:
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


async def find_or_create_session(
    db: AsyncSession,
    assignment: TestAssignment,
) -> LearningSession:
    """Find an existing incomplete session or create a new one.

    If reusing, clears old answers and resets counters.
    """
    session_result = await db.execute(
        select(LearningSession).where(
            LearningSession.assignment_id == assignment.id,
            LearningSession.student_id == assignment.student_id,
            LearningSession.completed_at == None,
        ).order_by(LearningSession.started_at.desc()).limit(1)
    )
    session = session_result.scalar_one_or_none()

    if session:
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

    return session


async def compute_accuracy(db: AsyncSession, session_id: str) -> tuple[int, int, float]:
    """Compute accuracy from LearningAnswers.

    Returns: (total_count, correct_count, accuracy_pct)
    """
    result = await db.execute(
        select(
            func.count(LearningAnswer.id),
            func.sum(func.cast(LearningAnswer.is_correct, Integer)),
        ).where(LearningAnswer.session_id == session_id)
    )
    row = result.one()
    total_count = row[0] or 0
    correct_count = row[1] or 0
    accuracy = round((correct_count / total_count * 100) if total_count > 0 else 0, 1)
    return total_count, int(correct_count), accuracy


async def mark_assignment_completed(
    db: AsyncSession,
    assignment_id: str,
) -> None:
    """Mark a TestAssignment as completed."""
    result = await db.execute(
        select(TestAssignment).where(TestAssignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if assignment and assignment.status != "completed":
        assignment.status = "completed"
        assignment.completed_at = now_kst()


# ── Loanword Detection ───────────────────────────────────────────────────────

_HANGUL_BASE = 0xAC00
_INITIALS = list("ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ")
_FINALS = [""] + list("ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ")

_KO_CONSONANT_MAP: dict[str, str] = {
    "ㄱ": "K", "ㄲ": "K", "ㅋ": "K",
    "ㄴ": "N",
    "ㄷ": "T", "ㄸ": "T", "ㅌ": "T",
    "ㄹ": "R",
    "ㅁ": "M",
    "ㅂ": "P", "ㅃ": "P", "ㅍ": "P",
    "ㅅ": "S", "ㅆ": "S",
    "ㅇ": "",
    "ㅈ": "C", "ㅉ": "C", "ㅊ": "C",
    "ㅎ": "H",
}

_KO_DOUBLE_FINAL: dict[str, list[str]] = {
    "ㄳ": ["K", "S"], "ㄵ": ["N", "C"], "ㄶ": ["N", "H"],
    "ㄺ": ["R", "K"], "ㄻ": ["R", "M"], "ㄼ": ["R", "P"],
    "ㄽ": ["R", "S"], "ㄾ": ["R", "T"], "ㄿ": ["R", "P"],
    "ㅀ": ["R", "H"], "ㅄ": ["P", "S"],
}


def _korean_consonant_skeleton(text: str) -> str:
    """Extract consonant skeleton from Korean text."""
    result: list[str] = []
    for ch in text:
        cp = ord(ch)
        if _HANGUL_BASE <= cp <= 0xD7A3:
            idx = cp - _HANGUL_BASE
            initial_idx = idx // (21 * 28)
            final_idx = idx % 28
            init = _INITIALS[initial_idx]
            mapped = _KO_CONSONANT_MAP.get(init, "")
            if mapped:
                result.append(mapped)
            if final_idx > 0:
                final = _FINALS[final_idx]
                if final in _KO_DOUBLE_FINAL:
                    result.extend(_KO_DOUBLE_FINAL[final])
                elif final == "ㅇ":
                    result.append("NK")
                else:
                    mapped_f = _KO_CONSONANT_MAP.get(final, "")
                    if mapped_f:
                        result.append(mapped_f)
    return "".join(result)


_EN_DIGRAPHS: list[tuple[str, str]] = [
    ("tion", "SN"), ("sion", "SN"), ("ght", "T"),
    ("ph", "P"), ("sh", "S"), ("ch", "C"), ("th", "S"),
    ("ck", "K"), ("ng", "NK"), ("wh", "H"), ("wr", "R"),
    ("kn", "N"), ("qu", "K"),
]

_EN_CONSONANT_MAP: dict[str, str] = {
    "b": "P", "c": "K", "d": "T", "f": "P", "g": "K",
    "h": "H", "j": "C", "k": "K", "l": "R", "m": "M",
    "n": "N", "p": "P", "q": "K", "r": "R", "s": "S",
    "t": "T", "v": "P", "w": "", "x": "KS", "y": "",
    "z": "S",
}

_EN_VOWELS = set("aeiou")


def _english_consonant_skeleton(word: str) -> str:
    """Extract consonant skeleton from English word."""
    w = word.lower().strip()
    result: list[str] = []
    i = 0
    while i < len(w):
        matched = False
        for digraph, mapped in _EN_DIGRAPHS:
            if w[i:i + len(digraph)] == digraph:
                if mapped:
                    result.append(mapped)
                i += len(digraph)
                matched = True
                break
        if matched:
            continue
        ch = w[i]
        if ch in _EN_VOWELS or not ch.isalpha():
            i += 1
            continue
        mapped = _EN_CONSONANT_MAP.get(ch, "")
        if mapped:
            result.append(mapped)
        i += 1
    return "".join(result)


def is_likely_loanword(english: str, korean: str) -> bool:
    """Detect if a word pair is likely a loanword via consonant skeleton matching."""
    if not english or not korean:
        return False
    first_meaning = re.split(r"[,;]", korean)[0].strip()
    first_meaning = re.sub(r"\(.*?\)", "", first_meaning).strip()
    first_meaning = re.sub(r"~", "", first_meaning).strip()
    if " " in first_meaning:
        return False
    _KO_NATIVE_SUFFIXES = ("하다", "되다", "시키다", "적인", "적", "스런", "롭다")
    for suffix in _KO_NATIVE_SUFFIXES:
        if first_meaning.endswith(suffix):
            return False
    ko_syllables = sum(1 for ch in first_meaning if _HANGUL_BASE <= ord(ch) <= 0xD7A3)
    _KO_SHORT_SUFFIXES = ("의", "은", "는", "인", "한", "던", "런")
    if ko_syllables >= 3:
        for suffix in _KO_SHORT_SUFFIXES:
            if first_meaning.endswith(suffix):
                return False
    if first_meaning.endswith("다") and ko_syllables >= 2:
        return False
    if ko_syllables < 2:
        return False
    ko_skel = _korean_consonant_skeleton(first_meaning)
    en_skel = _english_consonant_skeleton(english)
    if not ko_skel or not en_skel:
        return False
    ratio = SequenceMatcher(None, en_skel, ko_skel).ratio()
    return ratio >= 0.5


# ── Typing Answer Check ──────────────────────────────────────────────────────

def edit_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    prev_row = list(range(len(s2) + 1))
    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row
    return prev_row[-1]


def check_typing_answer(submitted: str, correct: str) -> tuple[bool, bool]:
    """Check a typed answer against the correct answer.

    Returns (is_correct, is_almost) tuple.
    """
    submitted_clean = submitted.strip().lower()
    correct_clean = correct.strip().lower()
    if submitted_clean == correct_clean:
        return (True, False)
    dist = edit_distance(submitted_clean, correct_clean)
    if dist == 1 and len(correct_clean) >= 3:
        return (False, True)
    return (False, False)


# ── Deduplication ────────────────────────────────────────────────────────────

def first_korean_meaning(korean: str | None) -> str:
    """Extract normalised first Korean meaning for deduplication."""
    if not korean:
        return ""
    first = re.split(r"[,;]", korean)[0].strip()
    first = re.sub(r"\(.*?\)", "", first).strip()
    first = re.sub(r"~", "", first).strip()
    return first


def dedup_words(words: list[Word]) -> list[Word]:
    """Remove words with duplicate English or first Korean meaning."""
    seen_korean: set[str] = set()
    seen_english: set[str] = set()
    result: list[Word] = []
    for w in words:
        meaning = first_korean_meaning(w.korean)
        en_lower = w.english.lower().strip()
        if meaning and meaning in seen_korean:
            continue
        if en_lower in seen_english:
            continue
        if meaning:
            seen_korean.add(meaning)
        seen_english.add(en_lower)
        result.append(w)
    return result


def filter_loanwords(words: list[Word]) -> list[Word]:
    """Filter out loanwords from word list."""
    return [w for w in words if not is_likely_loanword(w.english, w.korean)]


def filter_compatible_words(
    words: list[Word],
    question_types: list[str],
) -> list[Word]:
    """Keep only words that at least one of the selected engines can handle.

    This prevents silent fallback to en_to_ko when e.g. only emoji is selected
    but a word has no emoji mapping.
    """
    if not question_types:
        return words
    engines = [get_engine(qt) for qt in question_types]
    return [w for w in words if any(e.can_generate(w) for e in engines)]


# ── Type-Specific Difficulty Scoring ──────────────────────────────────────────

_TYPING_TYPES = {"ko_type", "listen_type", "antonym_type", "sentence_type"}


def _typing_difficulty(word: Word) -> float:
    """Difficulty score for typing questions. Word length is dominant."""
    score = len(word.english) * 3
    if ' ' in word.english:
        score += 15
    return score


def _choice_difficulty(word: Word) -> float:
    """Difficulty score for choice questions. Meaning complexity is dominant."""
    score = 0.0
    # Multiple Korean meanings = harder to distinguish
    if word.korean:
        meaning_count = len(re.split(r'[,;]', word.korean))
        score += meaning_count * 3
    # POS complexity
    pos = (word.part_of_speech or '').strip()
    if pos in ('v', 'verb', '동사'):
        score += 4
    elif pos in ('adv', 'adverb', '부사'):
        score += 5
    elif pos in ('adj', 'adjective', '형용사'):
        score += 3
    # Antonym = more confusable with other words
    if word.antonym:
        score += 3
    # Phrases are harder
    if ' ' in word.english:
        score += 5
    # Minor word length factor
    score += len(word.english) * 0.3
    return score


# ── Question Generation ──────────────────────────────────────────────────────

def generate_questions_for_words(
    words: list[Word],
    all_words: list[Word],
    question_types: list[str],
    timer_seconds: int,
    masteries: list[WordMastery] | None = None,
    question_type_counts: dict[str, int] | None = None,
) -> list[dict]:
    """Generate questions using the modular engine system.

    Args:
        words: Words to generate questions for (in order).
        all_words: Full word pool for distractors.
        question_types: Canonical engine names, e.g. ["en_to_ko", "ko_to_en"].
        timer_seconds: Timer per question.
        masteries: Optional mastery records (for word_mastery_id mapping).
        question_type_counts: Optional dict mapping question type to desired count.
            If provided, allocates questions by count per type instead of round-robin.

    Returns list of question dicts ready for API response.
    """
    if not words or not question_types:
        return []

    pool = build_pool(all_words)
    mastery_map = {}
    if masteries:
        mastery_map = {m.word_id: m for m in masteries}

    def _build_question(word: Word, qtype: str) -> dict | None:
        """Build a single question dict for a word and question type, with fallback."""
        engine = get_engine(qtype)
        if not engine.can_generate(word):
            found = False
            for alt in question_types:
                if alt == qtype:
                    continue
                alt_engine = get_engine(alt)
                if alt_engine.can_generate(word):
                    qtype_used = alt
                    engine = alt_engine
                    found = True
                    break
            if not found:
                qtype_used = "en_to_ko"
                engine = get_engine(qtype_used)
                if not engine.can_generate(word):
                    return None
        else:
            qtype_used = qtype

        spec = engine.generate(word, pool)
        mastery = mastery_map.get(word.id)
        q_example_en = spec.sentence_en or word.example_en
        q_example_ko = spec.sentence_ko or word.example_ko

        return {
            "word_mastery_id": mastery.id if mastery else "",
            "word": {
                "id": word.id,
                "english": word.english,
                "korean": word.korean,
                "example_en": q_example_en,
                "example_ko": q_example_ko,
                "level": word.level,
                "lesson": word.lesson,
                "part_of_speech": word.part_of_speech,
            },
            "stage": 1,
            "question_type": spec.question_type,
            "choices": spec.choices,
            "correct_answer": spec.correct_answer,
            "timer_seconds": timer_seconds,
            "context_mode": spec.context_mode or "word",
            "sentence_blank": spec.sentence_blank,
            "emoji": spec.emoji,
            "hint": spec.hint,
        }

    questions: list[dict] = []

    if question_type_counts:
        # Allocate questions by specified count per type.
        # Each word is used AT MOST ONCE across all types to avoid repetition.
        # If not enough unique words, allow reuse as fallback.
        word_pool = list(words)
        used_word_ids: set[str] = set()
        for qtype, count in question_type_counts.items():
            if qtype in _TYPING_TYPES:
                type_pool = sorted(word_pool, key=_typing_difficulty, reverse=True)
            else:
                type_pool = sorted(word_pool, key=_choice_difficulty, reverse=True)
            generated = 0
            # Pass 1: prefer unused words
            for word in type_pool:
                if generated >= count:
                    break
                if word.id in used_word_ids:
                    continue
                q = _build_question(word, qtype)
                if q is not None:
                    questions.append(q)
                    used_word_ids.add(word.id)
                    generated += 1
            # Pass 2: allow reuse only if pool exhausted
            if generated < count:
                for word in type_pool:
                    if generated >= count:
                        break
                    if word.id not in used_word_ids:
                        continue  # already tried
                    q = _build_question(word, qtype)
                    if q is not None:
                        questions.append(q)
                        generated += 1
    else:
        # Default round-robin logic
        for i, word in enumerate(words):
            qtype = question_types[i % len(question_types)]
            q = _build_question(word, qtype)
            if q is not None:
                questions.append(q)

    # Sort questions by type then difficulty (level ascending within each type)
    questions.sort(key=lambda q: (
        _QUESTION_TYPE_ORDER.get(q["question_type"], 99),
        q["word"]["level"],
    ))

    return questions


# Defines the display order of question types for sorted output
_QUESTION_TYPE_ORDER = {
    "en_to_ko": 0,
    "ko_to_en": 1,
    "listen_en": 2,
    "listen_ko": 3,
    "listen_type": 4,
    "ko_type": 5,
    "emoji": 6,
    "sentence": 7,
    "sentence_type": 8,
    "antonym_choice": 9,
    "antonym_type": 10,
}


# ── Answer Checking ──────────────────────────────────────────────────────────

def determine_correct_answer(
    word: Word,
    question_type: str | None,
) -> str:
    """Determine the correct answer for a question based on its type."""
    if not question_type:
        return word.english

    canonical = resolve_name(question_type)

    # Korean answer types
    if canonical in ("en_to_ko", "listen_ko"):
        return word.korean
    # Antonym answer types
    if canonical in ("antonym_type", "antonym_choice"):
        return word.antonym or word.english
    # English answer types
    return word.english


def is_typing_question(question_type: str | None) -> bool:
    """Check if a question type requires typing input."""
    if not question_type:
        return False
    canonical = resolve_name(question_type)
    return canonical in ("listen_type", "ko_type", "antonym_type")


# ── Batch Answer Processing ───────────────────────────────────────────────────

async def process_batch_answers(
    db: AsyncSession,
    session_id: str,
    answers: list[dict],  # each has word_mastery_id, selected_answer, question_type
) -> list[dict]:
    """Process all answers in a batch. Returns list of result dicts."""
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise ValueError("Session not found")

    # Gather all mastery IDs
    mastery_ids = [a["word_mastery_id"] for a in answers]
    mastery_result = await db.execute(
        select(WordMastery).where(WordMastery.id.in_(mastery_ids))
    )
    mastery_map = {m.id: m for m in mastery_result.scalars().all()}

    # Gather all word IDs
    word_ids = [m.word_id for m in mastery_map.values()]
    word_result = await db.execute(
        select(Word).where(Word.id.in_(word_ids))
    )
    word_map = {w.id: w for w in word_result.scalars().all()}

    results = []
    correct_count = 0

    for ans in answers:
        mastery = mastery_map.get(ans["word_mastery_id"])
        if not mastery:
            results.append({"is_correct": False, "correct_answer": ""})
            continue

        word = word_map.get(mastery.word_id)
        if not word:
            results.append({"is_correct": False, "correct_answer": ""})
            continue

        question_type = ans.get("question_type")
        selected = ans["selected_answer"]
        correct = determine_correct_answer(word, question_type)

        is_correct = False
        if not selected:  # unanswered = wrong
            is_correct = False
        elif is_typing_question(question_type):
            is_correct, _ = check_typing_answer(selected, correct)
        else:
            is_correct = selected.strip() == correct.strip()

        # Update mastery
        mastery.total_attempts += 1
        mastery.last_practiced_at = now_kst()
        if is_correct:
            mastery.total_correct += 1
            correct_count += 1

        # Resolve canonical question type
        canonical_qt = resolve_name(question_type) if question_type else "en_to_ko"

        # Create LearningAnswer
        learning_answer = LearningAnswer(
            id=str(uuid.uuid4()),
            session_id=session_id,
            word_mastery_id=ans["word_mastery_id"],
            word_id=mastery.word_id,
            stage=1,
            is_correct=is_correct,
            selected_answer=selected,
            correct_answer=correct,
            time_taken_sec=ans.get("time_taken_seconds"),
            question_type=canonical_qt,
        )
        db.add(learning_answer)

        results.append({
            "is_correct": is_correct,
            "correct_answer": correct,
            "word_level": word.level,
        })

    # Update session counters
    session.words_practiced = len(answers)
    session.words_advanced = correct_count

    return results
