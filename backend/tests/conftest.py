"""Shared test fixtures for the entire test suite."""
import uuid
import pytest
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.core.security import create_access_token, pwd_context

# Import ALL models so create_all picks them up
from app.models.user import User
from app.models.word import Word
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.word_mastery import WordMastery
from app.models.auth_token import AuthToken
from app.models.tts_cache import TtsCache


# ── DB ────────────────────────────────────────────────────────────────────────

TEST_DB_URL = "sqlite+aiosqlite:///:memory:"


@pytest.fixture
async def db_session():
    engine = create_async_engine(TEST_DB_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest.fixture
async def client(db_session):
    async def _override_db():
        yield db_session

    app.dependency_overrides[get_db] = _override_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


# ── Users ─────────────────────────────────────────────────────────────────────

@pytest.fixture
async def teacher_user(db_session):
    user = User(
        id=str(uuid.uuid4()),
        username="teacher01",
        password_hash=pwd_context.hash("pass1234"),
        name="Test Teacher",
        role="teacher",
        grade="고1",
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def teacher_token(teacher_user):
    return create_access_token(subject=teacher_user.id)


@pytest.fixture
async def teacher_headers(teacher_token):
    return {"Authorization": f"Bearer {teacher_token}"}


@pytest.fixture
async def student_user(db_session, teacher_user):
    user = User(
        id=str(uuid.uuid4()),
        username="student01",
        password_hash=pwd_context.hash("pass1234"),
        name="Test Student",
        role="student",
        teacher_id=teacher_user.id,
        grade="중3",
    )
    db_session.add(user)
    await db_session.commit()
    return user


@pytest.fixture
async def student_token(student_user):
    return create_access_token(subject=student_user.id)


@pytest.fixture
async def student_headers(student_token):
    return {"Authorization": f"Bearer {student_token}"}


# ── Words ─────────────────────────────────────────────────────────────────────

# Words that have emoji mapping (from emoji_engine.py EMOJI_MAP)
_EMOJI_WORDS = ["dog", "cat", "apple", "book", "car", "sun", "tree", "fish", "star", "house"]
_EMOJI_KOREAN = ["개", "고양이", "사과", "책", "자동차", "태양", "나무", "물고기", "별", "집"]


@pytest.fixture
async def sample_words(db_session):
    """50 words: 5 levels x 10 words, with korean, example_en, some with emoji."""
    words = []
    for level in range(1, 6):
        for i in range(10):
            idx = (level - 1) * 10 + i
            if idx < len(_EMOJI_WORDS):
                english = _EMOJI_WORDS[idx]
                korean = _EMOJI_KOREAN[idx]
            else:
                english = f"word{idx}"
                korean = f"단어{idx}"
            word = Word(
                id=str(uuid.uuid4()),
                english=english,
                korean=korean,
                level=level,
                book_name="POWER VOCA 5000-01",
                lesson=f"Lesson {(i // 5) + 1}",
                example_en=f"I like the {english} very much.",
                example_ko=f"나는 {korean}을(를) 매우 좋아합니다.",
                part_of_speech="noun",
                is_excluded=False,
            )
            words.append(word)
    db_session.add_all(words)
    await db_session.commit()
    return words


# ── Config & Assignment ───────────────────────────────────────────────────────

@pytest.fixture
async def test_config(db_session, teacher_user):
    config = TestConfig(
        id=str(uuid.uuid4()),
        teacher_id=teacher_user.id,
        name="Test Config",
        test_type="mastery",
        question_count=20,
        time_limit_seconds=300,
        is_active=True,
        book_name="POWER VOCA 5000-01",
        level_range_min=1,
        level_range_max=5,
        per_question_time_seconds=10,
        question_types="en_to_ko,ko_to_en",
    )
    db_session.add(config)
    await db_session.commit()
    return config


@pytest.fixture
async def levelup_assignment(db_session, test_config, student_user, teacher_user):
    assignment = TestAssignment(
        id=str(uuid.uuid4()),
        test_config_id=test_config.id,
        student_id=student_user.id,
        teacher_id=teacher_user.id,
        test_code="LU0001",
        assignment_type="mastery",
        engine_type="levelup",
        status="pending",
    )
    db_session.add(assignment)
    await db_session.commit()
    return assignment


@pytest.fixture
async def legacy_assignment(db_session, student_user, teacher_user):
    """Separate config+assignment for legacy engine (avoids unique constraint)."""
    config = TestConfig(
        id=str(uuid.uuid4()),
        teacher_id=teacher_user.id,
        name="Legacy Config",
        test_type="mastery",
        question_count=10,
        time_limit_seconds=300,
        is_active=True,
        book_name="POWER VOCA 5000-01",
        level_range_min=1,
        level_range_max=5,
        per_question_time_seconds=10,
        question_types="en_to_ko,ko_to_en",
    )
    db_session.add(config)
    await db_session.flush()

    assignment = TestAssignment(
        id=str(uuid.uuid4()),
        test_config_id=config.id,
        student_id=student_user.id,
        teacher_id=teacher_user.id,
        test_code="LG0001",
        assignment_type="mastery",
        engine_type="legacy",
        status="pending",
    )
    db_session.add(assignment)
    await db_session.commit()
    return assignment
