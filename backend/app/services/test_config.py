"""Test config service - code generation and lookup."""
import random
import string

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_config import TestConfig


def _generate_code() -> str:
    """Generate a 6-character uppercase alphanumeric code."""
    chars = string.ascii_uppercase + string.digits
    return "".join(random.choices(chars, k=6))


async def generate_test_code(db: AsyncSession) -> str:
    """Generate a unique 6-character test code (max 10 retries)."""
    for _ in range(10):
        code = _generate_code()
        result = await db.execute(
            select(TestConfig).where(TestConfig.test_code == code)
        )
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError("Failed to generate unique test code after 10 attempts")


async def get_config_by_code(db: AsyncSession, code: str) -> TestConfig | None:
    """Look up a TestConfig by its test_code."""
    result = await db.execute(
        select(TestConfig).where(
            TestConfig.test_code == code.upper(),
            TestConfig.is_active == True,
        )
    )
    return result.scalar_one_or_none()
