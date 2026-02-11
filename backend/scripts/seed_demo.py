"""Demo seed script - creates test accounts, words, and test codes.

Directly connects to the database (no running server needed).
Uses DATABASE_URL from backend/.env

Usage:
    cd backend
    python scripts/seed_demo.py
"""
import asyncio
import secrets
import sys

from sqlalchemy import select
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# Ambiguity-free charset for test codes (no I/O/0/1)
CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

# ──────────────────────────────────────────────────────────────
# Configuration
# ──────────────────────────────────────────────────────────────

# Teacher account
TEACHER = {
    "username": "demo_teacher",
    "password": "test1234",
    "name": "김선생",
}

# Student accounts
STUDENTS = [
    {"username": "student01", "password": "test1234", "name": "김민수"},
    {"username": "student02", "password": "test1234", "name": "이지은"},
    {"username": "student03", "password": "test1234", "name": "박서준"},
    {"username": "student04", "password": "test1234", "name": "최예린"},
    {"username": "student05", "password": "test1234", "name": "정하늘"},
]

# Test configurations (codes are now per-assignment, not per-config)
TEST_CONFIGS = [
    {
        "name": "기초 배치고사 (Lv1-5)",
        "test_type": "placement",
        "question_count": 50,
        "time_limit_seconds": 500,
        "level_range_min": 1,
        "level_range_max": 5,
    },
    {
        "name": "중급 배치고사 (Lv1-10)",
        "test_type": "placement",
        "question_count": 80,
        "time_limit_seconds": 800,
        "level_range_min": 1,
        "level_range_max": 10,
    },
    {
        "name": "주간 테스트 (Lv1-3)",
        "test_type": "periodic",
        "question_count": 30,
        "time_limit_seconds": 300,
        "level_range_min": 1,
        "level_range_max": 3,
    },
]

# Fixed demo test codes for easy testing (8-char, per student per config)
# Format: config_index -> student_username -> code
DEMO_CODES = {
    0: {  # 기초 배치고사
        "student01": "TEST2AA1",
        "student02": "TEST2AA2",
        "student03": "TEST2AA3",
    },
    1: {  # 중급 배치고사
        "student01": "TEST2BB1",
        "student02": "TEST2BB2",
        "student03": "TEST2BB3",
    },
    2: {  # 주간 테스트
        "student01": "TEST2CC1",
        "student02": "TEST2CC2",
        "student03": "TEST2CC3",
    },
}

# Word data - realistic English vocabulary by level
WORDS_BY_LEVEL: dict[int, list[dict]] = {
    1: [
        {"english": "apple", "korean": "사과", "book_name": "Power Voca 5000-01", "lesson": "Lesson 01", "category": "noun"},
        {"english": "book", "korean": "책", "book_name": "Power Voca 5000-01", "lesson": "Lesson 01", "category": "noun"},
        {"english": "cat", "korean": "고양이", "book_name": "Power Voca 5000-01", "lesson": "Lesson 01", "category": "noun"},
        {"english": "dog", "korean": "개", "book_name": "Power Voca 5000-01", "lesson": "Lesson 01", "category": "noun"},
        {"english": "eat", "korean": "먹다", "book_name": "Power Voca 5000-01", "lesson": "Lesson 01", "category": "verb"},
        {"english": "friend", "korean": "친구", "book_name": "Power Voca 5000-01", "lesson": "Lesson 02", "category": "noun"},
        {"english": "good", "korean": "좋은", "book_name": "Power Voca 5000-01", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "happy", "korean": "행복한", "book_name": "Power Voca 5000-01", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "house", "korean": "집", "book_name": "Power Voca 5000-01", "lesson": "Lesson 02", "category": "noun"},
        {"english": "run", "korean": "달리다", "book_name": "Power Voca 5000-01", "lesson": "Lesson 03", "category": "verb"},
        {"english": "school", "korean": "학교", "book_name": "Power Voca 5000-01", "lesson": "Lesson 03", "category": "noun"},
        {"english": "water", "korean": "물", "book_name": "Power Voca 5000-01", "lesson": "Lesson 03", "category": "noun"},
    ],
    2: [
        {"english": "angry", "korean": "화난", "book_name": "Power Voca 5000-02", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "believe", "korean": "믿다", "book_name": "Power Voca 5000-02", "lesson": "Lesson 01", "category": "verb"},
        {"english": "change", "korean": "변화; 바꾸다", "book_name": "Power Voca 5000-02", "lesson": "Lesson 01", "category": "noun"},
        {"english": "decide", "korean": "결정하다", "book_name": "Power Voca 5000-02", "lesson": "Lesson 01", "category": "verb"},
        {"english": "enough", "korean": "충분한", "book_name": "Power Voca 5000-02", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "forest", "korean": "숲", "book_name": "Power Voca 5000-02", "lesson": "Lesson 02", "category": "noun"},
        {"english": "guide", "korean": "안내하다", "book_name": "Power Voca 5000-02", "lesson": "Lesson 02", "category": "verb"},
        {"english": "honest", "korean": "정직한", "book_name": "Power Voca 5000-02", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "imagine", "korean": "상상하다", "book_name": "Power Voca 5000-02", "lesson": "Lesson 03", "category": "verb"},
        {"english": "journey", "korean": "여행", "book_name": "Power Voca 5000-02", "lesson": "Lesson 03", "category": "noun"},
        {"english": "kitchen", "korean": "부엌", "book_name": "Power Voca 5000-02", "lesson": "Lesson 03", "category": "noun"},
        {"english": "library", "korean": "도서관", "book_name": "Power Voca 5000-02", "lesson": "Lesson 03", "category": "noun"},
    ],
    3: [
        {"english": "accomplish", "korean": "달성하다", "book_name": "Power Voca 5000-03", "lesson": "Lesson 01", "category": "verb"},
        {"english": "beneath", "korean": "아래에", "book_name": "Power Voca 5000-03", "lesson": "Lesson 01", "category": "preposition"},
        {"english": "courage", "korean": "용기", "book_name": "Power Voca 5000-03", "lesson": "Lesson 01", "category": "noun"},
        {"english": "disaster", "korean": "재난", "book_name": "Power Voca 5000-03", "lesson": "Lesson 01", "category": "noun"},
        {"english": "enormous", "korean": "거대한", "book_name": "Power Voca 5000-03", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "familiar", "korean": "익숙한", "book_name": "Power Voca 5000-03", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "generous", "korean": "관대한", "book_name": "Power Voca 5000-03", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "hesitate", "korean": "망설이다", "book_name": "Power Voca 5000-03", "lesson": "Lesson 03", "category": "verb"},
        {"english": "influence", "korean": "영향", "book_name": "Power Voca 5000-03", "lesson": "Lesson 03", "category": "noun"},
        {"english": "jealous", "korean": "질투하는", "book_name": "Power Voca 5000-03", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "knowledge", "korean": "지식", "book_name": "Power Voca 5000-03", "lesson": "Lesson 03", "category": "noun"},
        {"english": "leisure", "korean": "여가", "book_name": "Power Voca 5000-03", "lesson": "Lesson 03", "category": "noun"},
    ],
    4: [
        {"english": "abundant", "korean": "풍부한", "book_name": "Power Voca 5000-04", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "circumstance", "korean": "상황", "book_name": "Power Voca 5000-04", "lesson": "Lesson 01", "category": "noun"},
        {"english": "demonstrate", "korean": "보여주다; 증명하다", "book_name": "Power Voca 5000-04", "lesson": "Lesson 01", "category": "verb"},
        {"english": "eliminate", "korean": "제거하다", "book_name": "Power Voca 5000-04", "lesson": "Lesson 02", "category": "verb"},
        {"english": "fundamental", "korean": "근본적인", "book_name": "Power Voca 5000-04", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "guarantee", "korean": "보장하다", "book_name": "Power Voca 5000-04", "lesson": "Lesson 02", "category": "verb"},
        {"english": "hypothesis", "korean": "가설", "book_name": "Power Voca 5000-04", "lesson": "Lesson 03", "category": "noun"},
        {"english": "investigate", "korean": "조사하다", "book_name": "Power Voca 5000-04", "lesson": "Lesson 03", "category": "verb"},
        {"english": "magnificent", "korean": "장엄한", "book_name": "Power Voca 5000-04", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "negotiate", "korean": "협상하다", "book_name": "Power Voca 5000-04", "lesson": "Lesson 03", "category": "verb"},
    ],
    5: [
        {"english": "accommodate", "korean": "수용하다", "book_name": "Power Voca 5000-05", "lesson": "Lesson 01", "category": "verb"},
        {"english": "controversial", "korean": "논란이 많은", "book_name": "Power Voca 5000-05", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "deteriorate", "korean": "악화되다", "book_name": "Power Voca 5000-05", "lesson": "Lesson 01", "category": "verb"},
        {"english": "exaggerate", "korean": "과장하다", "book_name": "Power Voca 5000-05", "lesson": "Lesson 02", "category": "verb"},
        {"english": "inevitable", "korean": "불가피한", "book_name": "Power Voca 5000-05", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "overwhelming", "korean": "압도적인", "book_name": "Power Voca 5000-05", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "phenomenon", "korean": "현상", "book_name": "Power Voca 5000-05", "lesson": "Lesson 03", "category": "noun"},
        {"english": "reluctant", "korean": "꺼리는", "book_name": "Power Voca 5000-05", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "significance", "korean": "중요성", "book_name": "Power Voca 5000-05", "lesson": "Lesson 03", "category": "noun"},
        {"english": "vulnerable", "korean": "취약한", "book_name": "Power Voca 5000-05", "lesson": "Lesson 03", "category": "adjective"},
    ],
    6: [
        {"english": "acquisition", "korean": "습득; 인수", "book_name": "Power Voca 5000-06", "lesson": "Lesson 01", "category": "noun"},
        {"english": "bureaucracy", "korean": "관료주의", "book_name": "Power Voca 5000-06", "lesson": "Lesson 01", "category": "noun"},
        {"english": "comprehend", "korean": "이해하다", "book_name": "Power Voca 5000-06", "lesson": "Lesson 01", "category": "verb"},
        {"english": "dilemma", "korean": "딜레마", "book_name": "Power Voca 5000-06", "lesson": "Lesson 02", "category": "noun"},
        {"english": "eloquent", "korean": "웅변의; 유창한", "book_name": "Power Voca 5000-06", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "fluctuate", "korean": "변동하다", "book_name": "Power Voca 5000-06", "lesson": "Lesson 02", "category": "verb"},
        {"english": "gratitude", "korean": "감사", "book_name": "Power Voca 5000-06", "lesson": "Lesson 03", "category": "noun"},
        {"english": "indigenous", "korean": "토착의", "book_name": "Power Voca 5000-06", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "jurisdiction", "korean": "관할권", "book_name": "Power Voca 5000-06", "lesson": "Lesson 03", "category": "noun"},
        {"english": "legitimate", "korean": "합법적인", "book_name": "Power Voca 5000-06", "lesson": "Lesson 03", "category": "adjective"},
    ],
    7: [
        {"english": "ambiguous", "korean": "모호한", "book_name": "Power Voca 5000-07", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "catastrophe", "korean": "대참사", "book_name": "Power Voca 5000-07", "lesson": "Lesson 01", "category": "noun"},
        {"english": "deliberate", "korean": "고의적인; 신중한", "book_name": "Power Voca 5000-07", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "exemplify", "korean": "예시하다", "book_name": "Power Voca 5000-07", "lesson": "Lesson 02", "category": "verb"},
        {"english": "formidable", "korean": "강력한; 어마어마한", "book_name": "Power Voca 5000-07", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "hierarchical", "korean": "위계적인", "book_name": "Power Voca 5000-07", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "imminent", "korean": "임박한", "book_name": "Power Voca 5000-07", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "meticulous", "korean": "꼼꼼한", "book_name": "Power Voca 5000-07", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "paradigm", "korean": "패러다임", "book_name": "Power Voca 5000-07", "lesson": "Lesson 03", "category": "noun"},
        {"english": "scrutinize", "korean": "면밀히 조사하다", "book_name": "Power Voca 5000-07", "lesson": "Lesson 03", "category": "verb"},
    ],
    8: [
        {"english": "alleviate", "korean": "완화하다", "book_name": "Power Voca 5000-08", "lesson": "Lesson 01", "category": "verb"},
        {"english": "consolidate", "korean": "통합하다", "book_name": "Power Voca 5000-08", "lesson": "Lesson 01", "category": "verb"},
        {"english": "discreet", "korean": "신중한", "book_name": "Power Voca 5000-08", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "expedite", "korean": "촉진하다", "book_name": "Power Voca 5000-08", "lesson": "Lesson 02", "category": "verb"},
        {"english": "impeccable", "korean": "흠잡을 데 없는", "book_name": "Power Voca 5000-08", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "perpetual", "korean": "영원한", "book_name": "Power Voca 5000-08", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "repercussion", "korean": "영향; 반향", "book_name": "Power Voca 5000-08", "lesson": "Lesson 03", "category": "noun"},
        {"english": "substantiate", "korean": "입증하다", "book_name": "Power Voca 5000-08", "lesson": "Lesson 03", "category": "verb"},
        {"english": "unprecedented", "korean": "전례 없는", "book_name": "Power Voca 5000-08", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "vindicate", "korean": "입증하다; 옹호하다", "book_name": "Power Voca 5000-08", "lesson": "Lesson 03", "category": "verb"},
    ],
    9: [
        {"english": "ameliorate", "korean": "개선하다", "book_name": "Power Voca 5000-09", "lesson": "Lesson 01", "category": "verb"},
        {"english": "belligerent", "korean": "호전적인", "book_name": "Power Voca 5000-09", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "clandestine", "korean": "비밀의", "book_name": "Power Voca 5000-09", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "dexterous", "korean": "손재주 있는", "book_name": "Power Voca 5000-09", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "ephemeral", "korean": "일시적인", "book_name": "Power Voca 5000-09", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "gregarious", "korean": "사교적인", "book_name": "Power Voca 5000-09", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "idiosyncratic", "korean": "특이한", "book_name": "Power Voca 5000-09", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "magnanimous", "korean": "관대한", "book_name": "Power Voca 5000-09", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "ostentatious", "korean": "과시하는", "book_name": "Power Voca 5000-09", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "quintessential", "korean": "전형적인", "book_name": "Power Voca 5000-09", "lesson": "Lesson 03", "category": "adjective"},
    ],
    10: [
        {"english": "acquiesce", "korean": "묵인하다", "book_name": "Power Voca 5000-10", "lesson": "Lesson 01", "category": "verb"},
        {"english": "conundrum", "korean": "난제", "book_name": "Power Voca 5000-10", "lesson": "Lesson 01", "category": "noun"},
        {"english": "ebullient", "korean": "열정 넘치는", "book_name": "Power Voca 5000-10", "lesson": "Lesson 01", "category": "adjective"},
        {"english": "fastidious", "korean": "까다로운", "book_name": "Power Voca 5000-10", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "inscrutable", "korean": "불가해한", "book_name": "Power Voca 5000-10", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "obsequious", "korean": "아첨하는", "book_name": "Power Voca 5000-10", "lesson": "Lesson 02", "category": "adjective"},
        {"english": "recalcitrant", "korean": "반항적인", "book_name": "Power Voca 5000-10", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "surreptitious", "korean": "은밀한", "book_name": "Power Voca 5000-10", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "ubiquitous", "korean": "어디에나 있는", "book_name": "Power Voca 5000-10", "lesson": "Lesson 03", "category": "adjective"},
        {"english": "veracious", "korean": "진실한", "book_name": "Power Voca 5000-10", "lesson": "Lesson 03", "category": "adjective"},
    ],
}


# ──────────────────────────────────────────────────────────────
# DB setup (reads DATABASE_URL from .env)
# ──────────────────────────────────────────────────────────────

def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Create DB engine from app config (reads .env)."""
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ──────────────────────────────────────────────────────────────
# Seed functions
# ──────────────────────────────────────────────────────────────

async def seed_teacher(session: AsyncSession) -> str:
    """Create teacher account. Returns teacher ID."""
    from app.models.user import User
    from app.core.security import get_password_hash

    result = await session.execute(
        select(User).where(User.username == TEACHER["username"])
    )
    existing = result.scalar_one_or_none()
    if existing:
        print(f"  [SKIP] Teacher already exists: {TEACHER['username']}")
        return existing.id

    teacher = User(
        username=TEACHER["username"],
        password_hash=get_password_hash(TEACHER["password"]),
        name=TEACHER["name"],
        role="teacher",
    )
    session.add(teacher)
    await session.flush()
    print(f"  [OK] Teacher created: {TEACHER['username']} / {TEACHER['password']}")
    return teacher.id


async def seed_students(session: AsyncSession, teacher_id: str):
    """Create student accounts under the teacher."""
    from app.models.user import User
    from app.core.security import get_password_hash

    for s in STUDENTS:
        result = await session.execute(
            select(User).where(User.username == s["username"])
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"  [SKIP] Student already exists: {s['username']}")
            continue

        student = User(
            username=s["username"],
            password_hash=get_password_hash(s["password"]),
            name=s["name"],
            role="student",
            teacher_id=teacher_id,
        )
        session.add(student)
        print(f"  [OK] Student created: {s['username']} / {s['password']} ({s['name']})")


async def seed_words(session: AsyncSession) -> int:
    """Seed word data if not already present."""
    from app.models.word import Word

    # Check if words already exist
    result = await session.execute(select(Word).limit(1))
    if result.scalar_one_or_none():
        # Count existing
        from sqlalchemy import func
        count_result = await session.execute(select(func.count(Word.id)))
        total = count_result.scalar()
        print(f"  [SKIP] Words already exist ({total} words in DB)")
        return total

    count = 0
    for level, words in WORDS_BY_LEVEL.items():
        for w in words:
            word = Word(
                english=w["english"],
                korean=w["korean"],
                level=level,
                category=w.get("category"),
                book_name=w.get("book_name", ""),
                lesson=w.get("lesson", ""),
            )
            session.add(word)
            count += 1

    print(f"  [OK] {count} words inserted (level 1-10)")
    return count


async def seed_test_configs(session: AsyncSession, teacher_id: str):
    """Create test configurations with per-student individual test codes."""
    from app.models.test_config import TestConfig
    from app.models.test_assignment import TestAssignment
    from app.models.user import User

    # Get student map
    student_result = await session.execute(
        select(User).where(User.role == "student", User.teacher_id == teacher_id)
    )
    students_map = {s.username: s for s in student_result.scalars().all()}

    for idx, tc in enumerate(TEST_CONFIGS):
        # Check if config already exists by name
        result = await session.execute(
            select(TestConfig).where(
                TestConfig.name == tc["name"],
                TestConfig.teacher_id == teacher_id,
            )
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"  [SKIP] Config already exists: {tc['name']}")
            continue

        config = TestConfig(
            teacher_id=teacher_id,
            name=tc["name"],
            test_code=None,
            test_type=tc["test_type"],
            question_count=tc["question_count"],
            time_limit_seconds=tc["time_limit_seconds"],
            level_range_min=tc["level_range_min"],
            level_range_max=tc["level_range_max"],
            is_active=True,
        )
        session.add(config)
        await session.flush()
        print(f"  [OK] Test config: {tc['name']}")

        # Create per-student assignments with fixed demo codes
        demo_codes = DEMO_CODES.get(idx, {})
        for username, code in demo_codes.items():
            student = students_map.get(username)
            if not student:
                continue

            assignment = TestAssignment(
                test_config_id=config.id,
                student_id=student.id,
                teacher_id=teacher_id,
                test_code=code,
            )
            session.add(assignment)
            print(f"       -> {student.name}({username}): {code}")


def print_summary():
    """Print login info and test codes."""
    print("\n" + "=" * 60)
    print("  SEED COMPLETE - READY TO USE!")
    print("=" * 60)

    print("\n  --- Teacher Account ---")
    print(f"  Username : {TEACHER['username']}")
    print(f"  Password : {TEACHER['password']}")

    print("\n  --- Student Accounts ---")
    for s in STUDENTS:
        print(f"  {s['username']} / {s['password']}  ({s['name']})")

    print("\n  --- Test Codes (per student) ---")
    for idx, tc in enumerate(TEST_CONFIGS):
        print(f"  [{tc['name']}]")
        print(f"    ({tc['test_type']}, {tc['question_count']}Q, {tc['time_limit_seconds']}s)")
        demo_codes = DEMO_CODES.get(idx, {})
        for username, code in demo_codes.items():
            student = next((s for s in STUDENTS if s["username"] == username), None)
            name = student["name"] if student else username
            print(f"    {name}({username}): {code}")
        print()

    print("  --- Quick Start ---")
    print("  1. Go to /test/start (no login required)")
    print("  2. Enter test code: TEST2AA1")
    print("  3. Test starts immediately!")
    print("=" * 60)


# ──────────────────────────────────────────────────────────────
# Main
# ──────────────────────────────────────────────────────────────

async def main():
    print("\n[Seed Demo] Connecting to database...\n")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] Failed to create DB connection: {e}")
        print("        Make sure .env has a valid DATABASE_URL")
        print("        Run from: cd backend && python scripts/seed_demo.py")
        sys.exit(1)

    async with SessionLocal() as session:
        try:
            # Test connection
            await session.execute(select(1))
            print("[OK] Database connected\n")
        except Exception as e:
            print(f"[ERROR] Cannot connect to database: {e}")
            sys.exit(1)

        # Step 1: Teacher
        print("Step 1: Teacher account")
        teacher_id = await seed_teacher(session)

        # Step 2: Students
        print("\nStep 2: Student accounts")
        await seed_students(session, teacher_id)

        # Step 3: Words
        print("\nStep 3: Word data")
        await seed_words(session)

        # Step 4: Test configs
        print("\nStep 4: Test configurations")
        await seed_test_configs(session, teacher_id)

        # Commit all at once
        await session.commit()
        print("\n[OK] All data committed to database!")

    print_summary()


if __name__ == "__main__":
    asyncio.run(main())
