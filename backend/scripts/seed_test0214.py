"""Create TEST0214: Stage test, 20 words, Level 8 Lesson 01.

Usage:
    cd backend
    python scripts/seed_test0214.py
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


async def main():
    print("\n[TEST0214] Stage Test Setup - Lv8, 20 words")
    print("=" * 50)

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Connected\n")

        # Check if TEST0214 already exists
        existing = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = :code"),
            {"code": "TEST0214"},
        )
        if existing.first():
            print("[SKIP] TEST0214 already exists! Cleaning up for re-creation...")
            # Delete old assignment and config
            old_assign = await session.execute(
                text("SELECT id, test_config_id FROM test_assignments WHERE test_code = :code"),
                {"code": "TEST0214"},
            )
            old = old_assign.first()
            if old:
                # Delete learning answers -> sessions -> word mastery -> assignment -> config
                sess_rows = await session.execute(
                    text("SELECT id FROM learning_sessions WHERE assignment_id = :aid"),
                    {"aid": old.id},
                )
                for sr in sess_rows.fetchall():
                    await session.execute(
                        text("DELETE FROM learning_answers WHERE session_id = :sid"),
                        {"sid": sr.id},
                    )
                await session.execute(
                    text("DELETE FROM learning_sessions WHERE assignment_id = :aid"),
                    {"aid": old.id},
                )
                await session.execute(
                    text("DELETE FROM word_mastery WHERE assignment_id = :aid"),
                    {"aid": old.id},
                )
                await session.execute(
                    text("DELETE FROM test_assignments WHERE id = :id"),
                    {"id": old.id},
                )
                await session.execute(
                    text("DELETE FROM test_configs WHERE id = :id"),
                    {"id": old.test_config_id},
                )
                await session.commit()
                print("[OK] Old TEST0214 cleaned up\n")

        # Get teacher
        teacher_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'teacher' LIMIT 1")
        )
        teacher = teacher_row.first()
        if not teacher:
            print("[ERROR] No teacher found in DB.")
            sys.exit(1)
        print(f"  Teacher: {teacher.name} ({teacher.username})")

        # Get student
        student_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'student' LIMIT 1")
        )
        student = student_row.first()
        if not student:
            print("[ERROR] No student found in DB.")
            sys.exit(1)
        print(f"  Student: {student.name} ({student.username})")

        # Count lv8 lesson 01 words
        word_count = await session.execute(
            text("""
                SELECT COUNT(*) FROM words
                WHERE level = 8
                  AND book_name = 'Power Voca 5000-08'
                  AND lesson = 'Lesson 01'
            """)
        )
        total = word_count.scalar()
        print(f"  Words (Lv8 Lesson 01): {total}")

        if total < 4:
            print("[ERROR] Not enough words for stage test (need at least 4)")
            sys.exit(1)

        # Create TestConfig - periodic (stage test)
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
                "name": "스테이지 테스트 (Lv8, 20단어)",
                "test_type": "periodic",
                "question_count": 20,
                "time_limit": 300,
                "is_active": True,
                "lv_min": 8,
                "lv_max": 8,
                "per_q_time": 15,
                "q_types": "word_meaning",
                "book_name": "Power Voca 5000-08",
                "lesson_start": "Lesson 01",
                "lesson_end": "Lesson 01",
            },
        )
        print(f"  [OK] TestConfig created (periodic/stage)")

        # Create TestAssignment
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
                "test_code": "TEST0214",
                "assignment_type": "mastery",
                "engine_type": "legacy_stage",
                "status": "pending",
            },
        )

        await session.commit()

        print(f"\n{'=' * 50}")
        print(f"  TEST0214 READY!")
        print(f"{'=' * 50}")
        print(f"  Code       : TEST0214")
        print(f"  Student    : {student.name} ({student.username})")
        print(f"  Type       : periodic (스테이지 테스트)")
        print(f"  Words      : {total} (Lv8 Lesson 01)")
        print(f"  Book       : Power Voca 5000-08")
        print(f"  Time/Q     : 15 seconds")
        print(f"{'=' * 50}")


if __name__ == "__main__":
    asyncio.run(main())
