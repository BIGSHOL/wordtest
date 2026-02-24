"""Import 6-area skill content from progress.json into the words table.

Usage:
    python -m scripts.import_skill_areas --dry-run   # preview only
    python -m scripts.import_skill_areas              # actual import
"""
import asyncio
import json
import argparse
from pathlib import Path

from sqlalchemy import select, func, update
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from app.core.config import settings
from app.models.word import Word


DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
PROGRESS_PATH = DATA_DIR / "progress.json"
ALL_WORDS_PATH = DATA_DIR / "all_words.json"


async def main(dry_run: bool = False):
    # Load progress.json
    with open(PROGRESS_PATH, "r", encoding="utf-8") as f:
        progress = json.load(f)
    results = progress.get("results", [])
    print(f"[INFO] Loaded {len(results)} entries from progress.json")

    # Load all_words.json for book_name/lesson mapping
    with open(ALL_WORDS_PATH, "r", encoding="utf-8") as f:
        all_words = json.load(f)
    print(f"[INFO] Loaded {len(all_words)} entries from all_words.json")

    # Build lookup: lowercase english -> list of {book_name, lesson}
    word_lookup: dict[str, list[dict]] = {}
    for entry in all_words:
        key = entry["english"].strip().lower()
        word_lookup.setdefault(key, []).append({
            "book_name": entry["book_name"],
            "lesson": entry["lesson"],
        })

    # Build area data map: (lowercase_english, book_name, lesson) -> area fields
    # progress.json only has word ("w") — match against all_words entries in order
    # Since progress.json follows the same order as all_words.json,
    # we pair them by index
    area_map: dict[tuple[str, str, str], dict] = {}
    for i, result in enumerate(results):
        if i < len(all_words):
            aw = all_words[i]
            key = (aw["english"].strip().lower(), aw["book_name"], aw["lesson"])
            area_map[key] = {
                "area1_meaning": result.get("1"),
                "area2_association": result.get("2"),
                "area3_pronunciation": result.get("3"),
                "area4_inference": result.get("4"),
                "area5_spelling": result.get("5"),
                "area6_context": result.get("6"),
            }

    print(f"[INFO] Built area_map with {len(area_map)} entries")

    updated = 0
    skipped = 0
    not_found = 0

    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"statement_cache_size": 0},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as session:
        # Fetch all words from DB
        stmt = select(
            Word.id,
            func.lower(Word.english).label("english_lower"),
            Word.book_name,
            Word.lesson,
            Word.area1_meaning,
        )
        rows = (await session.execute(stmt)).all()
        print(f"[INFO] Found {len(rows)} words in DB")

        for row in rows:
            key = (row.english_lower.strip(), row.book_name, row.lesson)
            if key not in area_map:
                not_found += 1
                continue

            # Skip if already populated
            if row.area1_meaning is not None:
                skipped += 1
                continue

            areas = area_map[key]
            if dry_run:
                updated += 1
                continue

            await session.execute(
                update(Word)
                .where(Word.id == row.id)
                .values(**areas)
            )
            updated += 1

            if updated % 500 == 0:
                await session.commit()
                print(f"  ... committed {updated} rows")

        if not dry_run:
            await session.commit()

    prefix = "[DRY-RUN] " if dry_run else ""
    print(f"\n{prefix}Results:")
    print(f"  Updated: {updated}")
    print(f"  Skipped (already populated): {skipped}")
    print(f"  Not found in progress.json: {not_found}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing")
    args = parser.parse_args()
    asyncio.run(main(dry_run=args.dry_run))
