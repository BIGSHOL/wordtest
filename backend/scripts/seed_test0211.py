"""Create TEST0211 assignment: 30Q periodic (stage) test, all books (Lv1-15).

Assigns TEST0211 code to a random student under the TEST0213 teacher.

Usage:
    cd backend
    python scripts/seed_test0211.py
"""
import asyncio
import uuid
import random
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
    print("\n[Seed TEST0211] Connecting to database...\n")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Database connected\n")

        # 1. Find teacher
        teacher_row = await session.execute(
            text("SELECT id, username, name FROM users WHERE username = 'TEST0213' AND role = 'teacher'")
        )
        teacher = teacher_row.first()
        if not teacher:
            print("[ERROR] TEST0213 teacher not found")
            sys.exit(1)
        print(f"  Teacher: {teacher.name} ({teacher.username})")

        # 2. Find students, pick random one
        student_rows = await session.execute(
            text("SELECT id, username, name FROM users WHERE teacher_id = :tid AND role = 'student' ORDER BY username"),
            {"tid": teacher.id},
        )
        students = student_rows.all()
        if not students:
            print("[ERROR] No students found")
            sys.exit(1)

        student = random.choice(students)
        print(f"  Random student: {student.name} ({student.username})")

        # 3. Check existing
        existing = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = 'TEST0211' LIMIT 1")
        )
        if existing.first():
            print("\n[SKIP] TEST0211 already exists.")
            return

        # 4. Create TestConfig: 30Q, 15s/Q, periodic, all books
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
                "name": "스테이지 테스트 (30Q, Lv1-15)",
                "test_type": "periodic",
                "question_count": 30,
                "time_limit": 450,
                "is_active": True,
                "lv_min": 1,
                "lv_max": 15,
                "per_q_time": 15,
                "q_types": "word_meaning",
            },
        )
        print(f"\n  [OK] TestConfig created: 30Q, periodic, Lv1-15")

        # 5. Create TestAssignment
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
                "test_code": "TEST0211",
                "assignment_type": "mastery",
                "status": "pending",
            },
        )
        print(f"  [OK] Assignment: {student.name} ({student.username}) -> TEST0211")

        await session.commit()

        print("\n" + "=" * 50)
        print("  TEST0211 READY!")
        print("=" * 50)
        print(f"  Code       : TEST0211")
        print(f"  Student    : {student.name} ({student.username})")
        print(f"  Type       : periodic (스테이지)")
        print(f"  Questions  : 30")
        print(f"  Time/Q     : 15 seconds")
        print(f"  Levels     : 1 ~ 15 (전체 교재)")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
