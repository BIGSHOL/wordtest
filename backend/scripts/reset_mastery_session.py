"""Reset mastery session data for a given test code.

Usage: python -m scripts.reset_mastery_session TEST0213
"""
import asyncio
import sys

from sqlalchemy import select, delete, func

from app.db.session import AsyncSessionLocal
from app.models.test_assignment import TestAssignment
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer


async def reset(test_code: str):
    async with AsyncSessionLocal() as db:
        # Find assignment
        result = await db.execute(
            select(TestAssignment).where(TestAssignment.test_code == test_code)
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            print(f"Assignment not found for code: {test_code}")
            return

        print(f"Assignment: {assignment.id} (student: {assignment.student_id})")

        # Find all learning sessions for this assignment
        sessions_result = await db.execute(
            select(LearningSession).where(
                LearningSession.assignment_id == assignment.id
            )
        )
        sessions = sessions_result.scalars().all()
        print(f"Found {len(sessions)} session(s)")

        for session in sessions:
            # Count answers
            count_result = await db.execute(
                select(func.count(LearningAnswer.id)).where(
                    LearningAnswer.session_id == session.id
                )
            )
            count = count_result.scalar() or 0
            print(f"  Session {session.id}: {count} answers, completed={session.completed_at}")

            # Delete answers
            await db.execute(
                delete(LearningAnswer).where(LearningAnswer.session_id == session.id)
            )
            print(f"    -> Deleted {count} answers")

        # Delete sessions
        for session in sessions:
            await db.delete(session)
        print(f"Deleted {len(sessions)} session(s)")

        # Reset assignment status
        assignment.status = "pending"
        print(f"Reset assignment status to 'pending'")

        await db.commit()
        print("Done!")


if __name__ == "__main__":
    code = sys.argv[1] if len(sys.argv) > 1 else "TEST0213"
    print(f"Resetting mastery data for: {code}")
    asyncio.run(reset(code))
