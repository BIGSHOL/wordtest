"""Update TEST0213 config to cover all textbook levels (1-15) and reset learning data."""
import asyncio, sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


async def main():
    from app.core.config import settings
    engine = create_async_engine(settings.DATABASE_URL, echo=False, connect_args={"statement_cache_size": 0})
    S = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with S() as s:
        # 1. Find TEST0213 assignment and its config
        r = await s.execute(text("""
            SELECT ta.id as aid, ta.test_config_id as cid, tc.name, tc.book_name,
                   tc.level_range_min, tc.level_range_max, tc.lesson_range_start, tc.lesson_range_end
            FROM test_assignments ta
            JOIN test_configs tc ON ta.test_config_id = tc.id
            WHERE ta.test_code = 'TEST0213'
        """))
        row = r.first()
        if not row:
            print("[ERROR] TEST0213 not found")
            return

        aid, cid = row.aid, row.cid
        print(f"[INFO] Assignment: {aid}")
        print(f"[INFO] Config: {cid} ({row.name})")
        print(f"[INFO] Current: book={row.book_name}, level={row.level_range_min}-{row.level_range_max}, lessons={row.lesson_range_start}-{row.lesson_range_end}")

        # 2. Update config to all levels, no book filter, no lesson filter
        await s.execute(text("""
            UPDATE test_configs SET
                book_name = NULL,
                level_range_min = 1,
                level_range_max = 15,
                lesson_range_start = NULL,
                lesson_range_end = NULL,
                name = '전체 교재 마스터리 테스트'
            WHERE id = :cid
        """), {"cid": cid})
        print("[OK] Config updated: level 1-15, all books/lessons")

        # 3. Clear learning data
        await s.execute(text(
            "DELETE FROM learning_answers WHERE session_id IN "
            "(SELECT id FROM learning_sessions WHERE assignment_id = :a)"
        ), {"a": aid})
        await s.execute(text("DELETE FROM learning_sessions WHERE assignment_id = :a"), {"a": aid})
        await s.execute(text("DELETE FROM word_mastery WHERE assignment_id = :a"), {"a": aid})

        # 4. Reset assignment status
        await s.execute(text(
            "UPDATE test_assignments SET status = 'pending', completed_at = NULL WHERE id = :a"
        ), {"a": aid})

        # 5. Check total words available
        r2 = await s.execute(text("SELECT COUNT(*) FROM words WHERE level BETWEEN 1 AND 15"))
        total = r2.scalar()
        print(f"[OK] Reset complete. Total words available: {total}")

        # 6. Show distribution by level
        r3 = await s.execute(text("""
            SELECT level, COUNT(*) as cnt FROM words
            WHERE level BETWEEN 1 AND 15
            GROUP BY level ORDER BY level
        """))
        print("\n[Level distribution]")
        for lv_row in r3:
            print(f"  Level {lv_row.level:2d}: {lv_row.cnt:4d} words")

        await s.commit()
        print("\n[DONE] TEST0213 now covers all levels (1-15)")

    await engine.dispose()


asyncio.run(main())
