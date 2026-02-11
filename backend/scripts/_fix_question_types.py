"""Fix question_types: change 'listening' to 'sentence_blank' for all configs."""
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
        # Find configs with 'listening' in question_types
        r = await s.execute(text(
            "SELECT id, question_types FROM test_configs WHERE question_types LIKE '%listening%'"
        ))
        rows = r.fetchall()
        if not rows:
            print("[SKIP] No configs with 'listening' found")
        else:
            for row in rows:
                old_qt = row[1]
                new_qt = old_qt.replace("listening", "sentence_blank")
                await s.execute(text(
                    "UPDATE test_configs SET question_types = :qt WHERE id = :id"
                ), {"qt": new_qt, "id": row[0]})
                print(f"[OK] {row[0]}: '{old_qt}' -> '{new_qt}'")

        await s.commit()
        print("[DONE]")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
