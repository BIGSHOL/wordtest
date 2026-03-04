"""
가상 학생 1명 생성 + 단어테스트 더미 결과 100개 시드.
등급별 20개씩:
  - 최상위 (90-100%): level 8-10, 6대축 고르게 높음
  - 상위   (75-89%):  level 6-7,  6대축 중상
  - 중간   (55-74%):  level 4-5,  6대축 중간
  - 하위   (30-54%):  level 2-3,  6대축 낮음
  - 최하위 (10-29%):  level 1,    6대축 매우 낮음

Usage:
    cd backend
    python -m scripts.seed_dummy_results
"""
import asyncio
import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer

KST = timezone(timedelta(hours=9))

# 6대축 엔진 매핑 (report_engine.py와 동일)
SKILL_ENGINES = {
    "meaning":       ["en_to_ko", "antonym_choice"],
    "association":   ["ko_to_en", "emoji"],
    "listening":     ["listen_en", "listen_ko"],
    "inference":     ["sentence"],
    "spelling":      ["listen_type", "ko_type", "antonym_type"],
    "comprehensive": ["sentence_type"],
}


def _uid():
    return str(uuid.uuid4())


def _code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


# 등급별 파라미터: (accuracy_range, level_range, combo_range, time_range, skill_accuracy_ranges)
TIERS = {
    "최상위": {
        "acc": (0.90, 1.00), "level": (8, 10), "combo": (8, 15),
        "time": (2.0, 5.0),
        "skills": {
            "meaning": (0.85, 1.0), "association": (0.80, 1.0),
            "listening": (0.85, 1.0), "inference": (0.75, 0.95),
            "spelling": (0.80, 1.0), "comprehensive": (0.75, 0.95),
        },
    },
    "상위": {
        "acc": (0.75, 0.89), "level": (6, 7), "combo": (5, 10),
        "time": (3.0, 7.0),
        "skills": {
            "meaning": (0.70, 0.90), "association": (0.65, 0.85),
            "listening": (0.70, 0.90), "inference": (0.60, 0.80),
            "spelling": (0.65, 0.85), "comprehensive": (0.55, 0.80),
        },
    },
    "중간": {
        "acc": (0.55, 0.74), "level": (4, 5), "combo": (3, 7),
        "time": (4.0, 10.0),
        "skills": {
            "meaning": (0.55, 0.75), "association": (0.45, 0.70),
            "listening": (0.50, 0.70), "inference": (0.40, 0.65),
            "spelling": (0.45, 0.65), "comprehensive": (0.35, 0.60),
        },
    },
    "하위": {
        "acc": (0.30, 0.54), "level": (2, 3), "combo": (1, 4),
        "time": (5.0, 15.0),
        "skills": {
            "meaning": (0.30, 0.55), "association": (0.25, 0.50),
            "listening": (0.25, 0.50), "inference": (0.20, 0.45),
            "spelling": (0.20, 0.45), "comprehensive": (0.15, 0.40),
        },
    },
    "최하위": {
        "acc": (0.10, 0.29), "level": (1, 1), "combo": (0, 2),
        "time": (6.0, 20.0),
        "skills": {
            "meaning": (0.10, 0.30), "association": (0.05, 0.25),
            "listening": (0.05, 0.25), "inference": (0.05, 0.20),
            "spelling": (0.05, 0.20), "comprehensive": (0.00, 0.15),
        },
    },
}

QUESTION_COUNT = 20  # 세션당 문제 수


def _generate_answers(tier_cfg: dict, session_id: str, word_ids: list[str],
                      mastery_ids: list[str], base_time: datetime) -> list[dict]:
    """등급별 6대축 정답률에 맞춰 LearningAnswer 레코드 생성."""
    answers = []
    skill_accs = tier_cfg["skills"]
    time_lo, time_hi = tier_cfg["time"]

    # 6대축별 엔진 분배: 20문제를 6개 축에 나눔
    engine_schedule = []
    for skill, engines in SKILL_ENGINES.items():
        count = 3 if skill != "comprehensive" else 2  # 3*5 + 2 = 17 → 나머지 3개 추가
        for _ in range(count):
            engine_schedule.append((skill, random.choice(engines)))
    # 20문제 채우기
    while len(engine_schedule) < QUESTION_COUNT:
        skill = random.choice(list(SKILL_ENGINES.keys()))
        engine_schedule.append((skill, random.choice(SKILL_ENGINES[skill])))
    random.shuffle(engine_schedule)
    engine_schedule = engine_schedule[:QUESTION_COUNT]

    for i, (skill, engine) in enumerate(engine_schedule):
        acc_lo, acc_hi = skill_accs[skill]
        is_correct = random.random() < random.uniform(acc_lo, acc_hi)
        time_taken = round(random.uniform(time_lo, time_hi), 1)

        answers.append({
            "id": _uid(),
            "session_id": session_id,
            "word_mastery_id": mastery_ids[i % len(mastery_ids)],
            "word_id": word_ids[i % len(word_ids)],
            "stage": random.randint(1, 3),
            "is_correct": is_correct,
            "selected_answer": "정답" if is_correct else "오답",
            "correct_answer": "정답",
            "time_taken_sec": time_taken,
            "answered_at": base_time + timedelta(seconds=i * time_taken),
            "question_type": engine,
        })

    return answers


async def main():
    async with AsyncSessionLocal() as db:
        # 1. 선생님 찾기 (첫 번째 teacher)
        result = await db.execute(
            select(User).where(User.role == "teacher").limit(1)
        )
        teacher = result.scalar_one_or_none()
        if not teacher:
            print("ERROR: 선생님 계정이 없습니다. 먼저 선생님을 등록하세요.")
            return

        print(f"선생님: {teacher.name} ({teacher.id})")

        # 2. 가상 학생 생성 (이미 있으면 재사용)
        existing = await db.execute(
            select(User).where(User.username == "dummy_tester")
        )
        student = existing.scalar_one_or_none()
        if student:
            student_id = student.id
            print(f"기존 가상 학생 재사용: {student.name} ({student_id})")
        else:
            student_id = _uid()
            student = User(
                id=student_id,
                username="dummy_tester",
                password_hash="$2b$12$dummy_hash_not_loginable_xxxxxxxxxxxxxxxxxxxxxx",
                name="테스트 가상학생",
                role="student",
                teacher_id=teacher.id,
                school_name="가상중학교",
                grade="중2",
            )
            db.add(student)
            await db.flush()
            print(f"가상 학생 생성: {student.name} ({student_id})")

        # 3. (TestConfig는 세션마다 개별 생성 — uq_assignment_config_student 제약)

        # 4. 단어 20개 가져오기 (word_mastery/answer 참조용)
        word_result = await db.execute(
            text("SELECT id FROM words LIMIT 20")
        )
        word_ids = [r[0] for r in word_result.fetchall()]
        if len(word_ids) < 20:
            print(f"ERROR: words 테이블에 단어가 {len(word_ids)}개뿐입니다. 최소 20개 필요.")
            await db.rollback()
            return
        print(f"단어 {len(word_ids)}개 로드")

        # 5. WordMastery 레코드 생성 (이미 있으면 재사용)
        mastery_ids = []
        for wid in word_ids:
            existing_m = await db.execute(
                select(WordMastery).where(
                    WordMastery.student_id == student_id,
                    WordMastery.word_id == wid,
                )
            )
            m = existing_m.scalar_one_or_none()
            if m:
                mastery_ids.append(m.id)
            else:
                mid = _uid()
                mastery_ids.append(mid)
                db.add(WordMastery(
                    id=mid,
                    student_id=student_id,
                    word_id=wid,
                    stage=1,
                    stage_streak=0,
                    total_attempts=0,
                    total_correct=0,
                    combo_best=0,
                ))
        await db.flush()

        # 6. 등급별 20개씩, 총 100개 세션 생성
        now = datetime.now(KST)
        session_count = 0

        for tier_name, tier_cfg in TIERS.items():
            for i in range(20):
                # 시간을 과거로 분산 (최근 30일)
                days_ago = random.uniform(0, 30)
                started_at = now - timedelta(days=days_ago)
                duration_sec = random.randint(120, 600)
                completed_at = started_at + timedelta(seconds=duration_sec)

                level = random.randint(*tier_cfg["level"])
                combo = random.randint(*tier_cfg["combo"])

                # TestAssignment 생성
                assign_id = _uid()
                # TestConfig 생성 (세션별 개별 — unique 제약 회피)
                config_id = _uid()
                db.add(TestConfig(
                    id=config_id,
                    teacher_id=teacher.id,
                    name=f"더미 단어테스트 {tier_name}-{i+1:02d}",
                    test_type="periodic",
                    question_count=QUESTION_COUNT,
                    time_limit_seconds=300,
                    book_name="기본영단어 1200-01",
                    level_range_min=1,
                    level_range_max=10,
                    question_types="en_to_ko,ko_to_en,listen_en,listen_ko,sentence,ko_type,listen_type,emoji,antonym_choice,antonym_type,sentence_type",
                ))
                await db.flush()

                # TestAssignment 생성 → flush (FK: session 참조)
                assign_id = _uid()
                db.add(TestAssignment(
                    id=assign_id,
                    test_config_id=config_id,
                    student_id=student_id,
                    teacher_id=teacher.id,
                    test_code=_code(),
                    assignment_type="mastery",
                    status="completed",
                    completed_at=completed_at,
                ))
                await db.flush()

                # LearningSession 생성 → flush (FK: answers 참조)
                sess_id = _uid()
                answers_data = _generate_answers(
                    tier_cfg, sess_id, word_ids, mastery_ids, started_at
                )
                correct_count = sum(1 for a in answers_data if a["is_correct"])
                words_advanced = max(0, correct_count - QUESTION_COUNT // 2)
                words_demoted = max(0, (QUESTION_COUNT - correct_count) - QUESTION_COUNT // 3)

                db.add(LearningSession(
                    id=sess_id,
                    student_id=student_id,
                    assignment_id=assign_id,
                    current_stage=min(5, max(1, level // 2)),
                    current_level=level,
                    words_practiced=QUESTION_COUNT,
                    words_advanced=words_advanced,
                    words_demoted=words_demoted,
                    best_combo=combo,
                    started_at=started_at,
                    completed_at=completed_at,
                ))
                await db.flush()

                # LearningAnswer 레코드들 생성
                for a in answers_data:
                    db.add(LearningAnswer(**a))
                await db.flush()

                session_count += 1

            print(f"  [{tier_name}] 20개 세션 생성 완료")

        await db.commit()
        print(f"\n완료! 총 {session_count}개 더미 결과 생성됨.")
        print(f"  학생: {student.name} (username: dummy_tester)")
        print(f"  세션당 {QUESTION_COUNT}문제 × {session_count}세션 = {QUESTION_COUNT * session_count}개 답변")


if __name__ == "__main__":
    asyncio.run(main())
