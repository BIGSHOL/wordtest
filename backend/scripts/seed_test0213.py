"""One-off script: Apply mastery migration + create TEST0213 assignment.

- Adds assignment_type column + mastery tables if needed
- Creates TestConfig: 50Q, 10s/Q, placement, level 1-15
- Creates TestAssignment: TEST0213 for first available student

Usage:
    cd backend
    python scripts/seed_test0213.py
"""
import asyncio
import uuid
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def apply_migration(session: AsyncSession):
    """Apply mastery tables migration via raw SQL if not already applied."""

    # 1. Add assignment_type column if missing
    col_check = await session.execute(text("""
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'test_assignments' AND column_name = 'assignment_type'
    """))
    if not col_check.first():
        print("  [MIGRATE] Adding assignment_type column...")
        await session.execute(text("""
            ALTER TABLE test_assignments
            ADD COLUMN assignment_type VARCHAR(20) NOT NULL DEFAULT 'legacy'
        """))
        print("  [OK] assignment_type column added")
    else:
        print("  [SKIP] assignment_type column already exists")

    # 2. Create word_mastery table if missing
    tbl_check = await session.execute(text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'word_mastery'
    """))
    if not tbl_check.first():
        print("  [MIGRATE] Creating word_mastery table...")
        await session.execute(text("""
            CREATE TABLE word_mastery (
                id VARCHAR(36) PRIMARY KEY,
                student_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                word_id VARCHAR(36) NOT NULL REFERENCES words(id) ON DELETE CASCADE,
                assignment_id VARCHAR(36) REFERENCES test_assignments(id) ON DELETE SET NULL,
                stage INTEGER NOT NULL DEFAULT 1,
                total_attempts INTEGER NOT NULL DEFAULT 0,
                total_correct INTEGER NOT NULL DEFAULT 0,
                combo_best INTEGER NOT NULL DEFAULT 0,
                last_practiced_at TIMESTAMPTZ,
                mastered_at TIMESTAMPTZ,
                review_due_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                CONSTRAINT uq_mastery_student_word UNIQUE (student_id, word_id)
            )
        """))
        await session.execute(text("CREATE INDEX idx_mastery_student_id ON word_mastery (student_id)"))
        await session.execute(text("CREATE INDEX idx_mastery_student_stage ON word_mastery (student_id, stage)"))
        await session.execute(text("CREATE INDEX idx_mastery_assignment ON word_mastery (assignment_id)"))
        await session.execute(text("CREATE INDEX idx_mastery_review_due ON word_mastery (student_id, review_due_at)"))
        print("  [OK] word_mastery table created")
    else:
        print("  [SKIP] word_mastery table already exists")

    # 3. Create learning_sessions table if missing
    tbl_check = await session.execute(text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'learning_sessions'
    """))
    if not tbl_check.first():
        print("  [MIGRATE] Creating learning_sessions table...")
        await session.execute(text("""
            CREATE TABLE learning_sessions (
                id VARCHAR(36) PRIMARY KEY,
                student_id VARCHAR(36) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                assignment_id VARCHAR(36) NOT NULL REFERENCES test_assignments(id) ON DELETE CASCADE,
                current_stage INTEGER NOT NULL DEFAULT 1,
                words_practiced INTEGER NOT NULL DEFAULT 0,
                words_advanced INTEGER NOT NULL DEFAULT 0,
                words_demoted INTEGER NOT NULL DEFAULT 0,
                best_combo INTEGER NOT NULL DEFAULT 0,
                started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                completed_at TIMESTAMPTZ
            )
        """))
        await session.execute(text("CREATE INDEX idx_lsession_student ON learning_sessions (student_id)"))
        await session.execute(text("CREATE INDEX idx_lsession_assignment ON learning_sessions (assignment_id)"))
        print("  [OK] learning_sessions table created")
    else:
        print("  [SKIP] learning_sessions table already exists")

    # 4. Create learning_answers table if missing
    tbl_check = await session.execute(text("""
        SELECT table_name FROM information_schema.tables
        WHERE table_name = 'learning_answers'
    """))
    if not tbl_check.first():
        print("  [MIGRATE] Creating learning_answers table...")
        await session.execute(text("""
            CREATE TABLE learning_answers (
                id VARCHAR(36) PRIMARY KEY,
                session_id VARCHAR(36) NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
                word_mastery_id VARCHAR(36) NOT NULL REFERENCES word_mastery(id) ON DELETE CASCADE,
                word_id VARCHAR(36) NOT NULL REFERENCES words(id) ON DELETE RESTRICT,
                stage INTEGER NOT NULL,
                is_correct BOOLEAN NOT NULL,
                selected_answer VARCHAR(500),
                correct_answer VARCHAR(500) NOT NULL,
                time_taken_sec FLOAT,
                answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        """))
        await session.execute(text("CREATE INDEX idx_lanswer_session ON learning_answers (session_id)"))
        await session.execute(text("CREATE INDEX idx_lanswer_mastery ON learning_answers (word_mastery_id)"))
        print("  [OK] learning_answers table created")
    else:
        print("  [SKIP] learning_answers table already exists")

    await session.commit()


async def main():
    print("\n[TEST0213] Connecting to database...")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] DB connection failed: {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Connected\n")

        # Step 1: Apply migration
        print("Step 1: Apply mastery migration")
        await apply_migration(session)

        # Step 2: Check if TEST0213 already exists
        print("\nStep 2: Create TEST0213 assignment")
        existing = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = :code"),
            {"code": "TEST0213"},
        )
        if existing.first():
            print("[SKIP] TEST0213 already exists!")
            return

        # Step 3: Get teacher
        teacher_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'teacher' LIMIT 1")
        )
        teacher = teacher_row.first()
        if not teacher:
            print("[ERROR] No teacher found in DB.")
            sys.exit(1)
        print(f"  Teacher: {teacher.name} ({teacher.username})")

        # Step 4: Get any student
        student_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'student' LIMIT 1")
        )
        student = student_row.first()
        if not student:
            print("[ERROR] No student found in DB.")
            sys.exit(1)
        print(f"  Student: {student.name} ({student.username})")

        # Step 5: Create TestConfig
        config_id = str(uuid.uuid4())
        await session.execute(
            text("""
                INSERT INTO test_configs (
                    id, teacher_id, name, test_type, question_count,
                    time_limit_seconds, is_active, level_range_min, level_range_max,
                    per_question_time_seconds, question_types, created_at, updated_at
                ) VALUES (
                    :id, :teacher_id, :name, :test_type, :question_count,
                    :time_limit, :is_active, :lv_min, :lv_max,
                    :per_q_time, :q_types, now(), now()
                )
            """),
            {
                "id": config_id,
                "teacher_id": teacher.id,
                "name": "전체 적응형 배치고사 (Lv1-15, 50Q, 10s)",
                "test_type": "placement",
                "question_count": 50,
                "time_limit": 500,
                "is_active": True,
                "lv_min": 1,
                "lv_max": 15,
                "per_q_time": 10,
                "q_types": "word_meaning",
            },
        )
        print(f"  [OK] TestConfig created")

        # Step 6: Create TestAssignment
        assignment_id = str(uuid.uuid4())
        await session.execute(
            text("""
                INSERT INTO test_assignments (
                    id, test_config_id, student_id, teacher_id,
                    test_code, assignment_type, status, assigned_at
                ) VALUES (
                    :id, :config_id, :student_id, :teacher_id,
                    :test_code, :assignment_type, :status, now()
                )
            """),
            {
                "id": assignment_id,
                "config_id": config_id,
                "student_id": student.id,
                "teacher_id": teacher.id,
                "test_code": "TEST0213",
                "assignment_type": "mastery",
                "status": "pending",
            },
        )

        await session.commit()
        print(f"  [OK] TestAssignment created: TEST0213")

        # Count words in range
        word_count = await session.execute(
            text("SELECT COUNT(*) FROM words WHERE level >= 1 AND level <= 15")
        )
        total_words = word_count.scalar()

        print("\n" + "=" * 50)
        print("  TEST0213 READY!")
        print("=" * 50)
        print(f"  Code       : TEST0213")
        print(f"  Student    : {student.name} ({student.username})")
        print(f"  Type       : placement (적응형)")
        print(f"  Questions  : 50")
        print(f"  Time/Q     : 10 seconds")
        print(f"  Levels     : 1 ~ 15 (전체)")
        print(f"  Words in DB: {total_words}")
        print("=" * 50)


if __name__ == "__main__":
    asyncio.run(main())
