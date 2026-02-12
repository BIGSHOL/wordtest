"""Create test assignments for all 6 engine types.

Creates TEST codes:
  - ENG_XW01: xp_word       (XP + Word-only, Lv1-15)
  - ENG_XS01: xp_stage      (XP + 5-stage, Lv1-15)
  - ENG_XL01: xp_listen     (XP + Listen-only, Lv1-15)
  - ENG_LW01: legacy_word   (Legacy + Word-only, Lv8 Lesson 01)
  - ENG_LS01: legacy_stage  (Legacy + 5-stage, Lv8 Lesson 01)
  - ENG_LL01: legacy_listen (Legacy + Listen-only, Lv8 Lesson 01)

Usage:
    cd backend
    python scripts/seed_all_engines.py
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


ENGINE_CONFIGS = [
    {
        "code": "ENG_XW01",
        "engine_type": "xp_word",
        "name": "XP 워드 엔진 (Lv1-15, 50Q)",
        "test_type": "placement",
        "assignment_type": "mastery",
        "question_count": 50,
        "per_q_time": 10,
        "lv_min": 1,
        "lv_max": 15,
        "book_name": None,
        "lesson_start": None,
        "lesson_end": None,
    },
    {
        "code": "ENG_XS01",
        "engine_type": "xp_stage",
        "name": "XP 스테이지 엔진 (Lv1-15, 50Q)",
        "test_type": "placement",
        "assignment_type": "mastery",
        "question_count": 50,
        "per_q_time": 10,
        "lv_min": 1,
        "lv_max": 15,
        "book_name": None,
        "lesson_start": None,
        "lesson_end": None,
    },
    {
        "code": "ENG_XL01",
        "engine_type": "xp_listen",
        "name": "XP 리스닝 엔진 (Lv1-15, 50Q)",
        "test_type": "placement",
        "assignment_type": "mastery",
        "question_count": 50,
        "per_q_time": 15,
        "lv_min": 1,
        "lv_max": 15,
        "book_name": None,
        "lesson_start": None,
        "lesson_end": None,
    },
    {
        "code": "ENG_LW01",
        "engine_type": "legacy_word",
        "name": "레거시 워드 엔진 (Lv8, 20단어)",
        "test_type": "periodic",
        "assignment_type": "stage_test",
        "question_count": 20,
        "per_q_time": 10,
        "lv_min": 8,
        "lv_max": 8,
        "book_name": "Power Voca 5000-08",
        "lesson_start": "Lesson 01",
        "lesson_end": "Lesson 01",
    },
    {
        "code": "ENG_LS01",
        "engine_type": "legacy_stage",
        "name": "레거시 스테이지 엔진 (Lv8, 20단어)",
        "test_type": "periodic",
        "assignment_type": "stage_test",
        "question_count": 20,
        "per_q_time": 15,
        "lv_min": 8,
        "lv_max": 8,
        "book_name": "Power Voca 5000-08",
        "lesson_start": "Lesson 01",
        "lesson_end": "Lesson 01",
    },
    {
        "code": "ENG_LL01",
        "engine_type": "legacy_listen",
        "name": "레거시 리스닝 엔진 (Lv8, 20단어)",
        "test_type": "periodic",
        "assignment_type": "stage_test",
        "question_count": 20,
        "per_q_time": 15,
        "lv_min": 8,
        "lv_max": 8,
        "book_name": "Power Voca 5000-08",
        "lesson_start": "Lesson 01",
        "lesson_end": "Lesson 01",
    },
]


async def main():
    print("\n[SEED] Create test assignments for all 6 engine types")
    print("=" * 60)

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Connected\n")

        # Get teacher + student
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

        # Check engine_type column exists
        col_check = await session.execute(text("""
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'test_assignments' AND column_name = 'engine_type'
        """))
        if not col_check.first():
            print("[ERROR] engine_type column not found. Run migrate_engine_type.py first!")
            sys.exit(1)

        for cfg in ENGINE_CONFIGS:
            code = cfg["code"]

            # Skip if already exists
            existing = await session.execute(
                text("SELECT id FROM test_assignments WHERE test_code = :code"),
                {"code": code},
            )
            if existing.first():
                print(f"  [SKIP] {code} ({cfg['engine_type']}) already exists")
                continue

            # Create TestConfig
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

            # Create TestAssignment with engine_type
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
                    "test_code": code,
                    "assignment_type": cfg["assignment_type"],
                    "engine_type": cfg["engine_type"],
                    "status": "pending",
                },
            )

            print(f"  [OK] {code} → {cfg['engine_type']} ({cfg['name']})")

        await session.commit()

        print(f"\n{'=' * 60}")
        print("  All 6 engine test codes ready:")
        print("=" * 60)
        for cfg in ENGINE_CONFIGS:
            print(f"  {cfg['code']} → {cfg['engine_type']}")
        print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
