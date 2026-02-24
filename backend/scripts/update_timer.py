"""Update TEST0213 per_question_time_seconds to 10."""
import asyncio, os, sys
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

async def run():
    from app.db.session import AsyncSessionLocal
    from sqlalchemy import text
    async with AsyncSessionLocal() as db:
        # TEST0213 config id
        await db.execute(
            text("UPDATE test_configs SET per_question_time_seconds = 10 WHERE id = '15c24fc6-518b-4893-9f78-af4a6ae085c9'")
        )
        await db.commit()
        r = await db.execute(text(
            "SELECT per_question_time_seconds FROM test_configs WHERE id = '15c24fc6-518b-4893-9f78-af4a6ae085c9'"
        ))
        print("TEST0213 per_question_time_seconds:", r.scalar())

asyncio.run(run())
