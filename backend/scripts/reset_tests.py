"""Reset TEST0212 and TEST0213 for fresh retake."""
import asyncio
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
os.environ.setdefault("RUNNING_SCRIPT", "1")

async def reset():
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import text

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            text("SELECT id, test_code FROM test_assignments WHERE test_code IN ('TEST0212','TEST0213')")
        )
        assignments = result.fetchall()
        print("Found assignments:", assignments)

        for aid, code in assignments:
            r1 = await db.execute(
                text("DELETE FROM learning_answers WHERE session_id IN (SELECT id FROM learning_sessions WHERE assignment_id = :aid)"),
                {"aid": aid},
            )
            print(f"  {code} [{aid[:8]}]: deleted {r1.rowcount} answers")

            r2 = await db.execute(
                text("DELETE FROM learning_sessions WHERE assignment_id = :aid"),
                {"aid": aid},
            )
            print(f"  {code} [{aid[:8]}]: deleted {r2.rowcount} sessions")

            r3 = await db.execute(
                text("DELETE FROM word_mastery WHERE assignment_id = :aid"),
                {"aid": aid},
            )
            print(f"  {code} [{aid[:8]}]: deleted {r3.rowcount} word_mastery")

            await db.execute(
                text("UPDATE test_assignments SET status = 'pending', completed_at = NULL WHERE id = :aid"),
                {"aid": aid},
            )
            print(f"  {code} [{aid[:8]}]: status -> pending")

        await db.commit()
        print("All done!")

if __name__ == "__main__":
    asyncio.run(reset())
