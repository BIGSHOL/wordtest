"""Seed script - Creates a completed dummy mastery report for TEST0213.

Inserts: TestConfig, TestAssignment, LearningSession, WordMastery, LearningAnswer
Student: student01 (김민수, 중1)
Result: Level 4 (Gold), ~75% accuracy, 40 questions

Usage:
    cd backend
    python scripts/seed_report_test0213.py
"""
import asyncio
import uuid
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
import random

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

KST = timezone(timedelta(hours=9))
NOW = datetime.now(KST)
TEST_CODE = "TEST0213"

# Target stats
TARGET_LEVEL = 4         # Gold
TARGET_QUESTIONS = 40
TARGET_ACCURACY = 0.725  # ~72.5%


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def cleanup_existing(db: AsyncSession):
    """Remove existing TEST0213 data if re-running."""
    from app.models.test_assignment import TestAssignment
    from app.models.learning_session import LearningSession
    from app.models.learning_answer import LearningAnswer
    from app.models.word_mastery import WordMastery

    result = await db.execute(
        select(TestAssignment).where(TestAssignment.test_code == TEST_CODE)
    )
    existing = result.scalar_one_or_none()
    if not existing:
        return

    print(f"  [CLEANUP] Removing existing {TEST_CODE} data...")

    sessions = await db.execute(
        select(LearningSession).where(LearningSession.assignment_id == existing.id)
    )
    for sess in sessions.scalars().all():
        await db.execute(
            delete(LearningAnswer).where(LearningAnswer.session_id == sess.id)
        )
        await db.execute(
            delete(LearningSession).where(LearningSession.id == sess.id)
        )

    await db.execute(
        delete(WordMastery).where(WordMastery.assignment_id == existing.id)
    )

    # Also delete the test_config
    config_id = existing.test_config_id
    await db.execute(
        delete(TestAssignment).where(TestAssignment.id == existing.id)
    )
    from app.models.test_config import TestConfig
    await db.execute(
        delete(TestConfig).where(TestConfig.id == config_id)
    )
    print(f"  [CLEANUP] Done")


def build_answer_script(words_by_level: dict[int, list]) -> list[dict]:
    """Build a realistic answer script from actual DB words.

    Simulates a student progressing from level 1 to level 4.
    Earlier levels have higher accuracy, later levels have more mistakes.
    """
    answers = []

    # Distribution: 10 from lv1, 10 from lv2, 10 from lv3, 10 from lv4
    level_config = [
        (1, 10, 0.90, (1.5, 3.0)),   # level, count, accuracy, time_range
        (2, 10, 0.80, (2.5, 4.5)),
        (3, 10, 0.70, (3.5, 6.0)),
        (4, 10, 0.50, (5.0, 9.0)),
    ]

    for level, count, acc, (t_min, t_max) in level_config:
        available = words_by_level.get(level, [])
        if not available:
            # Try adjacent levels
            for alt in [level - 1, level + 1, level - 2, level + 2]:
                available = words_by_level.get(alt, [])
                if available:
                    level = alt
                    break

        if not available:
            continue

        selected = random.sample(available, min(count, len(available)))

        # Determine which answers are correct
        n_correct = round(len(selected) * acc)
        correct_indices = set(random.sample(range(len(selected)), n_correct))

        for i, word in enumerate(selected):
            is_correct = i in correct_indices
            time_sec = round(random.uniform(t_min, t_max), 1)

            answers.append({
                "word": word,
                "is_correct": is_correct,
                "time_sec": time_sec,
                "stage": level,
            })

    return answers


async def main():
    from app.models.user import User
    from app.models.word import Word
    from app.models.test_config import TestConfig
    from app.models.test_assignment import TestAssignment
    from app.models.learning_session import LearningSession
    from app.models.learning_answer import LearningAnswer
    from app.models.word_mastery import WordMastery

    print(f"\n[Seed Report] Creating dummy report for {TEST_CODE}...\n")

    SessionLocal = get_session_factory()
    async with SessionLocal() as db:
        await db.execute(select(1))
        print("[OK] Database connected\n")

        await cleanup_existing(db)

        # Step 1: Find teacher and student
        teacher_result = await db.execute(
            select(User).where(User.username == "demo_teacher")
        )
        teacher = teacher_result.scalar_one_or_none()
        if not teacher:
            print("[ERROR] Teacher 'demo_teacher' not found. Run seed_demo.py first.")
            sys.exit(1)

        student_result = await db.execute(
            select(User).where(User.username == "student01")
        )
        student = student_result.scalar_one_or_none()
        if not student:
            print("[ERROR] Student 'student01' not found. Run seed_demo.py first.")
            sys.exit(1)

        print(f"  Teacher: {teacher.name} ({teacher.username})")
        print(f"  Student: {student.name} ({student.username}) - {student.grade}")

        # Step 2: Load words from DB by level (1-5)
        words_result = await db.execute(
            select(Word).where(Word.level.between(1, 5)).order_by(Word.level, func.random())
        )
        all_words = words_result.scalars().all()

        words_by_level: dict[int, list] = {}
        for w in all_words:
            words_by_level.setdefault(w.level, []).append(w)

        total_available = sum(len(v) for v in words_by_level.items() if isinstance(v, list))
        print(f"  Words available by level:")
        for lv in sorted(words_by_level.keys()):
            print(f"    Level {lv}: {len(words_by_level[lv])} words")

        if not words_by_level:
            print("[ERROR] No words found in DB for levels 1-5.")
            sys.exit(1)

        # Step 3: Build answer script from actual words
        random.seed(213)  # Reproducible
        answer_script = build_answer_script(words_by_level)

        if len(answer_script) < 10:
            print(f"[ERROR] Only {len(answer_script)} answers generated. Need at least 10 words.")
            sys.exit(1)

        total_correct = sum(1 for a in answer_script if a["is_correct"])
        total_wrong = len(answer_script) - total_correct
        print(f"\n  Answer script: {len(answer_script)} questions, "
              f"{total_correct} correct ({total_correct/len(answer_script)*100:.1f}%)")

        # Step 4: Create TestConfig
        config_id = str(uuid.uuid4())
        config = TestConfig(
            id=config_id,
            teacher_id=teacher.id,
            name="2월 배치고사 (TEST0213)",
            test_type="placement",
            question_count=50,
            time_limit_seconds=600,
            level_range_min=1,
            level_range_max=5,
            is_active=True,
        )
        db.add(config)
        await db.flush()
        print(f"\n  [OK] TestConfig: {config.name}")

        # Step 5: Create TestAssignment
        assignment_id = str(uuid.uuid4())
        assignment = TestAssignment(
            id=assignment_id,
            test_config_id=config_id,
            student_id=student.id,
            teacher_id=teacher.id,
            test_code=TEST_CODE,
            assignment_type="mastery",
            status="completed",
            assigned_at=NOW - timedelta(hours=2),
            completed_at=NOW - timedelta(minutes=10),
        )
        db.add(assignment)
        await db.flush()
        print(f"  [OK] TestAssignment: {TEST_CODE}")

        # Step 6: Create LearningSession
        session_id = str(uuid.uuid4())

        best_combo = 0
        current_combo = 0
        for a in answer_script:
            if a["is_correct"]:
                current_combo += 1
                best_combo = max(best_combo, current_combo)
            else:
                current_combo = 0

        session_start = NOW - timedelta(minutes=25)
        learning_session = LearningSession(
            id=session_id,
            student_id=student.id,
            assignment_id=assignment_id,
            current_stage=3,
            current_level=TARGET_LEVEL,
            words_practiced=len(answer_script),
            words_advanced=total_correct,
            words_demoted=total_wrong,
            best_combo=best_combo,
            started_at=session_start,
            completed_at=NOW - timedelta(minutes=10),
        )
        db.add(learning_session)
        await db.flush()
        print(f"  [OK] LearningSession: level={TARGET_LEVEL}, combo={best_combo}")

        # Step 7: Create WordMastery + LearningAnswer
        answer_time = session_start + timedelta(seconds=5)
        all_words_in_script = [a["word"] for a in answer_script]

        for a in answer_script:
            word = a["word"]
            is_correct = a["is_correct"]
            time_sec = a["time_sec"]
            stage = a["stage"]

            # Create WordMastery
            mastery_check = await db.execute(
                select(WordMastery).where(
                    WordMastery.student_id == student.id,
                    WordMastery.word_id == word.id,
                )
            )
            mastery = mastery_check.scalar_one_or_none()

            if not mastery:
                final_stage = min(stage + (1 if is_correct else 0), 5)
                mastery = WordMastery(
                    id=str(uuid.uuid4()),
                    student_id=student.id,
                    word_id=word.id,
                    assignment_id=assignment_id,
                    stage=final_stage,
                    stage_streak=1 if is_correct else 0,
                    total_attempts=1,
                    total_correct=1 if is_correct else 0,
                    combo_best=1 if is_correct else 0,
                    last_practiced_at=answer_time,
                    mastered_at=answer_time if final_stage >= 5 else None,
                    created_at=answer_time,
                    updated_at=answer_time,
                )
                db.add(mastery)
                await db.flush()

            # Determine answers
            correct_answer = word.korean
            if is_correct:
                selected_answer = correct_answer
            else:
                # Pick wrong answer from same level
                same_level = [w for w in all_words_in_script
                              if w.level == word.level and w.id != word.id]
                if same_level:
                    selected_answer = random.choice(same_level).korean
                else:
                    selected_answer = "모르겠어요"

            answer = LearningAnswer(
                id=str(uuid.uuid4()),
                session_id=session_id,
                word_mastery_id=mastery.id,
                word_id=word.id,
                stage=stage,
                is_correct=is_correct,
                selected_answer=selected_answer,
                correct_answer=correct_answer,
                time_taken_sec=time_sec,
                answered_at=answer_time,
            )
            db.add(answer)
            answer_time += timedelta(seconds=time_sec + random.uniform(0.5, 2.0))

        await db.flush()
        print(f"  [OK] {len(answer_script)} LearningAnswers created")
        print(f"  [OK] WordMastery records created")

        await db.commit()
        print("\n[OK] All data committed!\n")

        # Summary
        accuracy = total_correct / len(answer_script) * 100
        avg_time = sum(a["time_sec"] for a in answer_script) / len(answer_script)
        total_time = sum(a["time_sec"] for a in answer_script)

        print("=" * 55)
        print(f"  DUMMY REPORT: {TEST_CODE}")
        print("=" * 55)
        print(f"  Student   : {student.name} ({student.grade})")
        print(f"  Level     : {TARGET_LEVEL} (Gold)")
        print(f"  Questions : {len(answer_script)}")
        print(f"  Correct   : {total_correct}/{len(answer_script)} ({accuracy:.1f}%)")
        print(f"  Best Combo: {best_combo}")
        print(f"  Avg Time  : {avg_time:.1f}s")
        print(f"  Total Time: {total_time:.0f}s ({total_time/60:.1f}min)")
        print(f"  Session ID: {session_id}")
        print(f"  Student ID: {student.id}")
        print("=" * 55)
        print(f"\n  View report:")
        print(f"  /mastery-report/{student.id}/{session_id}")
        print()


if __name__ == "__main__":
    asyncio.run(main())
