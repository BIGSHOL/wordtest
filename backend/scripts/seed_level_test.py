"""Seed dummy level test results for all grades.

Creates 10 level test assignments per grade (초1~고3, 12 grades = 120 total).
Each grade has a mix of statuses: pending, in_progress, completed.
Completed ones include TestSession + LearningSession + TestAnswer + LearningAnswer data.

Idempotent: cleans up previous seed data (prefix "LVT") before re-seeding.

Usage:
    cd backend
    python scripts/seed_level_test.py
"""
import asyncio
import json
import uuid
import random
import sys
import os
from datetime import datetime, timedelta, timezone

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# ── Config ───────────────────────────────────────────────────────────────────

KST = timezone(timedelta(hours=9))

PW_HASH = "$2b$10$6BVAnye5fMtUg9eo.BIk1es0sJSbeobYY4OU/NAQXrOR4Qg.keDf6"

CLEANUP_PREFIX = "LVT"

GRADES = ["초1", "초2", "초3", "초4", "초5", "초6", "중1", "중2", "중3", "고1", "고2", "고3"]

GRADE_BASE_LEVEL = {
    "초1": 1, "초2": 1, "초3": 1, "초4": 1,
    "초5": 1, "초6": 3,
    "중1": 5, "중2": 7, "중3": 9,
    "고1": 11, "고2": 11, "고3": 11,
}

# Level range per grade (same logic as level_test_presets.py)
ELEMENTARY_RANGE = (1, 7)
MAX_LEVEL = 11

BOOK_LEVEL_MAP = {
    1: "Power Voca 5000-01", 2: "Power Voca 5000-02", 3: "Power Voca 5000-03",
    4: "Power Voca 5000-04", 5: "Power Voca 5000-05", 6: "Power Voca 5000-06",
    7: "Power Voca 5000-07", 8: "Power Voca 5000-08", 9: "Power Voca 5000-09",
    10: "Power Voca 5000-10",
    11: "Power Voca 수능 기출 5000-01", 12: "Power Voca 수능 기출 5000-02",
    13: "Power Voca 수능 기출 5000-03", 14: "Power Voca 수능 기출 5000-04",
    15: "Power Voca 수능 기출 5000-05",
}

# Level test presets
QUESTION_COUNT = 100
QUESTION_TYPES_STR = "emoji,en_to_ko,ko_to_en,listen_en,sentence,listen_type,ko_type,sentence_type"
QUESTION_TYPE_COUNTS = {
    "emoji": 10, "en_to_ko": 18, "ko_to_en": 20, "listen_en": 18,
    "sentence": 16, "listen_type": 5, "ko_type": 4, "sentence_type": 9,
}
PER_QUESTION_TIME = 15

# Question type weights for random answer generation
Q_TYPES = ["en_to_ko", "ko_to_en", "listen_en", "emoji", "sentence", "listen_type", "ko_type", "sentence_type"]
Q_WEIGHTS = [18, 20, 18, 10, 16, 5, 4, 9]

RANK_NAMES = {
    1: "Iron", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Platinum",
    6: "Emerald", 7: "Diamond", 8: "Master", 9: "Grandmaster", 10: "Challenger",
    11: "Legend", 12: "Legend", 13: "Legend", 14: "Legend", 15: "Legend",
}

# Korean family names and given names for generating student names
FAMILY_NAMES = ["김", "이", "박", "최", "정", "강", "조", "윤", "장", "임", "한", "오", "서", "신", "권", "황", "안", "송", "류", "홍"]
GIVEN_NAMES = [
    "민수", "지은", "서준", "예린", "하늘", "도윤", "서연", "시우", "하은", "지호",
    "유진", "수빈", "현우", "소율", "민재", "채원", "지안", "태윤", "나은", "준혁",
    "서윤", "은서", "다은", "주원", "유나", "지율", "민호", "소연", "태양", "하린",
    "승현", "다윤", "예준", "서현", "하준", "수아", "지훈", "민서", "윤서", "시현",
    "동현", "가영", "영호", "미래", "성민", "보람", "진우", "소희", "태민", "재영",
]

SCHOOLS = [
    "서울초등학교", "한빛초등학교", "푸른초등학교", "별빛초등학교",
    "서울중학교", "한강중학교", "청담중학교", "도곡중학교",
    "서울고등학교", "대치고등학교", "강남고등학교", "한영고등학교",
]

# Score profiles for diversity
SCORE_PROFILES = [
    {"label": "최상", "acc": (88, 96), "lv_offset": (2, 4), "combo": (12, 25), "spd": (3, 6)},
    {"label": "상",   "acc": (78, 88), "lv_offset": (1, 3), "combo": (8, 15),  "spd": (4, 8)},
    {"label": "중상", "acc": (68, 78), "lv_offset": (0, 2), "combo": (5, 12),  "spd": (5, 9)},
    {"label": "중",   "acc": (55, 68), "lv_offset": (-1, 1), "combo": (3, 8),  "spd": (6, 11)},
    {"label": "중하", "acc": (42, 55), "lv_offset": (-2, 0), "combo": (2, 6),  "spd": (7, 12)},
    {"label": "하",   "acc": (30, 42), "lv_offset": (-3, -1), "combo": (1, 4), "spd": (8, 14)},
]

# Status distribution: 10 assignments per grade
# 3 pending, 2 in_progress, 5 completed
STATUS_DISTRIBUTION = (
    ["pending"] * 3
    + ["in_progress"] * 2
    + ["completed"] * 5
)


# ── Helpers ──────────────────────────────────────────────────────────────────

_print = print
def print(*args, **kwargs):
    kwargs.setdefault("flush", True)
    _print(*args, **kwargs)


def uid():
    return str(uuid.uuid4())


def rnd_kst(d1=1, d2=30):
    """Random KST datetime within d1..d2 days ago."""
    return datetime.now(KST) - timedelta(
        days=random.randint(d1, d2),
        hours=random.randint(0, 12),
        minutes=random.randint(0, 59),
    )


def get_level_range(grade: str) -> tuple[int, int]:
    if grade.startswith("초"):
        return ELEMENTARY_RANGE
    base = GRADE_BASE_LEVEL[grade]
    low = max(1, base - 2)
    high = min(MAX_LEVEL, base + 4)
    return min(low, high), high


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Phase 0: Cleanup ────────────────────────────────────────────────────────

async def cleanup(db: AsyncSession):
    """Delete all level test seed data identified by LVT prefix."""
    r = await db.execute(text(
        "SELECT id FROM test_assignments WHERE test_code LIKE :prefix"
    ), {"prefix": f"{CLEANUP_PREFIX}%"})
    ids = [x.id for x in r.fetchall()]
    if not ids:
        print("  No previous seed data to clean")
        return

    # Learning answers via session IDs
    sr = await db.execute(text(
        "SELECT id FROM learning_sessions WHERE assignment_id = ANY(:i)"
    ), {"i": ids})
    sids = [x.id for x in sr.fetchall()]
    if sids:
        await db.execute(text("DELETE FROM learning_answers WHERE session_id = ANY(:i)"), {"i": sids})
    await db.execute(text("DELETE FROM learning_sessions WHERE assignment_id = ANY(:i)"), {"i": ids})
    await db.execute(text("DELETE FROM word_mastery WHERE assignment_id = ANY(:i)"), {"i": ids})

    # Test answers/sessions
    await db.execute(text("""
        DELETE FROM test_answers WHERE test_session_id IN (
            SELECT test_session_id FROM test_assignments WHERE id = ANY(:i) AND test_session_id IS NOT NULL
        )
    """), {"i": ids})
    await db.execute(text("""
        DELETE FROM test_sessions WHERE id IN (
            SELECT test_session_id FROM test_assignments WHERE id = ANY(:i) AND test_session_id IS NOT NULL
        )
    """), {"i": ids})

    # Collect config IDs
    cr = await db.execute(text(
        "SELECT DISTINCT test_config_id FROM test_assignments WHERE id = ANY(:i)"
    ), {"i": ids})
    cids = [x.test_config_id for x in cr.fetchall() if x.test_config_id]

    await db.execute(text("DELETE FROM test_assignments WHERE id = ANY(:i)"), {"i": ids})

    if cids:
        await db.execute(text("""
            DELETE FROM test_configs WHERE id = ANY(:i)
            AND id NOT IN (SELECT test_config_id FROM test_assignments WHERE test_config_id IS NOT NULL)
        """), {"i": cids})

    # Clean up dummy students created by this script
    await db.execute(text(
        "DELETE FROM users WHERE username LIKE 'lvt_student_%'"
    ))

    await db.commit()
    print(f"  Cleaned {len(ids)} seed assignments")


# ── Phase 1: Accounts ───────────────────────────────────────────────────────

async def ensure_teacher(db: AsyncSession) -> str:
    """Find demo_teacher or create one."""
    r = await db.execute(text("SELECT id FROM users WHERE username = 'demo_teacher'"))
    row = r.first()
    if row:
        print(f"  Using existing teacher: demo_teacher ({row.id[:8]}...)")
        return row.id

    # Try master_teacher
    r = await db.execute(text("SELECT id FROM users WHERE role = 'teacher' LIMIT 1"))
    row = r.first()
    if row:
        print(f"  Using existing teacher: {row.id[:8]}...")
        return row.id

    # Create one
    tid = uid()
    await db.execute(text("""
        INSERT INTO users (id, username, password_hash, name, role, school_name, grade, created_at, updated_at)
        VALUES (:id, 'demo_teacher', :pw, '김선생', 'teacher', '조슈아영어학원', '', now(), now())
    """), {"id": tid, "pw": PW_HASH})
    await db.commit()
    print(f"  Created teacher: demo_teacher ({tid[:8]}...)")
    return tid


async def create_students(db: AsyncSession, teacher_id: str) -> dict[str, list[dict]]:
    """Create 10 dummy students per grade. Returns {grade: [{id, name, grade, school}]}."""
    students_by_grade: dict[str, list[dict]] = {}
    used_names: set[str] = set()
    idx = 0

    for grade in GRADES:
        grade_students = []
        # Pick appropriate school
        if grade.startswith("초"):
            school_pool = SCHOOLS[:4]
        elif grade.startswith("중"):
            school_pool = SCHOOLS[4:8]
        else:
            school_pool = SCHOOLS[8:]

        for i in range(10):
            idx += 1
            # Generate unique name
            while True:
                name = random.choice(FAMILY_NAMES) + random.choice(GIVEN_NAMES)
                if name not in used_names:
                    used_names.add(name)
                    break

            username = f"lvt_student_{idx:03d}"
            school = random.choice(school_pool)
            sid = uid()

            await db.execute(text("""
                INSERT INTO users (id, username, password_hash, name, role, teacher_id, school_name, grade, created_at, updated_at)
                VALUES (:id, :u, :pw, :n, 'student', :tid, :sch, :gr, now(), now())
                ON CONFLICT (username) DO UPDATE SET
                    password_hash = :pw, teacher_id = :tid, school_name = :sch, grade = :gr, name = :n
                RETURNING id
            """), {"id": sid, "u": username, "pw": PW_HASH, "n": name,
                   "tid": teacher_id, "sch": school, "gr": grade})
            r = await db.execute(text("SELECT id FROM users WHERE username = :u"), {"u": username})
            actual_id = r.scalar()

            grade_students.append({
                "id": actual_id or sid,
                "name": name,
                "grade": grade,
                "school": school,
            })

        students_by_grade[grade] = grade_students

    await db.commit()
    print(f"  Created {idx} dummy students across {len(GRADES)} grades")
    return students_by_grade


# ── Phase 2: Load words ─────────────────────────────────────────────────────

async def load_words(db: AsyncSession) -> dict[int, list[dict]]:
    """Load words from DB grouped by level."""
    words_by_level: dict[int, list[dict]] = {}
    for lv in range(1, 16):
        r = await db.execute(text(
            "SELECT id, english, korean, level FROM words WHERE level = :lv AND is_excluded = false ORDER BY random() LIMIT 120"
        ), {"lv": lv})
        words_by_level[lv] = [
            {"id": x.id, "english": x.english, "korean": x.korean, "level": x.level}
            for x in r.fetchall()
        ]
    total = sum(len(v) for v in words_by_level.values())
    print(f"  Loaded {total} words across {len(words_by_level)} levels")
    return words_by_level


# ── Phase 3: Create level test assignments ──────────────────────────────────

async def create_level_test_data(
    db: AsyncSession,
    teacher_id: str,
    students_by_grade: dict[str, list[dict]],
    words_by_level: dict[int, list[dict]],
):
    """Create 10 level test assignments per grade with diverse statuses."""
    global_idx = 0
    summary = {"pending": 0, "in_progress": 0, "completed": 0}

    for grade in GRADES:
        students = students_by_grade[grade]
        level_min, level_max = get_level_range(grade)
        book_start = BOOK_LEVEL_MAP[level_min]
        book_end = BOOK_LEVEL_MAP[level_max]

        # Create one TestConfig per grade (shared)
        config_id = uid()
        await db.execute(text("""
            INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
                time_limit_seconds, is_active, book_name, book_name_end,
                level_range_min, level_range_max,
                per_question_time_seconds, question_types, question_type_counts,
                created_at, updated_at)
            VALUES (:id, :tid, :name, 'levelup', :qc, :tl, true, :bn, :bne,
                    :lmin, :lmax, :pqt, :qt, :qtc, now(), now())
        """), {
            "id": config_id, "tid": teacher_id,
            "name": f"레벨테스트 ({grade})",
            "qc": QUESTION_COUNT,
            "tl": QUESTION_COUNT * PER_QUESTION_TIME,
            "bn": book_start, "bne": book_end,
            "lmin": level_min, "lmax": level_max,
            "pqt": PER_QUESTION_TIME,
            "qt": QUESTION_TYPES_STR,
            "qtc": json.dumps(QUESTION_TYPE_COUNTS),
        })

        # Shuffle statuses
        statuses = list(STATUS_DISTRIBUTION)
        random.shuffle(statuses)

        for i, student in enumerate(students):
            global_idx += 1
            status = statuses[i]
            code = f"{CLEANUP_PREFIX}{global_idx:04d}"
            assigned_at = rnd_kst(1, 30)

            assignment_id = uid()
            test_session_id = None
            completed_at = None

            if status == "completed":
                # Create full test result data
                profile = random.choice(SCORE_PROFILES)
                acc = random.randint(*profile["acc"])
                base_level = GRADE_BASE_LEVEL[grade]
                lv_offset = random.randint(*profile["lv_offset"])
                determined_level = max(1, min(15, base_level + lv_offset))
                sublevel = random.randint(1, 3)
                rank = RANK_NAMES.get(determined_level, "Iron")
                combo = random.randint(*profile["combo"])
                spd = profile["spd"]

                # Gather words for this test
                eligible_words = []
                for lv in range(max(1, level_min - 1), min(16, level_max + 2)):
                    eligible_words.extend(words_by_level.get(lv, []))
                if len(eligible_words) < QUESTION_COUNT:
                    for lv in range(1, 16):
                        eligible_words.extend(words_by_level.get(lv, []))
                random.shuffle(eligible_words)
                test_words = eligible_words[:QUESTION_COUNT]
                n_correct = max(1, min(len(test_words), int(len(test_words) * acc / 100)))

                started = assigned_at + timedelta(hours=random.randint(1, 48))
                completed_at = started + timedelta(minutes=random.randint(8, 25))
                score = acc

                # 1. TestSession
                ts_id = uid()
                test_session_id = ts_id
                await db.execute(text("""
                    INSERT INTO test_sessions (id, student_id, test_config_id, test_type,
                        total_questions, correct_count, determined_level, determined_sublevel,
                        rank_name, score, started_at, completed_at)
                    VALUES (:id, :sid, :cid, 'placement', :tq, :cc, :dl, :ds, :rn, :sc, :sa, :ca)
                """), {
                    "id": ts_id, "sid": student["id"], "cid": config_id,
                    "tq": len(test_words), "cc": n_correct,
                    "dl": determined_level, "ds": sublevel,
                    "rn": rank, "sc": score,
                    "sa": started, "ca": completed_at,
                })

                # 2. TestAssignment
                await db.execute(text("""
                    INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                        test_code, assignment_type, engine_type, status, test_session_id,
                        assigned_at, completed_at)
                    VALUES (:id, :cid, :sid, :tid, :code, 'mastery', 'levelup', 'completed',
                            :tsid, :aa, :ca)
                """), {
                    "id": assignment_id, "cid": config_id, "sid": student["id"],
                    "tid": teacher_id, "code": code, "tsid": ts_id,
                    "aa": assigned_at, "ca": completed_at,
                })

                # 3. LearningSession
                session_id = uid()
                await db.execute(text("""
                    INSERT INTO learning_sessions (id, student_id, assignment_id,
                        current_stage, current_level, words_practiced, words_advanced,
                        words_demoted, best_combo, started_at, completed_at)
                    VALUES (:id, :sid, :aid, :stg, :lv, :wp, :wa, :wd, :bc, :sa, :ca)
                """), {
                    "id": session_id, "sid": student["id"], "aid": assignment_id,
                    "stg": random.randint(1, 5), "lv": determined_level,
                    "wp": len(test_words), "wa": n_correct,
                    "wd": random.randint(0, 5),
                    "bc": combo, "sa": started, "ca": completed_at,
                })

                # 4. Generate answers
                correct_set = set(random.sample(range(len(test_words)), n_correct))
                t = started

                for qi, w in enumerate(test_words):
                    is_correct = qi in correct_set
                    time_sec = round(random.uniform(*spd), 1)
                    t += timedelta(seconds=time_sec + random.uniform(0.5, 1.5))
                    stage = random.choices([1, 2, 3, 4, 5], weights=[15, 25, 30, 20, 10])[0]
                    qt = random.choices(Q_TYPES, weights=Q_WEIGHTS)[0]

                    if qt in ("en_to_ko", "listen_en", "emoji"):
                        c_ans = w["korean"]
                    else:
                        c_ans = w["english"]

                    if is_correct:
                        s_ans = c_ans
                    else:
                        others = [x for x in test_words if x["id"] != w["id"]]
                        if others:
                            pick = random.choice(others)
                            s_ans = pick["korean"] if qt in ("en_to_ko", "listen_en", "emoji") else pick["english"]
                        else:
                            s_ans = c_ans

                    # WordMastery
                    m_id = uid()
                    mastered_at = t if stage >= 5 and is_correct else None
                    await db.execute(text("""
                        INSERT INTO word_mastery (id, student_id, word_id, assignment_id,
                            stage, stage_streak, total_attempts, total_correct, combo_best,
                            last_practiced_at, mastered_at, created_at, updated_at)
                        VALUES (:id, :sid, :wid, :aid, :stg, :ss, 1, :c, :cb, :lp, :ma, now(), now())
                        ON CONFLICT (student_id, word_id) DO UPDATE SET
                            stage = :stg, total_attempts = word_mastery.total_attempts + 1,
                            total_correct = word_mastery.total_correct + :c,
                            last_practiced_at = :lp, mastered_at = COALESCE(:ma, word_mastery.mastered_at),
                            assignment_id = :aid, updated_at = now()
                        RETURNING id
                    """), {
                        "id": m_id, "sid": student["id"], "wid": w["id"], "aid": assignment_id,
                        "stg": stage, "ss": random.randint(0, 3),
                        "c": 1 if is_correct else 0,
                        "cb": random.randint(0, combo), "lp": t, "ma": mastered_at,
                    })

                    mr = await db.execute(text(
                        "SELECT id FROM word_mastery WHERE student_id = :s AND word_id = :w"
                    ), {"s": student["id"], "w": w["id"]})
                    actual_m_id = mr.scalar()

                    # LearningAnswer
                    await db.execute(text("""
                        INSERT INTO learning_answers (id, session_id, word_mastery_id, word_id,
                            stage, is_correct, selected_answer, correct_answer, time_taken_sec,
                            answered_at, question_type)
                        VALUES (:id, :sid, :mid, :wid, :stg, :ic, :sa, :ca, :tt, :aa, :qt)
                    """), {
                        "id": uid(), "sid": session_id, "mid": actual_m_id, "wid": w["id"],
                        "stg": stage, "ic": is_correct, "sa": s_ans, "ca": c_ans,
                        "tt": time_sec, "aa": t, "qt": qt,
                    })

                    # TestAnswer
                    await db.execute(text("""
                        INSERT INTO test_answers (id, test_session_id, word_id,
                            selected_answer, correct_answer, is_correct, question_order,
                            answered_at, question_type)
                        VALUES (:id, :tsid, :wid, :sa, :ca, :ic, :qo, :aa, :qt)
                    """), {
                        "id": uid(), "tsid": ts_id, "wid": w["id"],
                        "sa": s_ans, "ca": c_ans, "ic": is_correct,
                        "qo": qi + 1, "aa": t, "qt": qt,
                    })

                await db.commit()
                summary["completed"] += 1
                print(f"    [{grade}] {code} {student['name']:4s} completed  Lv{determined_level:2d} {rank:12s} {score}%")

            elif status == "in_progress":
                # In progress: has assignment, started but not completed
                await db.execute(text("""
                    INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                        test_code, assignment_type, engine_type, status, assigned_at)
                    VALUES (:id, :cid, :sid, :tid, :code, 'mastery', 'levelup', 'in_progress', :aa)
                """), {
                    "id": assignment_id, "cid": config_id, "sid": student["id"],
                    "tid": teacher_id, "code": code, "aa": assigned_at,
                })
                await db.commit()
                summary["in_progress"] += 1
                print(f"    [{grade}] {code} {student['name']:4s} in_progress")

            else:
                # Pending: just the assignment
                await db.execute(text("""
                    INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                        test_code, assignment_type, engine_type, status, assigned_at)
                    VALUES (:id, :cid, :sid, :tid, :code, 'mastery', 'levelup', 'pending', :aa)
                """), {
                    "id": assignment_id, "cid": config_id, "sid": student["id"],
                    "tid": teacher_id, "code": code, "aa": assigned_at,
                })
                await db.commit()
                summary["pending"] += 1
                print(f"    [{grade}] {code} {student['name']:4s} pending")

    return summary


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    print("\n" + "=" * 60)
    print("  SEED LEVEL TEST - Dummy results for all grades")
    print("=" * 60)

    SessionLocal = get_session_factory()

    async with SessionLocal() as db:
        await db.execute(text("SELECT 1"))
        print("[OK] DB connected\n")

        # Phase 0: Cleanup
        print("[Phase 0] Cleanup previous seed data")
        await cleanup(db)

        # Phase 1: Accounts
        print("\n[Phase 1] Ensure teacher & create students")
        teacher_id = await ensure_teacher(db)
        students_by_grade = await create_students(db, teacher_id)

        # Phase 2: Load words
        print("\n[Phase 2] Load words from DB")
        words_by_level = await load_words(db)
        total_words = sum(len(v) for v in words_by_level.values())
        if total_words < 100:
            print("[ERROR] Not enough words in DB! Need at least 100 words.")
            print("  Run word import first, then re-run this script.")
            sys.exit(1)

        # Phase 3: Create level test data
        print("\n[Phase 3] Create level test assignments (10 per grade)")
        summary = await create_level_test_data(db, teacher_id, students_by_grade, words_by_level)

        # Summary
        total = sum(summary.values())
        print(f"\n{'=' * 60}")
        print("  SEED COMPLETE!")
        print(f"{'=' * 60}")
        print(f"\n  Total: {total} assignments")
        print(f"    Pending:     {summary['pending']}")
        print(f"    In Progress: {summary['in_progress']}")
        print(f"    Completed:   {summary['completed']}")
        print(f"\n  Grades: {', '.join(GRADES)}")
        print(f"  10 students per grade, 12 grades = {len(GRADES) * 10} students")
        print(f"\n  Test codes: {CLEANUP_PREFIX}0001 ~ {CLEANUP_PREFIX}{total:04d}")
        print(f"\n  Login: demo_teacher / test1234")
        print(f"  Level test tab > 출제 현황 to view results")
        print(f"{'=' * 60}\n")


if __name__ == "__main__":
    asyncio.run(main())
