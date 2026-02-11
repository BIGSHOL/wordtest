"""Test config service - code generation and lookup."""
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig

# Ambiguity-free charset: no I/O/0/1
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
CODE_LENGTH = 8


def _generate_code() -> str:
    """Generate an 8-character cryptographically secure code."""
    return "".join(secrets.choice(CODE_CHARS) for _ in range(CODE_LENGTH))


async def generate_test_code(db: AsyncSession) -> str:
    """Generate a unique 8-character test code (max 10 retries)."""
    for _ in range(10):
        code = _generate_code()
        result = await db.execute(
            select(TestAssignment).where(TestAssignment.test_code == code)
        )
        if result.scalar_one_or_none() is None:
            return code
    raise RuntimeError("Failed to generate unique test code after 10 attempts")


async def get_config_by_code(
    db: AsyncSession, code: str
) -> tuple[TestAssignment, TestConfig] | None:
    """Look up an assignment + config by the assignment's test_code.

    Returns (assignment, config) or None.
    """
    result = await db.execute(
        select(TestAssignment, TestConfig)
        .join(TestConfig, TestAssignment.test_config_id == TestConfig.id)
        .where(
            TestAssignment.test_code == code.upper(),
            TestConfig.is_active == True,
        )
    )
    row = result.first()
    if row is None:
        return None
    return row[0], row[1]
