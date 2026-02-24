"""Export words from DB as JSON.

Usage:
    python -m scripts.export_words [--book BOOK_NAME] [--output FILE]

Exports words grouped by book/lesson into JSON format.
For automated example generation, use generate_examples.py instead.
"""
import asyncio
import json
import sys
from pathlib import Path

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.core.config import settings
from app.models.word import Word


async def export_words(book_name: str | None = None, output_path: str | None = None):
    engine = create_async_engine(settings.DATABASE_URL)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with session_factory() as db:
        query = select(Word).where(Word.is_excluded == False)
        if book_name:
            query = query.where(Word.book_name == book_name)
        query = query.order_by(Word.book_name, Word.lesson, Word.english)

        result = await db.execute(query)
        words = result.scalars().all()

    await engine.dispose()

    if not words:
        print("No words found.")
        return

    # Group by book/lesson
    grouped: dict[str, dict[str, list[dict]]] = {}
    for w in words:
        bk = w.book_name or "(no book)"
        ls = w.lesson or "(no lesson)"
        grouped.setdefault(bk, {}).setdefault(ls, []).append({
            "english": w.english,
            "korean": w.korean,
            "level": w.level,
            "example_en": w.example_en or "",
            "example_ko": w.example_ko or "",
        })

    export_data = {
        "total_words": len(words),
        "books": {
            bk: {
                "lessons": {
                    ls: ws for ls, ws in lessons.items()
                }
            }
            for bk, lessons in grouped.items()
        },
    }

    out_file = output_path or "exported_words.json"
    Path(out_file).write_text(json.dumps(export_data, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Exported {len(words)} words to {out_file}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Export words for AI example generation")
    parser.add_argument("--book", type=str, default=None, help="Filter by book name")
    parser.add_argument("--output", type=str, default=None, help="Output JSON file path")
    args = parser.parse_args()

    asyncio.run(export_words(args.book, args.output))
