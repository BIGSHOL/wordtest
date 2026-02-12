"""Add engine_type column to test_assignments and backfill existing rows.

Usage:
    cd backend
    python scripts/migrate_engine_type.py
"""
import asyncio
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def main():
    print("\n[MIGRATE] engine_type column for test_assignments")
    print("=" * 50)

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Connected\n")

        # 1. Add engine_type column if missing
        col_check = await session.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'test_assignments' AND column_name = 'engine_type'
        """))
        if not col_check.first():
            print("[MIGRATE] Adding engine_type column...")
            await session.execute(text("""
                ALTER TABLE test_assignments
                ADD COLUMN engine_type VARCHAR(20) DEFAULT NULL
            """))
            await session.commit()
            print("[OK] engine_type column added\n")
        else:
            print("[SKIP] engine_type column already exists\n")

        # 2. Backfill existing rows based on current assignment_type + test_type
        print("[MIGRATE] Backfilling engine_type for existing assignments...")

        # mastery assignments with placement config -> xp_stage
        updated = await session.execute(text("""
            UPDATE test_assignments ta
            SET engine_type = 'xp_stage'
            FROM test_configs tc
            WHERE ta.test_config_id = tc.id
              AND ta.assignment_type = 'mastery'
              AND tc.test_type = 'placement'
              AND ta.engine_type IS NULL
        """))
        print(f"  xp_stage (mastery+placement): {updated.rowcount} rows")

        # mastery assignments with periodic config -> xp_stage (mastery periodic = stage with XP)
        updated = await session.execute(text("""
            UPDATE test_assignments ta
            SET engine_type = 'xp_stage'
            FROM test_configs tc
            WHERE ta.test_config_id = tc.id
              AND ta.assignment_type = 'mastery'
              AND tc.test_type = 'periodic'
              AND ta.engine_type IS NULL
        """))
        print(f"  xp_stage (mastery+periodic): {updated.rowcount} rows")

        # stage_test assignments -> legacy_stage
        updated = await session.execute(text("""
            UPDATE test_assignments
            SET engine_type = 'legacy_stage'
            WHERE assignment_type = 'stage_test'
              AND engine_type IS NULL
        """))
        print(f"  legacy_stage: {updated.rowcount} rows")

        # legacy assignments -> legacy_word
        updated = await session.execute(text("""
            UPDATE test_assignments
            SET engine_type = 'legacy_word'
            WHERE assignment_type = 'legacy'
              AND engine_type IS NULL
        """))
        print(f"  legacy_word: {updated.rowcount} rows")

        # Catch-all: remaining NULL -> xp_stage (safe default)
        updated = await session.execute(text("""
            UPDATE test_assignments
            SET engine_type = 'xp_stage'
            WHERE engine_type IS NULL
        """))
        if updated.rowcount > 0:
            print(f"  xp_stage (fallback): {updated.rowcount} rows")

        await session.commit()

        # 3. Summary
        result = await session.execute(text("""
            SELECT engine_type, COUNT(*) as cnt
            FROM test_assignments
            GROUP BY engine_type
            ORDER BY engine_type
        """))
        print(f"\n{'=' * 50}")
        print("  engine_type distribution:")
        for row in result.fetchall():
            print(f"    {row.engine_type}: {row.cnt}")
        print(f"{'=' * 50}")
        print("[DONE] Migration complete!")


if __name__ == "__main__":
    asyncio.run(main())
