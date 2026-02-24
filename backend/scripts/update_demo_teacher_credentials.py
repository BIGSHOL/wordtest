"""Update demo_teacher credentials to TEST0213/TEST0213.

This changes the login username/password while keeping all data intact.
The TEST0213 separate account (if exists) is removed to avoid confusion.

Usage:
    cd backend
    python scripts/update_demo_teacher_credentials.py
"""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select, delete
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

    print("\n[Update Credentials] Connecting to database...\n")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(select(1))
        print("[OK] Database connected\n")

        # 1. Find demo_teacher
        demo_result = await session.execute(
            select(User).where(User.username == "demo_teacher")
        )
        demo_teacher = demo_result.scalar_one_or_none()

        if not demo_teacher:
            print("[ERROR] demo_teacher not found")
            return

        print(f"  demo_teacher id: {demo_teacher.id}")
        print(f"  Current username: {demo_teacher.username}")

        # 2. Remove separate TEST0213 account if exists (no students attached)
        test_result = await session.execute(
            select(User).where(User.username == "TEST0213", User.role == "teacher")
        )
        test_account = test_result.scalar_one_or_none()
        if test_account:
            # Check it has no students
            student_check = await session.execute(
                select(User).where(User.teacher_id == test_account.id)
            )
            if student_check.scalars().all():
                print("[WARN] TEST0213 account has students, not removing")
            else:
                await session.delete(test_account)
                await session.flush()  # Flush delete before renaming
                print(f"  [DELETE] Removed empty TEST0213 account (id={test_account.id})")

        # 3. Update demo_teacher -> TEST0213 credentials
        demo_teacher.username = "TEST0213"
        demo_teacher.password_hash = get_password_hash("TEST0213")
        print(f"  [UPDATE] Username: demo_teacher -> TEST0213")
        print(f"  [UPDATE] Password: -> TEST0213")

        # Count current data
        student_result = await session.execute(
            select(User).where(User.teacher_id == demo_teacher.id, User.role == "student")
        )
        students = student_result.scalars().all()
        print(f"\n  Students under this account: {len(students)}")
        for s in students:
            print(f"    - {s.name} ({s.username})")

        await session.commit()
        print("\n[OK] Done!")

    print("\n" + "=" * 50)
    print("  Teacher Login")
    print("  Username: TEST0213")
    print("  Password: TEST0213")
    print("  (Same account as demo_teacher, all data preserved)")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
