"""Reset test sessions for fresh testing.

Usage:
    python scripts/reset_test0213.py                  # Reset TEST0213 only
    python scripts/reset_test0213.py TEST0211 TEST0213  # Reset multiple codes
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

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


async def reset_one(db: AsyncSession, test_code: str):
    from app.models.test_assignment import TestAssignment
    from app.models.learning_session import LearningSession
    from app.models.learning_answer import LearningAnswer
    from app.models.word_mastery import WordMastery

    print(f"\n--- {test_code} ---")

    result = await db.execute(
        select(TestAssignment).where(TestAssignment.test_code == test_code)
    )
    assignment = result.scalar_one_or_none()

    if not assignment:
        print(f"  [SKIP] {test_code} not found")
        return False

    print(f"  Assignment ID: {assignment.id}")
    print(f"  Student ID:    {assignment.student_id}")
    print(f"  Status:        {assignment.status}")

    # Delete learning sessions and answers
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.assignment_id == assignment.id)
    )
    sessions = session_result.scalars().all()

    total_answers = 0
    for session in sessions:
        answer_count = await db.execute(
            delete(LearningAnswer).where(LearningAnswer.session_id == session.id)
        )
        total_answers += answer_count.rowcount
        await db.execute(
            delete(LearningSession).where(LearningSession.id == session.id)
        )

    print(f"  - Deleted {len(sessions)} session(s), {total_answers} answers")

    # Delete word mastery records
    mastery_count = await db.execute(
        delete(WordMastery).where(WordMastery.assignment_id == assignment.id)
    )
    print(f"  - Deleted {mastery_count.rowcount} word mastery records")

    # Reset assignment status
    assignment.status = "assigned"
    assignment.completed_at = None
    print(f"  -> Status reset to 'assigned'")
    return True


async def main():
    codes = sys.argv[1:] if len(sys.argv) > 1 else ["TEST0213"]

    print("\n" + "=" * 60)
    print(f"  Session Reset: {', '.join(codes)}")
    print("=" * 60)

    SessionLocal = get_session_factory()
    async with SessionLocal() as db:
        success_count = 0
        for code in codes:
            if await reset_one(db, code):
                success_count += 1

        await db.commit()

        print("\n" + "=" * 60)
        print(f"  {success_count}/{len(codes)} reset completed!")
        print("=" * 60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
