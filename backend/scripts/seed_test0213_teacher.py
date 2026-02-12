"""Create TEST0213 teacher account with same students as demo_teacher.

Usage:
    cd backend
    python scripts/seed_test0213_teacher.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, update
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
    from app.models.user import User
    from app.core.security import get_password_hash

    print("\n[Seed TEST0213 Teacher] Connecting to database...\n")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(select(1))
        print("[OK] Database connected\n")

        # 1. Check if TEST0213 teacher already exists
        result = await session.execute(
            select(User).where(User.username == "TEST0213")
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"[SKIP] TEST0213 already exists (id={existing.id})")
            teacher_id = existing.id
        else:
            # Create new teacher
            teacher = User(
                username="TEST0213",
                password_hash=get_password_hash("TEST0213"),
                name="김선생",
                role="teacher",
            )
            session.add(teacher)
            await session.flush()
            teacher_id = teacher.id
            print(f"[OK] Teacher created: TEST0213 / TEST0213 (id={teacher_id})")

        # 2. Find demo_teacher
        demo_result = await session.execute(
            select(User).where(User.username == "demo_teacher")
        )
        demo_teacher = demo_result.scalar_one_or_none()

        if demo_teacher:
            # 3. Update all students + assignments from demo_teacher -> TEST0213
            from app.models.test_assignment import TestAssignment
            from app.models.test_config import TestConfig

            # Update students
            student_result = await session.execute(
                select(User).where(
                    User.role == "student",
                    User.teacher_id == demo_teacher.id,
                )
            )
            students = student_result.scalars().all()
            for s in students:
                s.teacher_id = teacher_id
                print(f"  [UPDATE] Student {s.name} ({s.username}) -> teacher TEST0213")

            # Update test_configs
            config_result = await session.execute(
                select(TestConfig).where(TestConfig.teacher_id == demo_teacher.id)
            )
            configs = config_result.scalars().all()
            for c in configs:
                c.teacher_id = teacher_id
                print(f"  [UPDATE] Config '{c.name}' -> teacher TEST0213")

            # Update test_assignments
            assignment_result = await session.execute(
                select(TestAssignment).where(TestAssignment.teacher_id == demo_teacher.id)
            )
            assignments = assignment_result.scalars().all()
            for a in assignments:
                a.teacher_id = teacher_id
                print(f"  [UPDATE] Assignment {a.test_code} -> teacher TEST0213")

            print(f"\n  Total: {len(students)} students, {len(configs)} configs, {len(assignments)} assignments migrated")
        else:
            print("[INFO] demo_teacher not found, no data to migrate")

        await session.commit()
        print("\n[OK] Done!")

    print("\n" + "=" * 50)
    print("  Teacher Login")
    print(f"  Username: TEST0213")
    print(f"  Password: TEST0213")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
