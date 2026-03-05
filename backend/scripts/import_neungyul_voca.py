"""Import 능률 VOCA PDFs into the words table.

Supports 4 separate books:
  - 능률 VOCA 중등 기본
  - 능률 VOCA 중등 기본 파생어
  - 능률 VOCA 중등 고난도
  - 능률 VOCA 중등 고난도 파생어

Usage:
    cd backend
    python -m scripts.import_neungyul_voca [--dry-run] [--book BOOK_FILTER]

Options:
    --dry-run          Parse only, do not insert into DB
    --book FILTER      Import only matching book (e.g., "기본", "고난도 파생어")
"""
import asyncio
import re
import sys
import uuid
from pathlib import Path

import fitz  # PyMuPDF

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.word import Word

# ── POS mapping: Korean single-char → English abbreviation ──
POS_MAP = {
    "\ud615": "형용사",   # 형 → adj
    "\ub3d9": "동사",     # 동 → verb
    "\uba85": "명사",     # 명 → noun
    "\ubd80": "부사",     # 부 → adv
    "\uc804": "전치사",   # 전 → prep
    "\ub300": "대명사",   # 대 → pron
    "\uc811": "접속사",   # 접 → conj
    "\uac10": "감탄사",   # 감 → interj
}

# ── Book configurations ──
BOOKS = [
    {
        "book_name": "능률 VOCA 중등 기본",
        "pdfs": [
            "data/능률VOCA 중등기본_DAY 01-25_어휘리스트(0).pdf",
            "data/능률VOCA 중등기본_DAY 26-50_어휘리스트.pdf",
        ],
        "is_derivative": False,
    },
    {
        "book_name": "능률 VOCA 중등 기본 파생어",
        "pdfs": [
            "data/능률VOCA 중등 기본_어휘리스트_표제어+파생어_DAY 01-25.pdf",
            "data/능률VOCA 중등 기본_어휘리스트_표제어+파생어_DAY 25-50.pdf",
        ],
        "is_derivative": True,
    },
    {
        "book_name": "능률 VOCA 중등 고난도",
        "pdfs": [
            "data/능률VOCA 중등고난도_DAY 01-20_어휘리스트.pdf",
            "data/능률VOCA 중등고난도_DAY 21-40_어휘리스트.pdf",
        ],
        "is_derivative": False,
    },
    {
        "book_name": "능률 VOCA 중등 고난도 파생어",
        "pdfs": [
            "data/능률VOCA 중등 고난도_어휘리스트_표제어+파생어_DAY 01-20.pdf",
            "data/능률VOCA 중등 고난도_어휘리스트_표제어+파생어_DAY 21-40.pdf",
        ],
        "is_derivative": True,
    },
]

# Level mapping: 기본 → lower levels, 고난도 → higher levels
LEVEL_MAP = {
    "능률 VOCA 중등 기본": 3,
    "능률 VOCA 중등 기본 파생어": 3,
    "능률 VOCA 중등 고난도": 5,
    "능률 VOCA 중등 고난도 파생어": 5,
}


def parse_pdf(pdf_path: str) -> list[dict]:
    """Parse a single PDF and extract word entries.

    Returns list of dicts: {day, number, english, pos, korean}
    """
    doc = fitz.open(pdf_path)
    all_text = ""
    for page in doc:
        all_text += page.get_text() + "\n"
    doc.close()

    # Split by DAY markers
    parts = re.split(r"DAY\s*(\d+)", all_text)
    entries = []

    for i in range(1, len(parts) - 1, 2):
        day_num = int(parts[i])
        content = parts[i + 1]
        lines = [l.strip() for l in content.split("\n")]

        # Parse: number, english, pos, korean pattern
        j = 0
        # Skip header lines (Class, Name, Date, 단어, 품사, 뜻)
        while j < len(lines):
            if re.match(r"^\d+$", lines[j]):
                break
            j += 1

        while j < len(lines):
            line = lines[j]

            # Expect a number
            if not re.match(r"^\d+$", line):
                j += 1
                continue

            number = int(line)
            j += 1
            if j >= len(lines):
                break

            # Next: english word/phrase
            english = lines[j].strip()
            j += 1
            if j >= len(lines):
                break

            # Next: POS (single Korean char) or empty (for phrases)
            pos_line = lines[j].strip()
            pos = None
            if len(pos_line) == 1 and pos_line in POS_MAP:
                pos = POS_MAP[pos_line]
                j += 1
                if j >= len(lines):
                    break
                korean = lines[j].strip()
            else:
                # Multi-word expression: no POS, next line is Korean meaning
                korean = pos_line if pos_line else (lines[j + 1].strip() if j + 1 < len(lines) else "")
                if not pos_line:
                    j += 1
                    if j >= len(lines):
                        break
                    korean = lines[j].strip()

            j += 1

            if english and korean:
                entries.append({
                    "day": day_num,
                    "number": number,
                    "english": english,
                    "pos": pos,
                    "korean": korean,
                })

    return entries


def merge_same_word_entries(entries: list[dict]) -> list[dict]:
    """Merge entries with same (day, english) but different POS/meanings.

    Example: nearby(형/부각각), overseas(부/형 각각) → 하나로 합침
    """
    merged = []
    seen = {}  # key: (day, english, number_group) → index in merged

    for e in entries:
        key = (e["day"], e["english"].lower())
        if key in seen:
            idx = seen[key]
            existing = merged[idx]
            # Merge Korean meanings
            if e["korean"] not in existing["korean"]:
                existing["korean"] += ", " + e["korean"]
            # Merge POS
            if e["pos"] and existing["pos"] and e["pos"] != existing["pos"]:
                if e["pos"] not in existing["pos"]:
                    existing["pos"] += "/" + e["pos"]
            elif e["pos"] and not existing["pos"]:
                existing["pos"] = e["pos"]
        else:
            seen[key] = len(merged)
            merged.append(dict(e))

    return merged


def entries_to_words(entries: list[dict], book_name: str) -> list[dict]:
    """Convert parsed entries to Word-compatible dicts."""
    level = LEVEL_MAP.get(book_name, 3)
    words = []

    for e in entries:
        lesson = f"Day {e['day']:02d}"
        words.append({
            "id": str(uuid.uuid4()),
            "english": e["english"],
            "korean": e["korean"],
            "level": level,
            "book_name": book_name,
            "lesson": lesson,
            "part_of_speech": e["pos"],
            "category": None,
            "example_en": None,
            "example_ko": None,
            "is_excluded": False,
            "compatible_engines": None,
            "antonym": None,
        })

    return words


async def import_book(book_cfg: dict, session_factory, dry_run: bool = False):
    """Import a single book configuration."""
    book_name = book_cfg["book_name"]
    print(f"\n{'='*60}")
    print(f"  Book: {book_name}")
    print(f"{'='*60}")

    # Parse all PDFs for this book
    all_entries = []
    root = Path(__file__).resolve().parent.parent.parent

    for pdf_rel in book_cfg["pdfs"]:
        pdf_path = str(root / pdf_rel)
        print(f"  Parsing: {Path(pdf_rel).name}")
        entries = parse_pdf(pdf_path)
        print(f"    → {len(entries)} raw entries")
        all_entries.extend(entries)

    # Merge duplicate entries (same word different POS in same DAY)
    merged = merge_same_word_entries(all_entries)
    print(f"  After merge: {merged[-1]['day'] if merged else 0} DAYs, {len(merged)} unique words")

    # Show per-DAY counts
    day_counts = {}
    for e in merged:
        day_counts[e["day"]] = day_counts.get(e["day"], 0) + 1
    for day in sorted(day_counts):
        print(f"    Day {day:02d}: {day_counts[day]} words")

    if dry_run:
        print("  [DRY RUN] Skipping DB insert.")
        return len(merged)

    # Convert to word dicts
    words = entries_to_words(merged, book_name)

    async with session_factory() as db:
        # Check if book already exists
        result = await db.execute(
            select(Word).where(Word.book_name == book_name).limit(1)
        )
        existing = result.scalar_one_or_none()
        if existing:
            # Count existing
            count_result = await db.execute(
                text("SELECT COUNT(*) FROM words WHERE book_name = :bn"),
                {"bn": book_name},
            )
            count = count_result.scalar()
            print(f"  [SKIP] Book '{book_name}' already has {count} words.")
            return 0

        # Batch insert
        for w in words:
            db.add(Word(**w))
        await db.commit()
        print(f"  [OK] Inserted {len(words)} words into '{book_name}'")

    return len(words)


async def main():
    dry_run = "--dry-run" in sys.argv
    book_filter = None
    if "--book" in sys.argv:
        idx = sys.argv.index("--book")
        if idx + 1 < len(sys.argv):
            book_filter = sys.argv[idx + 1]

    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"statement_cache_size": 0},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    total = 0
    for book_cfg in BOOKS:
        if book_filter and book_filter not in book_cfg["book_name"]:
            continue
        count = await import_book(book_cfg, session_factory, dry_run=dry_run)
        total += count

    await engine.dispose()
    print(f"\n{'='*60}")
    print(f"  TOTAL: {total} words {'parsed' if dry_run else 'imported'}")
    print(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
