"""Create TEST0220 + TEST0219 assignments for emoji & listening engine testing.

TEST0220  : 50Q placement test, Lv1-5, mixed question types (emoji auto-triggers)
TEST0219  : Listening test, Lv1-3, hear pronunciation → pick English word

Assigns both codes to a random student under the first available teacher.

Usage:
    cd backend
    python scripts/seed_test0220.py
"""
import asyncio
import uuid
import random
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


async def main():
    print("\n[Seed TEST0220] Connecting to database...\n")

    try:
        SessionLocal = get_session_factory()
    except Exception as e:
        print(f"[ERROR] {e}")
        sys.exit(1)

    async with SessionLocal() as session:
        await session.execute(text("SELECT 1"))
        print("[OK] Database connected\n")

        # 1. Find teacher
        teacher_row = await session.execute(
            text("SELECT id, name, username FROM users WHERE role = 'teacher' ORDER BY created_at LIMIT 1")
        )
        teacher = teacher_row.first()
        if not teacher:
            print("[ERROR] No teacher found in DB")
            sys.exit(1)
        print(f"  Teacher: {teacher.name} ({teacher.username})")

        # 2. Find students under this teacher
        student_rows = await session.execute(
            text("SELECT id, name, username FROM users WHERE teacher_id = :tid AND role = 'student' ORDER BY username"),
            {"tid": teacher.id},
        )
        students = student_rows.all()
        if not students:
            print("[ERROR] No students found")
            sys.exit(1)

        student = random.choice(students)
        print(f"  Student: {student.name} ({student.username})\n")

        # ─── TEST0220: Level Test with Emoji ────────────────────────────
        existing = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = 'TEST0220' LIMIT 1")
        )
        if existing.first():
            print("[SKIP] TEST0220 already exists")
        else:
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
                    "name": "Emoji Level Test (50Q, Lv1-5)",
                    "test_type": "placement",
                    "question_count": 50,
                    "time_limit": 750,
                    "is_active": True,
                    "lv_min": 1,
                    "lv_max": 5,
                    "per_q_time": 12,
                    "q_types": "word_meaning,meaning_word,sentence_blank",
                },
            )

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
                    "test_code": "TEST0220",
                    "assignment_type": "level_test",
                    "status": "pending",
                },
            )
            print("[OK] TEST0220 created")
            print("     Type: placement (level test + emoji)")
            print("     Questions: 50, Lv1-5, 12s/Q")
            print("     Q-types: word_meaning, meaning_word, sentence_blank")
            print("     (meaning_word -> 35% emoji auto-trigger)\n")

        # ─── TEST0219: Listening Test ────────────────────────────────────
        existing_l = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = 'TEST0219' LIMIT 1")
        )
        if existing_l.first():
            print("[SKIP] TEST0219 already exists")
        else:
            config_l_id = str(uuid.uuid4())
            await session.execute(
                text("""
                    INSERT INTO test_configs (
                        id, teacher_id, name, test_type, question_count,
                        time_limit_seconds, is_active, level_range_min, level_range_max,
                        per_question_time_seconds, question_types,
                        book_name, lesson_range_start, lesson_range_end,
                        created_at, updated_at
                    ) VALUES (
                        :id, :teacher_id, :name, :test_type, :question_count,
                        :time_limit, :is_active, :lv_min, :lv_max,
                        :per_q_time, :q_types,
                        :book_name, :lesson_start, :lesson_end,
                        now(), now()
                    )
                """),
                {
                    "id": config_l_id,
                    "teacher_id": teacher.id,
                    "name": "Listening Test (Lv1-3, Book01)",
                    "test_type": "listening",
                    "question_count": 50,
                    "time_limit": 600,
                    "is_active": True,
                    "lv_min": 1,
                    "lv_max": 3,
                    "per_q_time": 8,
                    "q_types": "listening",
                    "book_name": "Power Voca 5000-01",
                    "lesson_start": "Lesson 01",
                    "lesson_end": "Lesson 10",
                },
            )

            assignment_l_id = str(uuid.uuid4())
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
                    "id": assignment_l_id,
                    "config_id": config_l_id,
                    "student_id": student.id,
                    "teacher_id": teacher.id,
                    "test_code": "TEST0219",
                    "assignment_type": "listening",
                    "status": "pending",
                },
            )
            print("[OK] TEST0219 created")
            print("     Type: listening (hear & pick word)")
            print("     Book: Power Voca 5000-01, Lesson 01-10")
            print("     Lv1-3, 8s/Q\n")

        # ─── TEST0218: Mixed Test (All question types) ──────────────────
        existing_m = await session.execute(
            text("SELECT id FROM test_assignments WHERE test_code = 'TEST0218' LIMIT 1")
        )
        if existing_m.first():
            print("[SKIP] TEST0218 already exists")
        else:
            config_m_id = str(uuid.uuid4())
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
                    "id": config_m_id,
                    "teacher_id": teacher.id,
                    "name": "Mixed Test - All Types (50Q, Lv1-5)",
                    "test_type": "placement",
                    "question_count": 50,
                    "time_limit": 750,
                    "is_active": True,
                    "lv_min": 1,
                    "lv_max": 5,
                    "per_q_time": 12,
                    "q_types": "word_meaning,meaning_word,sentence_blank,listening",
                },
            )

            assignment_m_id = str(uuid.uuid4())
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
                    "id": assignment_m_id,
                    "config_id": config_m_id,
                    "student_id": student.id,
                    "teacher_id": teacher.id,
                    "test_code": "TEST0218",
                    "assignment_type": "level_test",
                    "status": "pending",
                },
            )
            print("[OK] TEST0218 created")
            print("     Type: placement (MIXED - all question types)")
            print("     Questions: 50, Lv1-5, 12s/Q")
            print("     Q-types: word_meaning, meaning_word, sentence_blank, listening")
            print("     (meaning_word -> 35% emoji auto-trigger)\n")

        await session.commit()

        # Summary
        word_count = await session.execute(
            text("SELECT COUNT(*) FROM words WHERE level >= 1 AND level <= 5")
        )
        total_lv = word_count.scalar()

        word_count_l = await session.execute(
            text("""
                SELECT COUNT(*) FROM words
                WHERE book_name = 'Power Voca 5000-01'
                AND lesson >= 'Lesson 01' AND lesson <= 'Lesson 10'
            """)
        )
        total_listening = word_count_l.scalar()

        print("=" * 55)
        print("  TEST0218 / TEST0219 / TEST0220 READY!")
        print("=" * 55)
        print(f"  Student     : {student.name} ({student.username})")
        print(f"")
        print(f"  TEST0218    : MIXED (All Types)")
        print(f"    50Q, Lv1-5, 12s/Q, placement")
        print(f"    word_meaning / meaning_word(+emoji) / sentence_blank / listening")
        print(f"    Words pool : {total_lv}")
        print(f"")
        print(f"  TEST0219    : Listening Only")
        print(f"    Book01 Lesson01-10, Lv1-3, 8s/Q")
        print(f"    Words pool : {total_listening}")
        print(f"")
        print(f"  TEST0220    : Level Test + Emoji")
        print(f"    50Q, Lv1-5, 12s/Q, placement")
        print(f"    word_meaning / meaning_word / sentence_blank")
        print(f"    Words pool : {total_lv}")
        print("=" * 55)


if __name__ == "__main__":
    asyncio.run(main())