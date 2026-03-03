"""Level Test preset configurations and grade-to-book mapping."""

import re

from app.utils.load_words import BOOK_LEVEL_MAP

# Reverse map: level (1-15) -> book name
LEVEL_TO_BOOK: dict[int, str] = {v: k for k, v in BOOK_LEVEL_MAP.items()}

# Max level for level test (books 1-11 only)
_MAX_LEVEL = 11

# Grade -> base level (Book 1 = 초5, Book 11 = 고1, 2 books per grade step)
GRADE_BASE_LEVEL: dict[str, int] = {
    "초1": 1, "초2": 1, "초3": 1, "초4": 1,
    "초5": 1,
    "초6": 3,
    "중1": 5,
    "중2": 7,
    "중3": 9,
    "고1": 11,
    "고2": 11,
    "고3": 11,
}

GRADE_OPTIONS: list[str] = [
    "초1", "초2", "초3", "초4", "초5", "초6",
    "중1", "중2", "중3",
    "고1", "고2", "고3",
]

# Range: [base - 2, base + 4], clamped to [1, _MAX_LEVEL]
_RANGE_LOW = -2
_RANGE_HIGH = 4

# Elementary grades share a fixed range [1, 7]
_ELEMENTARY_RANGE = (1, 7)

# Normalize "초등5" → "초5", "중등1" → "중1", "고등2" → "고2" etc.
_GRADE_RE = re.compile(r"^(초등?|중등?|고등?)(\d)$")


def normalize_grade(raw: str) -> str | None:
    """Normalize various grade formats to canonical form (초5, 중1, 고2 etc.).

    Returns None if the value cannot be recognized.
    """
    raw = raw.strip()
    m = _GRADE_RE.match(raw)
    if not m:
        return None
    prefix, num = m.group(1), m.group(2)
    if prefix in ("초", "초등"):
        return f"초{num}"
    if prefix in ("중", "중등"):
        return f"중{num}"
    if prefix in ("고", "고등"):
        return f"고{num}"
    return None


def _is_elementary(grade: str) -> bool:
    """Check if grade is elementary school (초1~초6)."""
    return (grade or "").startswith("초")


def get_level_range_for_grade(grade: str) -> tuple[int, int]:
    """Return (level_min, level_max) for a grade.

    Elementary (초1~초6): fixed range [1, 7].
    Middle/High (중1~고3): base ± offset, clamped to [1, _MAX_LEVEL].
    """
    normalized = normalize_grade(grade) if grade not in GRADE_BASE_LEVEL else grade
    if normalized and _is_elementary(normalized):
        return _ELEMENTARY_RANGE
    base = GRADE_BASE_LEVEL.get(normalized or grade)
    if base is None:
        raise ValueError(f"Unknown grade: {grade}")
    low = max(1, base + _RANGE_LOW)
    high = min(_MAX_LEVEL, base + _RANGE_HIGH)
    return min(low, high), high


def get_book_range_for_grade(grade: str) -> tuple[str, str]:
    """Return (book_name_start, book_name_end) for a grade."""
    low, high = get_level_range_for_grade(grade)
    return LEVEL_TO_BOOK[low], LEVEL_TO_BOOK[high]


# Fixed presets
LEVEL_TEST_QUESTION_COUNT = 100
LEVEL_TEST_ENGINE = "levelup"
LEVEL_TEST_PER_QUESTION_TIME = 15  # seconds per question

# Question types (8 types) and per-type counts (total 100)
# Scaled from 50-question base ratio: 의미파악력:10, 단어연상력:11,
# 발음청취력:10, 어휘추론력:9, 철자기억력:5, 종합응용력:5 → ×1.8 + emoji 10
LEVEL_TEST_QUESTION_TYPES: list[str] = [
    "emoji",                                # 이모지
    "en_to_ko",                             # A. 의미파악력
    "ko_to_en",                             # B. 단어연상력
    "listen_en",                            # C. 발음청취력
    "sentence",                             # D. 어휘추론력
    "listen_type", "ko_type",               # E. 철자기억력
    "sentence_type",                        # F. 종합응용력
]
LEVEL_TEST_QUESTION_TYPE_COUNTS: dict[str, int] = {
    "emoji": 10,          # 이모지
    "en_to_ko": 18,       # A. 의미파악력
    "ko_to_en": 20,       # B. 단어연상력
    "listen_en": 18,      # C. 발음청취력
    "sentence": 16,       # D. 어휘추론력
    "listen_type": 5,     # E. 철자기억력
    "ko_type": 4,         # E. 철자기억력
    "sentence_type": 9,   # F. 종합응용력
}

# Grade-based difficulty bias for word selection within the same level.
# 0.0 = easiest words first, 1.0 = hardest words first.
# Higher grades get harder words even from the same book/level range.
GRADE_DIFFICULTY_BIAS: dict[str, float] = {
    "초1": 0.0, "초2": 0.1,
    "초3": 0.2, "초4": 0.3,
    "초5": 0.5, "초6": 0.7,
    "중1": 0.4, "중2": 0.5,
    "중3": 0.6,
    "고1": 0.7, "고2": 0.8,
    "고3": 1.0,
}
