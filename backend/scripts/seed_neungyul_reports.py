"""
Seed 3 능률 VOCA mastery report results using existing students.
Creates: TestAssignment → LearningSession → LearningAnswer records.

Usage:
    cd backend
    PYTHONPATH=. python -m scripts.seed_neungyul_reports
"""
import asyncio
import random
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import text
from app.db.session import AsyncSessionLocal

KST = timezone(timedelta(hours=9))

QUESTION_TYPES = [
    "en_to_ko", "ko_to_en", "listen_en", "listen_ko",
    "ko_type", "sentence", "emoji", "antonym_choice",
]

# 3 scenarios: low level + low accuracy, low level + high accuracy, high level + high accuracy
SCENARIOS = [
    {
        "label": "기초 (level 3, accuracy ~40%)",
        "level": 3,
        "target_accuracy": 0.40,
        "book_filter": "능률 VOCA 중등 기본",
    },
    {
        "label": "기초 확장 (level 3, accuracy ~65%)",
        "level": 3,
        "target_accuracy": 0.65,
        "book_filter": "능률 VOCA 중등 기본 파생어",
    },
    {
        "label": "심화 확장 (level 5, accuracy ~70%)",
        "level": 5,
        "target_accuracy": 0.70,
        "book_filter": "능률 VOCA 중등 고난도",
    },
]


async def main():
    async with AsyncSessionLocal() as db:
        # Get 3 students
        r = await db.execute(text(
            "SELECT id FROM users WHERE role='student' ORDER BY username LIMIT 3"
        ))
        student_ids = [row[0] for row in r.fetchall()]
        if len(student_ids) < 3:
            print(f"ERROR: Need 3 students, found {len(student_ids)}")
            return

        # Get teacher
        r = await db.execute(text(
            "SELECT id FROM users WHERE role='teacher' LIMIT 1"
        ))
        teacher_id = r.scalar()

        # Get 능률 config
        r = await db.execute(text(
            "SELECT id FROM test_configs WHERE book_name LIKE '%능률%' LIMIT 1"
        ))
        config_id = r.scalar()
        if not config_id:
            print("ERROR: No 능률 TestConfig found")
            return

        print(f"Teacher: {teacher_id}")
        print(f"Config: {config_id}")
        print(f"Students: {student_ids}")
        print()

        for i, (student_id, scenario) in enumerate(zip(student_ids, SCENARIOS)):
            print(f"--- Scenario {i+1}: {scenario['label']} ---")
            print(f"  Student: {student_id}")

            # Get 50 words from the target book
            r = await db.execute(text(
                "SELECT id, english, korean FROM words "
                "WHERE book_name = :book LIMIT 50"
            ), {"book": scenario["book_filter"]})
            words = r.fetchall()
            if len(words) < 50:
                print(f"  WARNING: Only {len(words)} words for {scenario['book_filter']}")

            num_questions = min(50, len(words))
            target_correct = int(num_questions * scenario["target_accuracy"])

            # Create test code (max 8 chars)
            test_code = f"NR{i+1:02d}{random.randint(100,999)}"

            # 1. Create TestAssignment
            assignment_id = str(uuid.uuid4())
            now = datetime.now(KST)
            await db.execute(text("""
                INSERT INTO test_assignments
                    (id, test_config_id, student_id, teacher_id, status,
                     assigned_at, completed_at, test_code, assignment_type, engine_type)
                VALUES
                    (:id, :config_id, :student_id, :teacher_id, 'completed',
                     :assigned_at, :completed_at, :test_code, 'word', 'levelup')
            """), {
                "id": assignment_id,
                "config_id": config_id,
                "student_id": student_id,
                "teacher_id": teacher_id,
                "assigned_at": now - timedelta(hours=1),
                "completed_at": now,
                "test_code": test_code,
            })
            print(f"  Assignment: {assignment_id} (code: {test_code})")

            # 2. Create LearningSession
            session_id = str(uuid.uuid4())
            correct_count = target_correct
            wrong_count = num_questions - correct_count
            await db.execute(text("""
                INSERT INTO learning_sessions
                    (id, student_id, assignment_id, current_stage, current_level,
                     words_practiced, words_advanced, words_demoted, best_combo,
                     started_at, completed_at)
                VALUES
                    (:id, :student_id, :assignment_id, 2, :level,
                     :practiced, :advanced, :demoted, :combo,
                     :started, :completed)
            """), {
                "id": session_id,
                "student_id": student_id,
                "assignment_id": assignment_id,
                "level": scenario["level"],
                "practiced": num_questions,
                "advanced": max(0, correct_count - 5),
                "demoted": max(0, wrong_count - 3),
                "combo": random.randint(3, min(12, correct_count)),
                "started": now - timedelta(minutes=15),
                "completed": now,
            })
            print(f"  Session: {session_id} (level={scenario['level']})")

            # 3. Create LearningAnswers
            # Shuffle correctness
            correctness = [True] * correct_count + [False] * wrong_count
            random.shuffle(correctness)

            for j, (word_row, is_correct) in enumerate(zip(words[:num_questions], correctness)):
                word_id, english, korean = word_row
                qt = random.choice(QUESTION_TYPES)
                time_taken = round(random.uniform(2.0, 12.0), 1)
                answered_at = now - timedelta(minutes=15) + timedelta(seconds=j * 18)

                if is_correct:
                    selected = english if "en" in qt or "type" in qt else korean
                else:
                    selected = "wrong_answer"

                await db.execute(text("""
                    INSERT INTO learning_answers
                        (id, session_id, word_id, stage, is_correct,
                         selected_answer, correct_answer, time_taken_sec,
                         answered_at, question_type)
                    VALUES
                        (:id, :session_id, :word_id, :stage, :is_correct,
                         :selected, :correct, :time_sec,
                         :answered_at, :qt)
                """), {
                    "id": str(uuid.uuid4()),
                    "session_id": session_id,
                    "word_id": word_id,
                    "stage": random.randint(1, 3),
                    "is_correct": is_correct,
                    "selected": selected,
                    "correct": english,
                    "time_sec": time_taken,
                    "answered_at": answered_at,
                    "qt": qt,
                })

            accuracy = correct_count / num_questions * 100
            print(f"  Answers: {num_questions} ({correct_count} correct, {accuracy:.0f}%)")
            print(f"  → Expected neungyul_rank via report engine")
            print()

        await db.commit()
        print("=== Done! 3 능률 VOCA reports seeded. ===")
        print("View at: /students/{student_id}/mastery/{session_id}")


if __name__ == "__main__":
    asyncio.run(main())
