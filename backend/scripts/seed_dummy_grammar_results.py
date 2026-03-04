"""
가상 학생(dummy_tester) 재사용 + 문법테스트 더미 결과 100개 시드.
등급별 20개씩:
  - 최상위 (90-100%): 거의 전부 정답
  - 상위   (75-89%):  대부분 정답
  - 중간   (55-74%):  절반 이상 정답
  - 하위   (30-54%):  절반 이하 정답
  - 최하위 (10-29%):  대부분 오답

Usage:
    cd backend
    python -m scripts.seed_dummy_grammar_results
"""
import asyncio
import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, func, text
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.grammar_config import GrammarConfig
from app.models.test_assignment import TestAssignment
from app.models.grammar_session import GrammarSession
from app.models.grammar_answer import GrammarAnswer

KST = timezone(timedelta(hours=9))

QUESTION_COUNT = 20  # 세션당 문제 수


def _uid():
    return str(uuid.uuid4())


def _code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


# 등급별 파라미터: (accuracy_range, time_range_per_question)
TIERS = {
    "최상위": {"acc": (0.90, 1.00), "time": (3.0, 8.0)},
    "상위":   {"acc": (0.75, 0.89), "time": (5.0, 12.0)},
    "중간":   {"acc": (0.55, 0.74), "time": (8.0, 20.0)},
    "하위":   {"acc": (0.30, 0.54), "time": (10.0, 25.0)},
    "최하위": {"acc": (0.10, 0.29), "time": (12.0, 30.0)},
}


def _generate_grammar_answers(
    tier_cfg: dict,
    session_id: str,
    questions: list[dict],
    base_time: datetime,
) -> list[dict]:
    """등급별 정답률에 맞춰 GrammarAnswer 레코드 생성."""
    acc_lo, acc_hi = tier_cfg["acc"]
    time_lo, time_hi = tier_cfg["time"]
    target_acc = random.uniform(acc_lo, acc_hi)

    # 문제 셔플 후 QUESTION_COUNT개 선택
    selected = random.sample(questions, min(QUESTION_COUNT, len(questions)))
    answers = []

    for i, q in enumerate(selected):
        is_correct = random.random() < target_acc
        time_taken = round(random.uniform(time_lo, time_hi), 1)

        # question_data에서 correct_answer 추출
        qdata = q["question_data"] or {}
        qtype = q["question_type"]

        # 안전하게 정답/오답 추출 (question_data 필드가 None일 수 있음)
        correct_ans = "정답"
        wrong_ans = "오답"
        try:
            if qtype in ("grammar_blank", "grammar_common", "grammar_usage", "grammar_pair"):
                correct_idx = qdata.get("correct_index")
                choices = qdata.get("choices") or qdata.get("sentences") or []
                if correct_idx is not None and choices and correct_idx < len(choices):
                    correct_ans = choices[correct_idx]
                    wrong_ans = choices[(correct_idx + 1) % len(choices)] if len(choices) > 1 else "오답"
            elif qtype == "grammar_error":
                correct_indices = qdata.get("correct_indices") or [0]
                correct_ans = str(correct_indices[0])
                sents = qdata.get("sentences") or []
                wrong_ans = str((int(correct_ans) + 1) % max(len(sents), 1))
            elif qtype in ("grammar_transform", "grammar_translate"):
                correct_ans = qdata.get("correct_answer") or "correct"
                wrong_ans = "오답"
            elif qtype == "grammar_order":
                correct_ans = qdata.get("correct_answer") or "correct order"
                wrong_ans = "wrong order"
        except (IndexError, TypeError, ValueError):
            correct_ans = "정답"
            wrong_ans = "오답"

        answers.append({
            "id": _uid(),
            "grammar_session_id": session_id,
            "grammar_question_id": q["id"],
            "question_order": i + 1,
            "question_type": qtype,
            "selected_answer": correct_ans if is_correct else wrong_ans,
            "correct_answer": correct_ans,
            "is_correct": is_correct,
            "time_taken_seconds": time_taken,
            "answered_at": base_time + timedelta(seconds=i * time_taken),
        })

    return answers


async def main():
    async with AsyncSessionLocal() as db:
        # 1. 선생님 찾기
        result = await db.execute(
            select(User).where(User.role == "teacher").limit(1)
        )
        teacher = result.scalar_one_or_none()
        if not teacher:
            print("ERROR: 선생님 계정이 없습니다.")
            return
        print(f"선생님: {teacher.name} ({teacher.id})")

        # 2. 가상 학생 재사용 또는 생성
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

        # 3. 문법 문제 가져오기
        q_result = await db.execute(
            text("SELECT id, question_type, question_data FROM grammar_questions")
        )
        all_questions = [
            {"id": r[0], "question_type": r[1], "question_data": r[2]}
            for r in q_result.fetchall()
        ]
        if len(all_questions) < QUESTION_COUNT:
            print(f"ERROR: grammar_questions에 문제가 {len(all_questions)}개뿐입니다. 최소 {QUESTION_COUNT}개 필요.")
            await db.rollback()
            return
        print(f"문법 문제 {len(all_questions)}개 로드")

        # 4. 문법 book_ids 가져오기 (config 참조용)
        book_result = await db.execute(text("SELECT id FROM grammar_books LIMIT 3"))
        book_ids = [r[0] for r in book_result.fetchall()]
        book_ids_str = ",".join(book_ids) if book_ids else None
        print(f"문법 교재 {len(book_ids)}개 로드")

        # 5. 등급별 20개씩, 총 100개 세션 생성
        now = datetime.now(KST)
        session_count = 0

        for tier_name, tier_cfg in TIERS.items():
            for i in range(20):
                # 시간을 과거로 분산 (최근 30일)
                days_ago = random.uniform(0, 30)
                started_at = now - timedelta(days=days_ago)

                # GrammarConfig 생성 (세션별 개별)
                config_id = _uid()
                db.add(GrammarConfig(
                    id=config_id,
                    teacher_id=teacher.id,
                    name=f"더미 문법테스트 {tier_name}-{i+1:02d}",
                    book_ids=book_ids_str,
                    question_count=QUESTION_COUNT,
                    time_limit_seconds=600,
                    per_question_seconds=30,
                    time_mode="per_question",
                    question_types="grammar_blank,grammar_error,grammar_common,grammar_usage",
                ))
                await db.flush()

                # TestAssignment 생성 (grammar용: test_config_id=NULL)
                assign_id = _uid()
                db.add(TestAssignment(
                    id=assign_id,
                    test_config_id=None,
                    grammar_config_id=config_id,
                    student_id=student_id,
                    teacher_id=teacher.id,
                    test_code=_code(),
                    assignment_type="grammar",
                    status="completed",
                    completed_at=started_at + timedelta(minutes=random.randint(3, 10)),
                ))
                await db.flush()

                # GrammarSession 생성
                sess_id = _uid()
                answers_data = _generate_grammar_answers(
                    tier_cfg, sess_id, all_questions, started_at
                )
                correct_count = sum(1 for a in answers_data if a["is_correct"])
                score = round((correct_count / len(answers_data)) * 100) if answers_data else 0
                completed_at = started_at + timedelta(
                    seconds=sum(a["time_taken_seconds"] for a in answers_data)
                )

                db.add(GrammarSession(
                    id=sess_id,
                    student_id=student_id,
                    assignment_id=assign_id,
                    grammar_config_id=config_id,
                    total_questions=len(answers_data),
                    correct_count=correct_count,
                    score=score,
                    started_at=started_at,
                    completed_at=completed_at,
                ))
                await db.flush()

                # GrammarAnswer 레코드들 생성
                for a in answers_data:
                    db.add(GrammarAnswer(**a))
                await db.flush()

                session_count += 1

            print(f"  [{tier_name}] 20개 문법 세션 생성 완료")

        await db.commit()
        print(f"\n완료! 총 {session_count}개 문법 더미 결과 생성됨.")
        print(f"  학생: {student.name} (username: dummy_tester)")
        print(f"  세션당 {QUESTION_COUNT}문제 × {session_count}세션 = {QUESTION_COUNT * session_count}개 답변")


if __name__ == "__main__":
    asyncio.run(main())
