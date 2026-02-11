"""Reset TEST0213 to pending and clear all learning data."""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

async def main():
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"statement_cache_size": 0})
    S = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with S() as s:
        # Get assignment ID
        r = await s.execute(text("SELECT id FROM test_assignments WHERE test_code = 'TEST0213'"))
        aid = r.scalar()
        if not aid:
            print("[ERROR] TEST0213 not found")
            return

        # Clear learning data
        await s.execute(text(
            "DELETE FROM learning_answers WHERE session_id IN "
            "(SELECT id FROM learning_sessions WHERE assignment_id = :a)"
        ), {"a": aid})
        await s.execute(text("DELETE FROM learning_sessions WHERE assignment_id = :a"), {"a": aid})
        await s.execute(text("DELETE FROM word_mastery WHERE assignment_id = :a"), {"a": aid})

        # Reset status
        await s.execute(text(
            "UPDATE test_assignments SET status = 'pending', completed_at = NULL WHERE test_code = 'TEST0213'"
        ))

        await s.commit()
        print("[OK] TEST0213 reset: status=pending, mastery/session data cleared")
    await engine.dispose()

asyncio.run(main())
