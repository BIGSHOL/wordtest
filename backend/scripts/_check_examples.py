"""Check example sentence coverage by level."""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

async def main():
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"statement_cache_size": 0})
    Session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as s:
        r = await s.execute(text("""
            SELECT level,
                   COUNT(*) as total,
                   COUNT(example_en) as has_example_en,
                   COUNT(example_ko) as has_example_ko
            FROM words
            GROUP BY level
            ORDER BY level
        """))
        print(f"{'Level':>5} | {'Total':>6} | {'예문EN':>7} | {'예문KO':>7} | {'커버율':>6}")
        print("-" * 50)
        for row in r.all():
            pct = (row.has_example_en / row.total * 100) if row.total else 0
            print(f"{row.level:>5} | {row.total:>6} | {row.has_example_en:>7} | {row.has_example_ko:>7} | {pct:>5.1f}%")
    await engine.dispose()

asyncio.run(main())
