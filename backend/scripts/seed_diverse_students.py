"""
다양한 학년별 더미 학생 생성 + 학습 세션 시드.
동학년 평균이 자연스럽게 분포되도록 학생 프로필을 다양화.

모든 더미 데이터에 [DUMMY] 태그를 삽입하여 나중에 일괄 삭제 가능.
- User.username: dummy_XXX
- User.name: [DUMMY] 이름
- User.school_name: [DUMMY] 가상학교
- TestConfig.name: [DUMMY] ...
- GrammarConfig.name: [DUMMY] ...

Usage:
    cd backend
    python -m scripts.seed_diverse_students                # 생성
    python -m scripts.seed_diverse_students --clean         # 기존 더미 삭제 후 재생성
    python -m scripts.seed_diverse_students --delete        # 더미 데이터만 삭제
    python -m scripts.seed_diverse_students --tag-existing  # 기존 모든 학생 데이터에 [DUMMY] 태그
"""
import asyncio
import argparse
import random
import string
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text, delete, update, and_, or_
from app.db.session import AsyncSessionLocal
from app.models.user import User
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.grammar_config import GrammarConfig
from app.models.grammar_session import GrammarSession
from app.models.grammar_answer import GrammarAnswer

KST = timezone(timedelta(hours=9))
DUMMY_PREFIX = "[DUMMY]"
DUMMY_USERNAME_PREFIX = "dummy_"

# 6대축 엔진 매핑
SKILL_ENGINES = {
    "meaning":       ["en_to_ko", "antonym_choice"],
    "association":   ["ko_to_en", "emoji"],
    "listening":     ["listen_en", "listen_ko"],
    "inference":     ["sentence"],
    "spelling":      ["listen_type", "ko_type", "antonym_type"],
    "comprehensive": ["sentence_type"],
}

# ── 학생 프로필: 6축 정답률 범위 ──
PROFILES = {
    "균형우수": {
        "meaning": (0.80, 0.95), "association": (0.75, 0.90),
        "listening": (0.78, 0.92), "inference": (0.72, 0.88),
        "spelling": (0.70, 0.88), "comprehensive": (0.68, 0.85),
        "time": (2.0, 6.0), "sessions": (8, 15),
    },
    "균형양호": {
        "meaning": (0.65, 0.80), "association": (0.60, 0.78),
        "listening": (0.62, 0.78), "inference": (0.58, 0.75),
        "spelling": (0.55, 0.72), "comprehensive": (0.52, 0.70),
        "time": (3.0, 8.0), "sessions": (6, 12),
    },
    "균형보통": {
        "meaning": (0.50, 0.68), "association": (0.45, 0.65),
        "listening": (0.48, 0.65), "inference": (0.42, 0.60),
        "spelling": (0.40, 0.58), "comprehensive": (0.38, 0.55),
        "time": (4.0, 12.0), "sessions": (5, 10),
    },
    "의미강세": {
        "meaning": (0.82, 0.95), "association": (0.78, 0.90),
        "listening": (0.50, 0.65), "inference": (0.45, 0.60),
        "spelling": (0.35, 0.50), "comprehensive": (0.45, 0.60),
        "time": (3.0, 9.0), "sessions": (6, 12),
    },
    "청취강세": {
        "meaning": (0.55, 0.70), "association": (0.50, 0.65),
        "listening": (0.80, 0.95), "inference": (0.55, 0.70),
        "spelling": (0.50, 0.68), "comprehensive": (0.50, 0.65),
        "time": (3.0, 8.0), "sessions": (6, 12),
    },
    "추론강세": {
        "meaning": (0.60, 0.75), "association": (0.55, 0.70),
        "listening": (0.50, 0.65), "inference": (0.78, 0.92),
        "spelling": (0.45, 0.60), "comprehensive": (0.60, 0.75),
        "time": (4.0, 10.0), "sessions": (6, 12),
    },
    "철자약세": {
        "meaning": (0.65, 0.82), "association": (0.60, 0.78),
        "listening": (0.60, 0.75), "inference": (0.55, 0.72),
        "spelling": (0.20, 0.38), "comprehensive": (0.40, 0.55),
        "time": (5.0, 14.0), "sessions": (5, 10),
    },
    "균형약세": {
        "meaning": (0.30, 0.48), "association": (0.25, 0.42),
        "listening": (0.25, 0.40), "inference": (0.20, 0.35),
        "spelling": (0.18, 0.32), "comprehensive": (0.15, 0.30),
        "time": (6.0, 18.0), "sessions": (3, 8),
    },
}

# ── 학년별 학생 구성 ──
GRADE_STUDENTS = {
    "초6": [
        ("김초롱", "균형보통"), ("이하늘", "의미강세"), ("박소라", "균형약세"),
        ("최다은", "청취강세"), ("정우진", "철자약세"), ("한서준", "균형양호"),
    ],
    "중1": [
        ("김민수", "균형양호"), ("이서연", "의미강세"), ("박지호", "균형보통"),
        ("최예린", "추론강세"), ("정도윤", "철자약세"), ("한수아", "청취강세"),
        ("오태양", "균형우수"), ("윤하은", "균형약세"),
    ],
    "중2": [
        ("강현우", "균형우수"), ("임채원", "균형양호"), ("송지민", "의미강세"),
        ("유준서", "청취강세"), ("배서현", "추론강세"), ("홍다인", "균형보통"),
        ("조민재", "철자약세"), ("신유나", "균형약세"),
    ],
    "중3": [
        ("문성진", "균형우수"), ("장예은", "균형양호"), ("권도현", "추론강세"),
        ("황지수", "의미강세"), ("안시우", "균형보통"), ("류하린", "철자약세"),
        ("서준혁", "청취강세"),
    ],
    "고1": [
        ("김태리", "균형우수"), ("이도현", "균형양호"), ("박수빈", "의미강세"),
        ("최준영", "추론강세"), ("정하윤", "균형보통"), ("한동우", "철자약세"),
    ],
}

QUESTION_COUNT = 20


def _uid():
    return str(uuid.uuid4())


def _code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=8))


def _generate_answers(profile: dict, session_id: str,
                      word_ids: list[str], mastery_ids: list[str],
                      base_time: datetime) -> list[dict]:
    """프로필 기반 6대축 정답률에 맞춰 LearningAnswer 생성."""
    answers = []
    time_lo, time_hi = profile["time"]

    engine_schedule = []
    for skill, engines in SKILL_ENGINES.items():
        count = 3 if skill != "comprehensive" else 2
        for _ in range(count):
            engine_schedule.append((skill, random.choice(engines)))
    while len(engine_schedule) < QUESTION_COUNT:
        skill = random.choice(list(SKILL_ENGINES.keys()))
        engine_schedule.append((skill, random.choice(SKILL_ENGINES[skill])))
    random.shuffle(engine_schedule)
    engine_schedule = engine_schedule[:QUESTION_COUNT]

    for i, (skill, engine) in enumerate(engine_schedule):
        acc_lo, acc_hi = profile[skill]
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


async def tag_existing_data(db):
    """기존 모든 학생(teacher 제외) 데이터에 [DUMMY] 태그 일괄 적용.

    이미 [DUMMY] 태그가 있는 데이터는 건너뜀.
    """
    print("기존 데이터에 [DUMMY] 태그 적용 중...\n")

    # 1) 학생 User: username에 dummy_ 접두어가 없는 학생들
    result = await db.execute(
        select(User).where(
            User.role == "student",
            ~User.username.like(f"{DUMMY_USERNAME_PREFIX}%"),
        )
    )
    students = result.scalars().all()
    tagged_students = 0
    for s in students:
        old_username = s.username
        if not old_username.startswith(DUMMY_USERNAME_PREFIX):
            s.username = f"{DUMMY_USERNAME_PREFIX}{old_username}"
        if not s.name.startswith(DUMMY_PREFIX):
            s.name = f"{DUMMY_PREFIX} {s.name}"
        if s.school_name and not s.school_name.startswith(DUMMY_PREFIX):
            s.school_name = f"{DUMMY_PREFIX} {s.school_name}"
        tagged_students += 1
    print(f"  학생 User: {tagged_students}명 태그")

    # 2) TestConfig: [DUMMY] 없는 것들
    result = await db.execute(
        select(TestConfig).where(~TestConfig.name.like(f"{DUMMY_PREFIX}%"))
    )
    configs = result.scalars().all()
    tagged_configs = 0
    for c in configs:
        c.name = f"{DUMMY_PREFIX} {c.name}"
        tagged_configs += 1
    print(f"  TestConfig: {tagged_configs}건 태그")

    # 3) GrammarConfig: [DUMMY] 없는 것들
    result = await db.execute(
        select(GrammarConfig).where(~GrammarConfig.name.like(f"{DUMMY_PREFIX}%"))
    )
    g_configs = result.scalars().all()
    tagged_g = 0
    for gc in g_configs:
        gc.name = f"{DUMMY_PREFIX} {gc.name}"
        tagged_g += 1
    print(f"  GrammarConfig: {tagged_g}건 태그")

    await db.commit()
    print(f"\n태그 완료! 총 {tagged_students}명 학생, {tagged_configs}개 단어 테스트, {tagged_g}개 문법 테스트 태그됨.")


async def delete_dummy_data(db):
    """[DUMMY] 태그가 붙은 모든 더미 데이터 삭제.

    삭제 순서: 자식 → 부모 (FK 제약 준수)
    """
    # 더미 학생 ID 조회 (username이 dummy_로 시작)
    result = await db.execute(
        select(User.id).where(User.username.like(f"{DUMMY_USERNAME_PREFIX}%"))
    )
    dummy_student_ids = [r[0] for r in result.fetchall()]

    if not dummy_student_ids:
        print("삭제할 더미 데이터가 없습니다.")
        return 0

    print(f"더미 학생 {len(dummy_student_ids)}명 발견, 관련 데이터 삭제 중...")

    # ── 단어 학습 관련 ──
    # 1) LearningAnswer
    sess_ids_sub = select(LearningSession.id).where(
        LearningSession.student_id.in_(dummy_student_ids)
    )
    del_la = await db.execute(
        delete(LearningAnswer).where(LearningAnswer.session_id.in_(sess_ids_sub))
    )
    print(f"  LearningAnswer: {del_la.rowcount}건")

    # 2) LearningSession
    del_ls = await db.execute(
        delete(LearningSession).where(LearningSession.student_id.in_(dummy_student_ids))
    )
    print(f"  LearningSession: {del_ls.rowcount}건")

    # ── 문법 테스트 관련 ──
    # 3) GrammarAnswer
    g_sess_sub = select(GrammarSession.id).where(
        GrammarSession.student_id.in_(dummy_student_ids)
    )
    del_ga = await db.execute(
        delete(GrammarAnswer).where(GrammarAnswer.grammar_session_id.in_(g_sess_sub))
    )
    print(f"  GrammarAnswer: {del_ga.rowcount}건")

    # 4) GrammarSession
    del_gs = await db.execute(
        delete(GrammarSession).where(GrammarSession.student_id.in_(dummy_student_ids))
    )
    print(f"  GrammarSession: {del_gs.rowcount}건")

    # ── 레벨테스트 관련 ──
    # 5) TestAnswer
    t_sess_sub = select(TestSession.id).where(
        TestSession.student_id.in_(dummy_student_ids)
    )
    del_ta = await db.execute(
        delete(TestAnswer).where(TestAnswer.test_session_id.in_(t_sess_sub))
    )
    print(f"  TestAnswer: {del_ta.rowcount}건")

    # 6) TestSession
    del_ts = await db.execute(
        delete(TestSession).where(TestSession.student_id.in_(dummy_student_ids))
    )
    print(f"  TestSession: {del_ts.rowcount}건")

    # ── 공통 ──
    # 7) WordMastery
    del_wm = await db.execute(
        delete(WordMastery).where(WordMastery.student_id.in_(dummy_student_ids))
    )
    print(f"  WordMastery: {del_wm.rowcount}건")

    # 8) TestAssignment
    del_assign = await db.execute(
        delete(TestAssignment).where(TestAssignment.student_id.in_(dummy_student_ids))
    )
    print(f"  TestAssignment: {del_assign.rowcount}건")

    # 9) TestConfig (DUMMY prefix)
    del_tc = await db.execute(
        delete(TestConfig).where(TestConfig.name.like(f"{DUMMY_PREFIX}%"))
    )
    print(f"  TestConfig: {del_tc.rowcount}건")

    # 10) GrammarConfig (DUMMY prefix)
    del_gc = await db.execute(
        delete(GrammarConfig).where(GrammarConfig.name.like(f"{DUMMY_PREFIX}%"))
    )
    print(f"  GrammarConfig: {del_gc.rowcount}건")

    # 11) User
    del_users = await db.execute(
        delete(User).where(User.id.in_(dummy_student_ids))
    )
    print(f"  User: {del_users.rowcount}명")

    await db.commit()
    print(f"\n더미 데이터 삭제 완료!")
    return len(dummy_student_ids)


async def main():
    parser = argparse.ArgumentParser(description="더미 학생 시드 관리")
    parser.add_argument("--clean", action="store_true",
                        help="기존 더미 삭제 후 재생성")
    parser.add_argument("--delete", action="store_true",
                        help="더미 데이터만 삭제 (생성 안 함)")
    parser.add_argument("--tag-existing", action="store_true",
                        help="기존 모든 학생/테스트에 [DUMMY] 태그 적용")
    parser.add_argument("--teacher-id", type=str, default=None,
                        help="선생님 UUID (미지정시 학생 수가 가장 많은 선생님)")
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        # 기존 데이터 태깅
        if args.tag_existing:
            await tag_existing_data(db)
            return

        # 삭제 모드
        if args.clean or args.delete:
            await delete_dummy_data(db)
            if args.delete:
                return

        # ── 생성 모드 ──
        # 선생님 찾기
        if args.teacher_id:
            result = await db.execute(
                select(User).where(User.id == args.teacher_id, User.role == "teacher")
            )
            teacher = result.scalar_one_or_none()
        else:
            # 학생 수가 가장 많은 선생님 (실제 사용 중인 계정)
            from sqlalchemy import func
            subq = (
                select(User.teacher_id, func.count(User.id).label("cnt"))
                .where(User.role == "student", User.teacher_id.isnot(None))
                .group_by(User.teacher_id)
                .order_by(func.count(User.id).desc())
                .limit(1)
                .subquery()
            )
            result = await db.execute(
                select(User).where(User.id == subq.c.teacher_id)
            )
            teacher = result.scalar_one_or_none()
        if not teacher:
            print("ERROR: 선생님 계정이 없습니다.")
            return
        print(f"선생님: {teacher.name} ({teacher.id})")

        # 단어 20개
        word_result = await db.execute(text("SELECT id FROM words LIMIT 20"))
        word_ids = [r[0] for r in word_result.fetchall()]
        if len(word_ids) < 20:
            print(f"ERROR: words 테이블에 {len(word_ids)}개뿐입니다. 최소 20개 필요.")
            return
        print(f"단어 {len(word_ids)}개 로드")

        now = datetime.now(KST)
        total_students = 0
        total_sessions = 0
        total_answers = 0

        for grade, students in GRADE_STUDENTS.items():
            print(f"\n── {grade} ({len(students)}명) ──")

            for idx, (name, profile_name) in enumerate(students, 1):
                profile = PROFILES[profile_name]
                username = f"{DUMMY_USERNAME_PREFIX}{grade}_{idx:02d}"

                # 학생 1명 단위로 독립 트랜잭션 (deadlock 방지)
                for attempt in range(3):
                    try:
                        async with AsyncSessionLocal() as sess:
                            # 학생 생성 (이미 있으면 재사용)
                            existing = await sess.execute(
                                select(User).where(User.username == username)
                            )
                            student = existing.scalar_one_or_none()
                            if student:
                                student_id = student.id
                            else:
                                student_id = _uid()
                                student = User(
                                    id=student_id,
                                    username=username,
                                    password_hash="$2b$12$dummy_hash_not_loginable_xxxxxxxxxxxxxxxxxxxxxx",
                                    name=f"{DUMMY_PREFIX} {name}",
                                    role="student",
                                    teacher_id=teacher.id,
                                    school_name=f"{DUMMY_PREFIX} 가상학교",
                                    grade=grade,
                                )
                                sess.add(student)
                                await sess.flush()

                            # WordMastery
                            mastery_ids = []
                            for wid in word_ids:
                                existing_m = await sess.execute(
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
                                    sess.add(WordMastery(
                                        id=mid, student_id=student_id, word_id=wid,
                                        stage=1, stage_streak=0,
                                        total_attempts=0, total_correct=0, combo_best=0,
                                    ))
                            await sess.flush()

                            # 세션 생성
                            n_sessions = random.randint(*profile["sessions"])
                            student_sessions = 0

                            for si in range(n_sessions):
                                days_ago = random.uniform(0, 45)
                                started_at = now - timedelta(days=days_ago)
                                duration_sec = random.randint(120, 600)
                                completed_at = started_at + timedelta(seconds=duration_sec)

                                config_id = _uid()
                                sess.add(TestConfig(
                                    id=config_id,
                                    teacher_id=teacher.id,
                                    name=f"{DUMMY_PREFIX} {grade} {name} 학습 {si+1:02d}",
                                    test_type="periodic",
                                    question_count=QUESTION_COUNT,
                                    time_limit_seconds=300,
                                    book_name="기본영단어 1200-01",
                                    level_range_min=1, level_range_max=10,
                                    question_types="en_to_ko,ko_to_en,listen_en,listen_ko,sentence,ko_type,listen_type,emoji,antonym_choice,antonym_type,sentence_type",
                                ))
                                await sess.flush()

                                assign_id = _uid()
                                sess.add(TestAssignment(
                                    id=assign_id,
                                    test_config_id=config_id,
                                    student_id=student_id,
                                    teacher_id=teacher.id,
                                    test_code=_code(),
                                    assignment_type="mastery",
                                    status="completed",
                                    completed_at=completed_at,
                                ))
                                await sess.flush()

                                sess_id = _uid()
                                answers_data = _generate_answers(
                                    profile, sess_id, word_ids, mastery_ids, started_at
                                )
                                correct_count = sum(1 for a in answers_data if a["is_correct"])

                                sess.add(LearningSession(
                                    id=sess_id,
                                    student_id=student_id,
                                    assignment_id=assign_id,
                                    current_stage=random.randint(1, 3),
                                    current_level=random.randint(1, 10),
                                    words_practiced=QUESTION_COUNT,
                                    words_advanced=max(0, correct_count - QUESTION_COUNT // 2),
                                    words_demoted=max(0, (QUESTION_COUNT - correct_count) - QUESTION_COUNT // 3),
                                    best_combo=random.randint(1, correct_count) if correct_count > 0 else 0,
                                    started_at=started_at,
                                    completed_at=completed_at,
                                ))
                                await sess.flush()

                                for a in answers_data:
                                    sess.add(LearningAnswer(**a))

                                student_sessions += 1
                                total_answers += len(answers_data)

                            await sess.commit()

                        total_students += 1
                        total_sessions += student_sessions
                        print(f"  {name} ({profile_name}) - {student_sessions}세션")
                        break  # success
                    except Exception as e:
                        if "deadlock" in str(e).lower() and attempt < 2:
                            print(f"  {name} - deadlock, 재시도 {attempt+2}/3...")
                            await asyncio.sleep(1)
                        else:
                            print(f"  {name} - ERROR: {e}")
                            break

        print(f"\n{'='*50}")
        print(f"완료!")
        print(f"  학생: {total_students}명 (학년: {len(GRADE_STUDENTS)}개)")
        print(f"  세션: {total_sessions}개")
        print(f"  답변: {total_answers}개")
        print(f"\n더미 식별자:")
        print(f"  Username: {DUMMY_USERNAME_PREFIX}*")
        print(f"  Name/Config: {DUMMY_PREFIX} *")
        print(f"\n삭제 명령: python -m scripts.seed_diverse_students --delete")


if __name__ == "__main__":
    asyncio.run(main())
