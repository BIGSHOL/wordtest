"""Restore demo_teacher students (undo migration to TEST0213).

Moves students, configs, assignments back from TEST0213 -> demo_teacher.

Usage:
    cd backend
    python scripts/restore_demo_teacher.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
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
    from app.models.test_assignment import TestAssignment
    from app.models.test_config import TestConfig

    print("\n[Restore demo_teacher] Connecting to database...\n")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(select(1))
        print("[OK] Database connected\n")

        # Find both teachers
        test_result = await session.execute(
            select(User).where(User.username == "TEST0213")
        )
        test_teacher = test_result.scalar_one_or_none()

        demo_result = await session.execute(
            select(User).where(User.username == "demo_teacher")
        )
        demo_teacher = demo_result.scalar_one_or_none()

        if not test_teacher:
            print("[ERROR] TEST0213 not found")
            return
        if not demo_teacher:
            print("[ERROR] demo_teacher not found")
            return

        print(f"  TEST0213 id: {test_teacher.id}")
        print(f"  demo_teacher id: {demo_teacher.id}\n")

        # Restore students
        student_result = await session.execute(
            select(User).where(
                User.role == "student",
                User.teacher_id == test_teacher.id,
            )
        )
        students = student_result.scalars().all()
        for s in students:
            s.teacher_id = demo_teacher.id
            print(f"  [RESTORE] Student {s.name} ({s.username}) -> demo_teacher")

        # Restore test_configs
        config_result = await session.execute(
            select(TestConfig).where(TestConfig.teacher_id == test_teacher.id)
        )
        configs = config_result.scalars().all()
        for c in configs:
            c.teacher_id = demo_teacher.id
            print(f"  [RESTORE] Config '{c.name}' -> demo_teacher")

        # Restore test_assignments
        assignment_result = await session.execute(
            select(TestAssignment).where(TestAssignment.teacher_id == test_teacher.id)
        )
        assignments = assignment_result.scalars().all()
        for a in assignments:
            a.teacher_id = demo_teacher.id
            print(f"  [RESTORE] Assignment {a.test_code} -> demo_teacher")

        print(f"\n  Total: {len(students)} students, {len(configs)} configs, {len(assignments)} assignments restored")

        await session.commit()
        print("\n[OK] Done! demo_teacher now has all students back.")
        print(f"[NOTE] TEST0213 account still exists but has 0 students.")


if __name__ == "__main__":
    asyncio.run(main())
