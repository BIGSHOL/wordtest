"""Add stage_streak column + update TEST0213 to 100Q with 3 question types."""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


async def main():
    from app.core.config import settings

    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with Session() as s:
        # 1. Add stage_streak column to word_mastery
        col = await s.execute(text(
            "SELECT column_name FROM information_schema.columns "
            "WHERE table_name='word_mastery' AND column_name='stage_streak'"
        ))
        if not col.first():
            await s.execute(text(
                "ALTER TABLE word_mastery ADD COLUMN stage_streak INTEGER NOT NULL DEFAULT 0"
            ))
            print("[OK] stage_streak column added to word_mastery")
        else:
            print("[SKIP] stage_streak column already exists")

        # 2. Update TEST0213 config: 100 questions, 3 types
        r = await s.execute(text(
            "SELECT tc.id FROM test_configs tc "
            "JOIN test_assignments ta ON ta.test_config_id = tc.id "
            "WHERE ta.test_code = :code"
        ), {"code": "TEST0213"})
        row = r.first()
        if row:
            await s.execute(text(
                "UPDATE test_configs SET "
                "question_count = 100, "
                "time_limit_seconds = 1000, "
                "question_types = :qt "
                "WHERE id = :id"
            ), {"qt": "word_meaning,meaning_word,sentence_blank", "id": row[0]})
            print("[OK] TEST0213 updated: 100Q, 10s/Q, 3 question types")
        else:
            print("[ERROR] TEST0213 config not found")

        await s.commit()
        print("[DONE]")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
