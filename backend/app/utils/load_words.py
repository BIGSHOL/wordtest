"""Load words from wordtest.xls into the database."""
import asyncio
import re
import uuid
from pathlib import Path

import xlrd
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings

XLS_PATH = Path(__file__).resolve().parents[3] / "data" / "wordtest.xls"

BOOK_LEVEL_MAP = {
    "Power Voca 5000-01": 1,
    "Power Voca 5000-02": 2,
    "Power Voca 5000-03": 3,
    "Power Voca 5000-04": 4,
    "Power Voca 5000-05": 5,
    "Power Voca 5000-06": 6,
    "Power Voca 5000-07": 7,
    "Power Voca 5000-08": 8,
    "Power Voca 5000-09": 9,
    "Power Voca 5000-10": 10,
    "Power Voca 수능 기출 5000-01": 11,
    "Power Voca 수능 기출 5000-02": 12,
    "Power Voca 수능 기출 5000-03": 13,
    "Power Voca 수능 기출 5000-04": 14,
    "Power Voca 수능 기출 5000-05": 15,
}


# --- Multi-word expression classifier ---
_PARTICLES = {
    "up", "down", "out", "in", "on", "off", "away", "back", "over",
    "through", "along", "about", "around", "apart", "together",
    "ahead", "forth", "aside", "behind",
}

_PHRASAL_VERBS = {
    "add", "ask", "back", "blow", "break", "bring", "burn", "call",
    "carry", "catch", "check", "cheer", "clean", "clear", "close",
    "come", "cool", "cross", "cut", "die", "do", "draw", "dress",
    "drop", "eat", "end", "fall", "figure", "fill", "find", "fly",
    "follow", "get", "give", "go", "grow", "hand", "hang", "help",
    "hit", "hold", "hurry", "jump", "keep", "kick", "knock", "lay",
    "leave", "let", "light", "line", "live", "lock", "log", "look",
    "make", "mess", "mix", "move", "open", "opt", "pass", "pay",
    "pick", "play", "point", "pull", "push", "put", "reach", "rip",
    "roll", "rule", "run", "sell", "send", "set", "settle", "show",
    "shut", "sign", "sing", "sit", "slow", "sort", "speak", "speed",
    "split", "stand", "start", "step", "stick", "stop", "sum",
    "switch", "take", "tear", "tell", "think", "throw", "tie", "tip",
    "touch", "trade", "try", "turn", "use", "wait", "wake", "walk",
    "warm", "wash", "watch", "wear", "wind", "wipe", "work", "wrap",
    "write", "act", "calm", "chop", "count", "head", "hear", "iron",
    "mark", "narrow", "phase", "plug", "pop", "print", "ring", "rub", "scale", "shake",
    "shape", "shore", "size", "snap", "spell", "stamp", "stir",
    "sleep", "spend", "stay", "stress", "strip", "stumble", "suck",
    "swear", "teach", "tidy", "tone", "top", "track", "water",
    "weed", "whip", "zero", "zoom", "feel", "miss",
}

_COLLOCATION_VERBS = {
    "go", "take", "make", "get", "give", "have", "do", "be",
    "come", "put", "keep", "let", "set", "run", "pay", "play",
    "enjoy", "bring", "carry", "leave", "lose", "hold",
}

# Words that start 2-word 숙어 (not compound nouns)
_IDIOM_STARTERS = {
    # Prepositions / adverbs / determiners
    "a", "an", "at", "by", "of", "in", "on", "for", "to", "over",
    "from", "so", "no", "as", "or", "all", "each", "per", "off",
    "these", "this", "that", "those", "one", "every", "above",
    "what's", "can't", "won't", "don't", "couldn't", "shouldn't",
    "after", "before", "under", "beyond", "within", "beside",
    "up", "and", "high",
    # Adverbs / adjectives commonly starting idioms
    "right", "far", "well", "ever", "even", "once", "long",
    "millions", "thousands", "hundreds",
}


def classify_expression(english: str) -> str | None:
    """Classify a multi-word expression: 구동사 / 관용구 / 숙어 / None.

    Returns None if uncertain (e.g. possible compound noun like 'home run').
    Only expressions with '~' or matching known verb patterns are classified.
    """
    has_tilde = "~" in english
    words = english.lower().replace("~", "").strip().split()

    if len(words) < 2:
        return "숙어" if has_tilde else None

    # 구동사: [known verb] + [particle] (exactly 2 words)
    if len(words) == 2 and words[0] in _PHRASAL_VERBS and words[1] in _PARTICLES:
        return "구동사"

    # 관용구: starts with common verb + longer phrase (3+ words)
    if len(words) >= 3 and words[0] in _COLLOCATION_VERBS:
        return "관용구"

    # With ~: always an expression → 숙어
    if has_tilde:
        return "숙어"

    # 3+ words without known verb → likely 숙어
    if len(words) >= 3:
        return "숙어"

    # 2 words: check if starts with known idiom pattern or has a known verb
    if words[0] in _IDIOM_STARTERS or words[0] in _PHRASAL_VERBS or words[0] in _COLLOCATION_VERBS:
        return "숙어"

    # 2 words, no pattern match → might be compound noun → skip
    return None


def normalize_lesson(lesson: str) -> str:
    """Normalize lesson name format: 'DAY 01' → 'Day 01'."""
    stripped = lesson.strip()
    if stripped.upper().startswith("DAY"):
        return "Day" + stripped[3:]
    return stripped


def trim_korean(text: str, max_len: int = 25) -> str:
    """Trim long Korean meanings for quiz readability.

    1. Remove secondary POS annotations after ' ; ' (e.g. ' ; 동사:뜻')
    2. If still > max_len, truncate at the last comma before the limit.
    """
    # Step 1: strip secondary POS meanings
    if " ; " in text:
        text = text.split(" ; ")[0].strip()

    if len(text) <= max_len:
        return text

    # Step 2: truncate at last natural break (comma)
    truncated = text[:max_len]
    last_comma = truncated.rfind(",")
    if last_comma > max_len // 2:
        return truncated[:last_comma].rstrip()

    return truncated.rstrip()


def parse_xls() -> list[dict]:
    """Parse wordtest.xls and return list of word dicts."""
    wb = xlrd.open_workbook(str(XLS_PATH), encoding_override="cp949")
    sheet = wb.sheet_by_index(0)

    words = []
    for r in range(sheet.nrows):
        book = str(sheet.cell_value(r, 0)).strip()
        lesson_raw = str(sheet.cell_value(r, 1)).strip() if sheet.ncols > 1 else ""
        english = str(sheet.cell_value(r, 2)).strip()
        korean_raw = str(sheet.cell_value(r, 3)).strip()
        part_of_speech = str(sheet.cell_value(r, 4)).strip() or None if sheet.ncols > 4 else None
        example_en = str(sheet.cell_value(r, 5)).strip() or None if sheet.ncols > 5 else None
        example_ko = str(sheet.cell_value(r, 6)).strip() or None if sheet.ncols > 6 else None

        level = BOOK_LEVEL_MAP.get(book)
        if level is None:
            print(f"  WARNING: Unknown book '{book}' at row {r}, skipping")
            continue

        if not english or not korean_raw:
            continue

        # Auto-classify multi-word expressions if no POS set
        if not part_of_speech and ("~" in english or " " in english):
            part_of_speech = classify_expression(english) or part_of_speech

        words.append({
            "id": str(uuid.uuid4()),
            "english": english,
            "korean": trim_korean(korean_raw),
            "level": level,
            "category": part_of_speech,  # Keep for backward compatibility
            "book_name": book,
            "lesson": normalize_lesson(lesson_raw),
            "part_of_speech": part_of_speech,
            "example_en": example_en,
            "example_ko": example_ko,
        })

    return words


async def load_words():
    """Load words into database."""
    print(f"Reading {XLS_PATH}...")
    words = parse_xls()
    print(f"Parsed {len(words)} words")

    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"statement_cache_size": 0},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    async with session_factory() as session:
        # Check existing count
        result = await session.execute(text("SELECT COUNT(*) FROM words"))
        existing = result.scalar()
        if existing > 0:
            print(f"Words table already has {existing} rows. Clearing...")
            await session.execute(text("DELETE FROM words"))
            await session.commit()

        # Batch insert
        batch_size = 500
        for i in range(0, len(words), batch_size):
            batch = words[i : i + batch_size]
            await session.execute(
                text(
                    "INSERT INTO words (id, english, korean, level, category, book_name, lesson, part_of_speech, example_en, example_ko, created_at) "
                    "VALUES (:id, :english, :korean, :level, :category, :book_name, :lesson, :part_of_speech, :example_en, :example_ko, NOW())"
                ),
                batch,
            )
            await session.commit()
            print(f"  Inserted {min(i + batch_size, len(words))}/{len(words)}")

    # Print stats
    async with session_factory() as session:
        result = await session.execute(
            text("SELECT level, COUNT(*) as cnt FROM words GROUP BY level ORDER BY level")
        )
        rows = result.fetchall()
        print("\n=== Level Stats ===")
        total = 0
        for level, cnt in rows:
            total += cnt
            print(f"  Level {level:2d}: {cnt:5d} words")
        print(f"  {'Total':>8}: {total:5d} words")

    await engine.dispose()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(load_words())
