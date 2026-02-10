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


def parse_xls() -> list[dict]:
    """Parse wordtest.xls and return list of word dicts."""
    wb = xlrd.open_workbook(str(XLS_PATH), encoding_override="cp949")
    sheet = wb.sheet_by_index(0)

    words = []
    for r in range(sheet.nrows):
        book = str(sheet.cell_value(r, 0)).strip()
        english = str(sheet.cell_value(r, 2)).strip()
        korean = str(sheet.cell_value(r, 3)).strip()
        category = str(sheet.cell_value(r, 4)).strip() or None

        level = BOOK_LEVEL_MAP.get(book)
        if level is None:
            print(f"  WARNING: Unknown book '{book}' at row {r}, skipping")
            continue

        if not english or not korean:
            continue

        words.append({
            "id": str(uuid.uuid4()),
            "english": english,
            "korean": korean,
            "level": level,
            "category": category,
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
                    "INSERT INTO words (id, english, korean, level, category, created_at) "
                    "VALUES (:id, :english, :korean, :level, :category, NOW())"
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
