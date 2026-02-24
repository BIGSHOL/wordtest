"""Import AI-generated example sentences into word_examples table.

Usage:
    python -m scripts.import_examples <json_file> [--dry-run]

Expected JSON format:
[
  {
    "english": "apple",
    "book_name": "POWER VOCA 5000-01",   (optional, for disambiguation)
    "lesson": "Lesson 1",                 (optional, for disambiguation)
    "examples": [
      {"example_en": "I ate an apple.", "example_ko": "나는 사과를 먹었다."},
      {"example_en": "The apple is red.", "example_ko": "그 사과는 빨갛다."}
    ]
  }
]

Each example gets order_index 1, 2 (0 is reserved for the original example_en/ko).
Duplicates are skipped based on (word_id, example_en) uniqueness.
"""
import asyncio
import json
import sys
import uuid
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.word import Word
from app.models.word_example import WordExample


async def import_examples(json_path: str, dry_run: bool = False):
    data = json.loads(Path(json_path).read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("Error: JSON root must be an array")
        return

    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    stats = {"matched": 0, "skipped_no_match": 0, "added": 0, "skipped_dup": 0}

    async with session_factory() as db:
        # Pre-load all words for matching
        result = await db.execute(select(Word))
        all_words = result.scalars().all()

        # Build lookup: (english_lower, book_name, lesson) -> Word
        word_lookup: dict[tuple[str, str, str], Word] = {}
        word_lookup_en_only: dict[str, list[Word]] = {}
        for w in all_words:
            key = (w.english.lower(), w.book_name or "", w.lesson or "")
            word_lookup[key] = w
            word_lookup_en_only.setdefault(w.english.lower(), []).append(w)

        # Pre-load existing examples for duplicate check
        existing_result = await db.execute(select(WordExample))
        existing_examples = existing_result.scalars().all()
        existing_set: set[tuple[str, str]] = {
            (ex.word_id, ex.example_en) for ex in existing_examples
        }

        for entry in data:
            english = entry.get("english", "").strip()
            if not english:
                continue

            book = entry.get("book_name", "")
            lesson = entry.get("lesson", "")
            examples = entry.get("examples", [])

            # Try exact match first
            word = word_lookup.get((english.lower(), book, lesson))
            if not word:
                # Fallback to english-only match (first found)
                candidates = word_lookup_en_only.get(english.lower(), [])
                if len(candidates) == 1:
                    word = candidates[0]
                elif len(candidates) > 1 and book:
                    # Try matching just book
                    for c in candidates:
                        if c.book_name == book:
                            word = c
                            break

            if not word:
                stats["skipped_no_match"] += 1
                print(f"  SKIP (no match): {english} / {book} / {lesson}")
                continue

            stats["matched"] += 1

            # Find current max order_index for this word
            max_idx_result = await db.execute(
                select(WordExample.order_index)
                .where(WordExample.word_id == word.id)
                .order_by(WordExample.order_index.desc())
                .limit(1)
            )
            max_idx_row = max_idx_result.scalar_one_or_none()
            next_idx = (max_idx_row or 0) + 1

            for ex in examples:
                ex_en = ex.get("example_en", "").strip()
                ex_ko = ex.get("example_ko", "").strip()
                if not ex_en or not ex_ko:
                    continue

                # Duplicate check
                if (word.id, ex_en) in existing_set:
                    stats["skipped_dup"] += 1
                    continue

                if not dry_run:
                    new_example = WordExample(
                        id=str(uuid.uuid4()),
                        word_id=word.id,
                        example_en=ex_en,
                        example_ko=ex_ko,
                        order_index=next_idx,
                    )
                    db.add(new_example)
                    existing_set.add((word.id, ex_en))

                stats["added"] += 1
                next_idx += 1

        if not dry_run:
            await db.commit()
            print("Changes committed.")
        else:
            print("DRY RUN - no changes made.")

    await engine.dispose()

    print(f"\nResults:")
    print(f"  Words matched: {stats['matched']}")
    print(f"  Words not found: {stats['skipped_no_match']}")
    print(f"  Examples added: {stats['added']}")
    print(f"  Duplicates skipped: {stats['skipped_dup']}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Import AI-generated example sentences")
    parser.add_argument("json_file", help="Path to JSON file with examples")
    parser.add_argument("--dry-run", action="store_true", help="Preview without making changes")
    args = parser.parse_args()

    asyncio.run(import_examples(args.json_file, args.dry_run))
