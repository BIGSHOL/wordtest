"""Reset ALL test assignments and create 4 core engine test codes.

Deletes: learning_answers → learning_sessions → word_mastery → test_assignments → test_configs
Creates:
  TEST0210: xp_stage    (XP + 5-stage, Lv1-15, 100Q, 10s)
  TEST0211: legacy_word (Legacy + 4-choice, Lv8, 100Q, 10s)
  TEST0212: legacy_stage(Legacy + 5-stage, Lv8, 100Q, 10s)
  TEST0213: xp_word     (XP + Word-only, Lv1-15, 100Q, 10s)

Usage:
    cd backend
    python scripts/reset_and_seed_engines.py
"""
import asyncio
import uuid
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


# 4 core engine test configs
ENGINES = [
    {
        "code": "TEST0210",
        "engine_type": "xp_stage",
        "assignment_type": "mastery",
        "name": "XP 스테이지 (Lv1-15, 100Q, 10s)",
        "test_type": "placement",
        "question_count": 100,
        "per_q_time": 10,
        "lv_min": 1,
        "lv_max": 15,
        "book_name": None,
        "lesson_start": None,
        "lesson_end": None,
    },
    {
        "code": "TEST0211",
        "engine_type": "legacy_word",
        "assignment_type": "legacy",
        "name": "레거시 워드 (Lv8, 100Q, 10s)",
        "test_type": "placement",
        "question_count": 100,
        "per_q_time": 10,
        "lv_min": 8,
        "lv_max": 8,
        "book_name": "Power Voca 5000-08",
        "lesson_start": None,
        "lesson_end": None,
    },
    {
        "code": "TEST0212",
        "engine_type": "legacy_stage",
        "assignment_type": "stage_test",
        "name": "레거시 스테이지 (Lv8, 100Q, 10s)",
        "test_type": "periodic",
        "question_count": 100,
        "per_q_time": 10,
        "lv_min": 8,
        "lv_max": 8,
        "book_name": "Power Voca 5000-08",
        "lesson_start": None,
        "lesson_end": None,
    },
    {
        "code": "TEST0213",
        "engine_type": "xp_word",
        "assignment_type": "mastery",
        "name": "XP 워드 (Lv1-15, 100Q, 10s)",
        "test_type": "placement",
        "question_count": 100,
        "per_q_time": 10,
        "lv_min": 1,
        "lv_max": 15,
        "book_name": None,
        "lesson_start": None,
        "lesson_end": None,
    },
]


async def main():
    print("\n[RESET] Delete all test assignments + Create 4 engine test codes")
    print("=" * 60)

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Connected\n")

        # --- Phase 1: Delete everything ---
        print("Phase 1: Delete all test data")

        # Get all assignment IDs
        assign_rows = await session.execute(
            text("SELECT id FROM test_assignments")
        )
        assign_ids = [r.id for r in assign_rows.fetchall()]
        print(f"  Found {len(assign_ids)} assignments to delete")

        if assign_ids:
            # Get all session IDs
            sess_rows = await session.execute(
                text("SELECT id FROM learning_sessions WHERE assignment_id = ANY(:ids)"),
                {"ids": assign_ids},
            )
            sess_ids = [r.id for r in sess_rows.fetchall()]

            # Delete learning_answers
            if sess_ids:
                result = await session.execute(
                    text("DELETE FROM learning_answers WHERE session_id = ANY(:ids)"),
                    {"ids": sess_ids},
                )
                print(f"  Deleted {result.rowcount} learning_answers")

            # Delete learning_sessions
            result = await session.execute(
                text("DELETE FROM learning_sessions WHERE assignment_id = ANY(:ids)"),
                {"ids": assign_ids},
            )
            print(f"  Deleted {result.rowcount} learning_sessions")

            # Delete word_mastery
            result = await session.execute(
                text("DELETE FROM word_mastery WHERE assignment_id = ANY(:ids)"),
                {"ids": assign_ids},
            )
            print(f"  Deleted {result.rowcount} word_mastery records")

            # Get config IDs before deleting assignments
            config_rows = await session.execute(
                text("SELECT DISTINCT test_config_id FROM test_assignments")
            )
            config_ids = [r.test_config_id for r in config_rows.fetchall()]

            # Delete test_assignments
            result = await session.execute(text("DELETE FROM test_assignments"))
            print(f"  Deleted {result.rowcount} test_assignments")

            # Delete test_configs (only orphaned ones)
            if config_ids:
                result = await session.execute(
                    text("DELETE FROM test_configs WHERE id = ANY(:ids)"),
                    {"ids": config_ids},
                )
                print(f"  Deleted {result.rowcount} test_configs")

            # Also delete test_sessions (legacy)
            result = await session.execute(text("DELETE FROM test_sessions"))
            print(f"  Deleted {result.rowcount} test_sessions (legacy)")

        await session.commit()
        print("  [OK] All test data deleted\n")

        # --- Phase 2: Get teacher + student ---
        print("Phase 2: Create 4 engine test codes")

        teacher_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'teacher' LIMIT 1")
        )
        teacher = teacher_row.first()
        if not teacher:
            print("[ERROR] No teacher found")
            sys.exit(1)
        print(f"  Teacher: {teacher.name} ({teacher.username})")

        student_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'student' LIMIT 1")
        )
        student = student_row.first()
        if not student:
            print("[ERROR] No student found")
            sys.exit(1)
        print(f"  Student: {student.name} ({student.username})\n")

        # --- Phase 3: Create 4 test codes ---
        for cfg in ENGINES:
            config_id = str(uuid.uuid4())
            await session.execute(
                text("""
                    INSERT INTO test_configs (
                        id, teacher_id, name, test_type, question_count,
                        time_limit_seconds, is_active, level_range_min, level_range_max,
                        per_question_time_seconds, question_types,
                        book_name, lesson_range_start, lesson_range_end,
                        created_at, updated_at
                    ) VALUES (
                        :id, :teacher_id, :name, :test_type, :question_count,
                        :time_limit, :is_active, :lv_min, :lv_max,
                        :per_q_time, :q_types,
                        :book_name, :lesson_start, :lesson_end,
                        now(), now()
                    )
                """),
                {
                    "id": config_id,
                    "teacher_id": teacher.id,
                    "name": cfg["name"],
                    "test_type": cfg["test_type"],
                    "question_count": cfg["question_count"],
                    "time_limit": cfg["question_count"] * cfg["per_q_time"],
                    "is_active": True,
                    "lv_min": cfg["lv_min"],
                    "lv_max": cfg["lv_max"],
                    "per_q_time": cfg["per_q_time"],
                    "q_types": "word_meaning",
                    "book_name": cfg["book_name"],
                    "lesson_start": cfg["lesson_start"],
                    "lesson_end": cfg["lesson_end"],
                },
            )

            assignment_id = str(uuid.uuid4())
            await session.execute(
                text("""
                    INSERT INTO test_assignments (
                        id, test_config_id, student_id, teacher_id,
                        test_code, assignment_type, engine_type, status, assigned_at
                    ) VALUES (
                        :id, :config_id, :student_id, :teacher_id,
                        :test_code, :assignment_type, :engine_type, :status, now()
                    )
                """),
                {
                    "id": assignment_id,
                    "config_id": config_id,
                    "student_id": student.id,
                    "teacher_id": teacher.id,
                    "test_code": cfg["code"],
                    "assignment_type": cfg["assignment_type"],
                    "engine_type": cfg["engine_type"],
                    "status": "pending",
                },
            )

            print(f"  [OK] {cfg['code']} → {cfg['engine_type']} ({cfg['name']})")

        await session.commit()

        # --- Summary ---
        print(f"\n{'=' * 60}")
        print("  4 Engine Test Codes Ready:")
        print(f"{'=' * 60}")
        for cfg in ENGINES:
            print(f"  {cfg['code']}  →  {cfg['engine_type']:<15} {cfg['name']}")
        print(f"{'=' * 60}")


if __name__ == "__main__":
    asyncio.run(main())
