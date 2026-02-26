"""Audit word-engine compatibility and update compatible_engines column.

Usage:
    cd backend
    python -m scripts.audit_word_engines
"""
import asyncio
import sys
import os
from collections import defaultdict

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.models.word import Word
from app.services.question_engines import ENGINES, compute_compatible_engines


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def main():
    factory = get_session_factory()
    async with factory() as db:
        from sqlalchemy.orm import selectinload
        result = await db.execute(
            select(Word).where(Word.is_excluded == False).options(selectinload(Word.examples))
        )
        words = result.scalars().all()

        total = len(words)
        engine_names = list(ENGINES.keys())
        counts: dict[str, int] = {name: 0 for name in engine_names}
        book_counts: dict[str, dict[str, int]] = defaultdict(lambda: {name: 0 for name in engine_names})
        level_counts: dict[int, dict[str, int]] = defaultdict(lambda: {name: 0 for name in engine_names})
        problem_words: list[Word] = []
        updated = 0

        for w in words:
            engines = compute_compatible_engines(w)
            new_value = ",".join(engines)
            if w.compatible_engines != new_value:
                w.compatible_engines = new_value
                updated += 1

            for name in engines:
                counts[name] += 1
                if w.book_name:
                    book_counts[w.book_name][name] += 1
                level_counts[w.level][name] += 1

            if len(engines) <= 2:
                problem_words.append(w)

        await db.commit()

        # ── Report ───────────────────────────────────────────────────────
        print(f"\n{'='*70}")
        print(f"  Word-Engine Compatibility Audit Report")
        print(f"{'='*70}")
        print(f"  Total words: {total}  |  Updated: {updated}")
        print()

        # Engine coverage summary
        print(f"  {'Engine':<15} {'Count':>6} {'Coverage':>8}")
        print(f"  {'-'*15} {'-'*6} {'-'*8}")
        for name in engine_names:
            pct = counts[name] / total * 100 if total else 0
            print(f"  {name:<15} {counts[name]:>6} {pct:>7.1f}%")

        # Per-level summary
        print(f"\n  Per-level coverage:")
        print(f"  {'Level':<6} {'Words':>6}", end="")
        for name in engine_names:
            print(f" {name[:6]:>7}", end="")
        print()
        print(f"  {'-'*6} {'-'*6}", end="")
        for _ in engine_names:
            print(f" {'-'*7}", end="")
        print()

        for level in sorted(level_counts.keys()):
            level_total = sum(1 for w in words if w.level == level)
            print(f"  {level:<6} {level_total:>6}", end="")
            for name in engine_names:
                c = level_counts[level][name]
                pct = c / level_total * 100 if level_total else 0
                print(f" {pct:>6.0f}%", end="")
            print()

        # Per-book summary
        if book_counts:
            print(f"\n  Per-book coverage:")
            for book in sorted(book_counts.keys()):
                book_total = sum(1 for w in words if w.book_name == book)
                print(f"\n  [{book}] ({book_total} words)")
                for name in engine_names:
                    c = book_counts[book][name]
                    pct = c / book_total * 100 if book_total else 0
                    if pct < 100:
                        print(f"    {name:<15} {c:>5}/{book_total:<5} ({pct:.1f}%)")

        # Problem words
        if problem_words:
            print(f"\n  Problem words (<=2 engines): {len(problem_words)}")
            print(f"  {'English':<20} {'Korean':<20} {'Engines'}")
            print(f"  {'-'*20} {'-'*20} {'-'*30}")
            for w in problem_words[:50]:
                engines = w.compatible_engines or ""
                print(f"  {w.english:<20} {w.korean:<20} {engines}")
            if len(problem_words) > 50:
                print(f"  ... and {len(problem_words) - 50} more")
        else:
            print(f"\n  No problem words found (all words have 3+ compatible engines).")

        print(f"\n{'='*70}")


if __name__ == "__main__":
    asyncio.run(main())
