"""Add current_level column to learning_sessions table."""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


async def main():
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"statement_cache_size": 0})
    S = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with S() as s:
        # Check if column already exists
        r = await s.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name='learning_sessions' AND column_name='current_level'
        """))
        if r.scalar():
            print("[SKIP] current_level column already exists")
        else:
            await s.execute(text(
                "ALTER TABLE learning_sessions ADD COLUMN current_level INTEGER NOT NULL DEFAULT 1"
            ))
            print("[OK] current_level column added to learning_sessions")

        await s.commit()
    await engine.dispose()


asyncio.run(main())
