"""Create TEST0215: Legacy level engine, 50Q, 10s, full range.

Usage:
    cd backend
    python scripts/seed_test0215.py
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
    TEST_CODE = "TEST0215"

    print(f"\n[{TEST_CODE}] Connecting to database...")
    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Connected\n")

        # Check if already exists
        existing = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = :code"),
            {"code": TEST_CODE},
        )
        if existing.first():
            print(f"[SKIP] {TEST_CODE} already exists!")
            return

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

        # Create TestConfig
        config_id = str(uuid.uuid4())
        await session.execute(
            text("""
                INSERT INTO test_configs (
                    id, teacher_id, name, test_type, question_count,
                    time_limit_seconds, is_active, level_range_min, level_range_max,
                    per_question_time_seconds, question_types, created_at, updated_at
                ) VALUES (
                    :id, :teacher_id, :name, :test_type, :question_count,
                    :time_limit, :is_active, :lv_min, :lv_max,
                    :per_q_time, :q_types, now(), now()
                )
            """),
            {
                "id": config_id,
                "teacher_id": teacher.id,
                "name": "레벨 테스트 전범위 (Lv1-15, 50Q, 10s)",
                "test_type": "placement",
                "question_count": 50,
                "time_limit": 500,
                "is_active": True,
                "lv_min": 1,
                "lv_max": 15,
                "per_q_time": 10,
                "q_types": "word_meaning",
            },
        )
        print(f"  [OK] TestConfig created")

        # Create TestAssignment (legacy = level engine)
        assignment_id = str(uuid.uuid4())
        await session.execute(
            text("""
                INSERT INTO test_assignments (
                    id, test_config_id, student_id, teacher_id,
                    test_code, assignment_type, status, assigned_at
                ) VALUES (
                    :id, :config_id, :student_id, :teacher_id,
                    :test_code, :assignment_type, :status, now()
                )
            """),
            {
                "id": assignment_id,
                "config_id": config_id,
                "student_id": student.id,
                "teacher_id": teacher.id,
                "test_code": TEST_CODE,
                "assignment_type": "legacy",
                "status": "assigned",
            },
        )

        await session.commit()

        # Count words in range
        word_count = await session.execute(
            text("SELECT COUNT(*) FROM words WHERE level >= 1 AND level <= 15 AND is_excluded = false")
        )
        total_words = word_count.scalar()

        print("\n" + "=" * 50)
        print(f"  {TEST_CODE} READY!")
        print("=" * 50)
        print(f"  Code       : {TEST_CODE}")
        print(f"  Student    : {student.name} ({student.username})")
        print(f"  Engine     : legacy (level engine)")
        print(f"  Type       : placement")
        print(f"  Questions  : 50")
        print(f"  Time/Q     : 10 seconds")
        print(f"  Levels     : 1 ~ 15 (full range)")
        print(f"  Words in DB: {total_words} (excluding loanwords)")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
