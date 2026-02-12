"""One-time DB cleanup: normalize lesson names and trim long Korean meanings.

- DAY XX / day XX → Day XX
- Lesson XX stays as-is
- Korean meanings: split on ' ; ', truncate at 25 chars at natural comma break

Usage:
    cd backend
    python scripts/normalize_words.py
"""
import asyncio
import sys
from pathlib import Path

# Add backend/ to sys.path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.utils.load_words import normalize_lesson, trim_korean


async def main():
    engine = create_async_engine(
        settings.DATABASE_URL,
        connect_args={"statement_cache_size": 0},
    )
    session_factory = async_sessionmaker(engine, class_=AsyncSession)

    async with session_factory() as session:
        # ── Before stats ──
        print("=== BEFORE ===")
        result = await session.execute(text(
            "SELECT lesson, COUNT(*) as cnt FROM words "
            "GROUP BY lesson ORDER BY lesson LIMIT 20"
        ))
        rows = result.fetchall()
        day_upper = sum(cnt for lesson, cnt in rows if lesson.startswith("DAY"))
        day_title = sum(cnt for lesson, cnt in rows if lesson.startswith("Day"))
        lesson_fmt = sum(cnt for lesson, cnt in rows if lesson.startswith("Lesson"))
        print(f"  DAY xx : {day_upper} words")
        print(f"  Day xx : {day_title} words")
        print(f"  Lesson : {lesson_fmt} words")

        result = await session.execute(text(
            "SELECT COUNT(*) FROM words WHERE LENGTH(korean) > 25"
        ))
        long_kr = result.scalar()
        print(f"  Korean > 25 chars: {long_kr} words")

        result = await session.execute(text(
            "SELECT COUNT(*) FROM words WHERE korean LIKE '%% ; %%'"
        ))
        semicolon_kr = result.scalar()
        print(f"  Korean with ' ; ': {semicolon_kr} words")

        # ── 1. Normalize lesson names (pure SQL, fast) ──
        print("\n--- Normalizing lesson names ---")
        res = await session.execute(text(
            "UPDATE words SET lesson = 'Day' || SUBSTRING(lesson FROM 4) "
            "WHERE lesson LIKE 'DAY%%'"
        ))
        print(f"  Updated {res.rowcount} rows (DAY → Day)")
        await session.commit()

        # ── 2. Trim Korean meanings (need Python logic) ──
        print("\n--- Trimming Korean meanings ---")
        result = await session.execute(text(
            "SELECT id, korean FROM words "
            "WHERE LENGTH(korean) > 25 OR korean LIKE '%% ; %%'"
        ))
        candidates = result.fetchall()
        print(f"  Found {len(candidates)} candidates to trim")

        updated = 0
        batch = []
        for word_id, korean in candidates:
            new_korean = trim_korean(korean)
            if new_korean != korean:
                batch.append({"wid": word_id, "new_kr": new_korean})
                updated += 1

            if len(batch) >= 500:
                await session.execute(
                    text("UPDATE words SET korean = :new_kr WHERE id = :wid"),
                    batch,
                )
                await session.commit()
                batch = []

        if batch:
            await session.execute(
                text("UPDATE words SET korean = :new_kr WHERE id = :wid"),
                batch,
            )
            await session.commit()

        print(f"  Updated {updated} Korean meanings")

        # ── After stats ──
        print("\n=== AFTER ===")
        result = await session.execute(text(
            "SELECT "
            "  SUM(CASE WHEN lesson LIKE 'DAY%%' THEN 1 ELSE 0 END) as day_upper, "
            "  SUM(CASE WHEN lesson LIKE 'Day%%' THEN 1 ELSE 0 END) as day_title, "
            "  SUM(CASE WHEN lesson LIKE 'Lesson%%' THEN 1 ELSE 0 END) as lesson_fmt "
            "FROM words"
        ))
        row = result.fetchone()
        print(f"  DAY xx : {row[0]} words")
        print(f"  Day xx : {row[1]} words")
        print(f"  Lesson : {row[2]} words")

        result = await session.execute(text(
            "SELECT COUNT(*) FROM words WHERE LENGTH(korean) > 25"
        ))
        print(f"  Korean > 25 chars: {result.scalar()} words")

        result = await session.execute(text(
            "SELECT COUNT(*) FROM words WHERE korean LIKE '%% ; %%'"
        ))
        print(f"  Korean with ' ; ': {result.scalar()} words")

    await engine.dispose()
    print("\nDone!")


if __name__ == "__main__":
    asyncio.run(main())
