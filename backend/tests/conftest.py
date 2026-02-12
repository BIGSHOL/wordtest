"""Test configuration and fixtures."""
from typing import AsyncGenerator

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.core.security import create_access_token, create_refresh_token, get_password_hash
from app.main import app
from app.models.user import User
from app.models.word import Word
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.auth_token import AuthToken
from app.models.test_config import TestConfig

# SQLite for tests (in-memory)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Create tables and yield a test database session."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client with overridden DB dependency."""

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def teacher_user(db_session: AsyncSession) -> User:
    """Create a teacher user for testing."""
    user = User(
        username="st2000423",
        password_hash=get_password_hash("password123"),
        name="PSS",
        role="teacher",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def teacher_token(teacher_user: User) -> str:
    """Create a JWT token for the teacher."""
    return create_access_token(subject=teacher_user.id)


@pytest_asyncio.fixture
async def teacher_refresh_token(db_session: AsyncSession, teacher_user: User) -> str:
    """Create a DB-backed refresh token for the teacher."""
    from datetime import timedelta
    from app.core.timezone import now_kst
    token = create_refresh_token(subject=teacher_user.id)
    auth_token = AuthToken(
        user_id=teacher_user.id,
        refresh_token=token,
        expires_at=now_kst() + timedelta(days=7),
    )
    db_session.add(auth_token)
    await db_session.commit()
    return token


@pytest_asyncio.fixture
async def teacher_headers(teacher_token: str) -> dict:
    """Return auth headers for teacher."""
    return {"Authorization": f"Bearer {teacher_token}"}


@pytest_asyncio.fixture
async def student_user(db_session: AsyncSession, teacher_user: User) -> User:
    """Create a student user for testing."""
    user = User(
        username="test01",
        password_hash=get_password_hash("password123"),
        name="테스트01",
        role="student",
        teacher_id=teacher_user.id,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def student_token(student_user: User) -> str:
    """Create a JWT token for the student."""
    return create_access_token(subject=student_user.id)


@pytest_asyncio.fixture
async def student_headers(student_token: str) -> dict:
    """Return auth headers for student."""
    return {"Authorization": f"Bearer {student_token}"}


@pytest_asyncio.fixture
async def sample_words(db_session: AsyncSession) -> list[Word]:
    """Create sample words across multiple levels."""
    words = []
    for level in range(1, 6):
        for i in range(10):
            word = Word(
                english=f"word_{level}_{i}",
                korean=f"단어_{level}_{i}",
                level=level,
                category="noun",
                lesson=f"Lesson {(i % 25) + 1:02d}",
                is_excluded=False,
            )
            db_session.add(word)
            words.append(word)
    await db_session.commit()
    for w in words:
        await db_session.refresh(w)
    return words
