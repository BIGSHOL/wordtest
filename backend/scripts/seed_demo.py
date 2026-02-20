"""Unified demo seed script for 2-engine architecture (levelup + legacy).

Creates:
  1. Demo accounts (teacher + 5 students)
  2. 20 pending test codes (students can enter to start tests)
  3. 20 completed reports (teacher sees on dashboard)

Idempotent: safe to run multiple times (cleanup first, then re-seed).

Usage:
    cd backend
    python scripts/seed_demo.py
"""
import asyncio
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

# Pre-computed bcrypt hash for "test1234"
PW_HASH = "$2b$10$6BVAnye5fMtUg9eo.BIk1es0sJSbeobYY4OU/NAQXrOR4Qg.keDf6"

TEACHER = {"username": "demo_teacher", "name": "김선생", "school": "조슈아영어학원", "grade": ""}

STUDENTS = [
    {"username": "student01", "name": "김민수", "school": "조슈아영어학원", "grade": "중1"},
    {"username": "student02", "name": "이지은", "school": "조슈아영어학원", "grade": "중2"},
    {"username": "student03", "name": "박서준", "school": "조슈아영어학원", "grade": "중3"},
    {"username": "student04", "name": "최예린", "school": "조슈아영어학원", "grade": "초6"},
    {"username": "student05", "name": "정하늘", "school": "조슈아영어학원", "grade": "고1"},
]

# Canonical question types (from question_engines/__init__.py)
Q_TYPES = ["en_to_ko", "ko_to_en", "listen_en", "emoji", "ko_type"]
Q_WEIGHTS = [40, 30, 15, 10, 5]  # Percentage distribution

RANK_NAMES = {
    1: "Iron", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Platinum",
    6: "Emerald", 7: "Diamond", 8: "Master", 9: "Grandmaster", 10: "Challenger",
    11: "Legend", 12: "Legend", 13: "Legend", 14: "Legend", 15: "Legend",
}

SCORE_PROFILES = [
    {"label": "상",  "acc": (85, 95), "lv": (7, 10), "combo": (10, 20), "spd": (3, 7)},
    {"label": "중상", "acc": (72, 84), "lv": (5, 8),  "combo": (6, 12),  "spd": (5, 9)},
    {"label": "중",  "acc": (60, 74), "lv": (3, 6),  "combo": (4, 10),  "spd": (5, 10)},
    {"label": "중하", "acc": (45, 59), "lv": (2, 4),  "combo": (2, 6),   "spd": (7, 13)},
    {"label": "중",  "acc": (58, 72), "lv": (3, 5),  "combo": (3, 8),   "spd": (6, 11)},
]

# Test config templates
PENDING_CONFIGS = [
    {"name": "레벨업 배치고사",   "engine": "levelup", "qcount": 50, "lmin": 1, "lmax": 10, "qtypes": "en_to_ko,ko_to_en",           "ttype": "placement"},
    {"name": "레벨업 주간테스트", "engine": "levelup", "qcount": 30, "lmin": 1, "lmax": 5,  "qtypes": "en_to_ko,ko_to_en,listen_en", "ttype": "periodic"},
    {"name": "레거시 배치고사",   "engine": "legacy",  "qcount": 50, "lmin": 1, "lmax": 10, "qtypes": "en_to_ko,ko_to_en",           "ttype": "placement"},
    {"name": "레거시 주간테스트", "engine": "legacy",  "qcount": 20, "lmin": 3, "lmax": 5,  "qtypes": "en_to_ko,ko_to_en",           "ttype": "periodic"},
]

# Cleanup prefixes - identify all demo data
CLEANUP_PREFIXES = ["DM", "LU", "LG", "LVUP", "LGCY", "TEST", "ENG_", "DX", "DLS", "DLW", "RPT", "RLG", "RLW"]

# ── Helpers ──────────────────────────────────────────────────────────────────

# Unbuffered print
_print = print
def print(*args, **kwargs):
    kwargs.setdefault("flush", True)
    _print(*args, **kwargs)


def uid():
    return str(uuid.uuid4())


def rnd_kst(d1=1, d2=14):
    """Random KST datetime within d1..d2 days ago."""
    return datetime.now(KST) - timedelta(
        days=random.randint(d1, d2),
        hours=random.randint(0, 12),
        minutes=random.randint(0, 59),
    )


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ── Phase 0: Cleanup ────────────────────────────────────────────────────────

async def cleanup(db: AsyncSession):
    """Delete all demo data identified by test_code prefix."""
    where_clause = " OR ".join(f"test_code LIKE '{p}%'" for p in CLEANUP_PREFIXES)
    r = await db.execute(text(f"SELECT id FROM test_assignments WHERE {where_clause}"))
    ids = [x.id for x in r.fetchall()]
    if not ids:
        print("  No demo data to clean")
        return

    # Learning answers via session IDs
    sr = await db.execute(text("SELECT id FROM learning_sessions WHERE assignment_id = ANY(:i)"), {"i": ids})
    sids = [x.id for x in sr.fetchall()]
    if sids:
        await db.execute(text("DELETE FROM learning_answers WHERE session_id = ANY(:i)"), {"i": sids})
    await db.execute(text("DELETE FROM learning_sessions WHERE assignment_id = ANY(:i)"), {"i": ids})
    await db.execute(text("DELETE FROM word_mastery WHERE assignment_id = ANY(:i)"), {"i": ids})

    # Test answers/sessions via assignment
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

    # Collect config IDs before deleting assignments
    cr = await db.execute(text("SELECT DISTINCT test_config_id FROM test_assignments WHERE id = ANY(:i)"), {"i": ids})
    cids = [x.test_config_id for x in cr.fetchall() if x.test_config_id]

    await db.execute(text("DELETE FROM test_assignments WHERE id = ANY(:i)"), {"i": ids})

    # Orphaned configs
    if cids:
        await db.execute(text("""
            DELETE FROM test_configs WHERE id = ANY(:i)
            AND id NOT IN (SELECT test_config_id FROM test_assignments WHERE test_config_id IS NOT NULL)
        """), {"i": cids})

    await db.commit()
    print(f"  Cleaned {len(ids)} demo assignments")


# ── Phase 1: Accounts ───────────────────────────────────────────────────────

async def ensure_accounts(db: AsyncSession) -> tuple[str, list[dict]]:
    """Create or find teacher + students. Returns (teacher_id, students)."""
    # Teacher
    r = await db.execute(text("SELECT id FROM users WHERE username = :u"), {"u": TEACHER["username"]})
    row = r.first()
    if row:
        teacher_id = row.id
        await db.execute(text("UPDATE users SET password_hash = :pw WHERE id = :id"), {"pw": PW_HASH, "id": teacher_id})
        print(f"  Teacher exists (pw reset): {TEACHER['name']} ({TEACHER['username']})")
    else:
        teacher_id = uid()
        await db.execute(text("""
            INSERT INTO users (id, username, password_hash, name, role, school_name, grade, created_at, updated_at)
            VALUES (:id, :u, :pw, :n, 'teacher', :sch, '', now(), now())
        """), {"id": teacher_id, "u": TEACHER["username"], "pw": PW_HASH, "n": TEACHER["name"], "sch": TEACHER["school"]})
        print(f"  Created teacher: {TEACHER['name']} ({TEACHER['username']})")

    # Students
    students = []
    for s in STUDENTS:
        r = await db.execute(text("SELECT id FROM users WHERE username = :u"), {"u": s["username"]})
        row = r.first()
        if row:
            await db.execute(text(
                "UPDATE users SET password_hash = :pw, teacher_id = :tid, school_name = :sch, grade = :gr WHERE id = :id"
            ), {"pw": PW_HASH, "tid": teacher_id, "sch": s["school"], "gr": s["grade"], "id": row.id})
            students.append({"id": row.id, **s})
        else:
            sid = uid()
            await db.execute(text("""
                INSERT INTO users (id, username, password_hash, name, role, teacher_id, school_name, grade, created_at, updated_at)
                VALUES (:id, :u, :pw, :n, 'student', :tid, :sch, :gr, now(), now())
            """), {"id": sid, "u": s["username"], "pw": PW_HASH, "n": s["name"],
                   "tid": teacher_id, "sch": s["school"], "gr": s["grade"]})
            students.append({"id": sid, **s})
            print(f"    Created {s['name']} ({s['username']})")

    await db.commit()
    return teacher_id, students


# ── Phase 2: Pending Test Codes ──────────────────────────────────────────────

async def create_pending_codes(db: AsyncSession, teacher_id: str, students: list[dict]) -> list[dict]:
    """Create pending test assignments. Returns list of {code, engine, student_name}."""
    codes = []
    prefixes = {0: "LVUP", 1: "LVUP", 2: "LGCY", 3: "LGCY"}
    suffixes = {0: "01", 1: "02", 2: "01", 3: "02"}

    for ci, cfg in enumerate(PENDING_CONFIGS):
        for si, student in enumerate(students):
            code = f"{prefixes[ci]}{si+1:02d}{suffixes[ci]}"

            # Each student needs its own config (UniqueConstraint on config_id+student_id)
            config_id = uid()
            await db.execute(text("""
                INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
                    time_limit_seconds, is_active, book_name, level_range_min, level_range_max,
                    per_question_time_seconds, question_types, created_at, updated_at)
                VALUES (:id, :tid, :name, :tt, :qc, :tl, true, '', :lmin, :lmax, 10, :qt, now(), now())
            """), {
                "id": config_id, "tid": teacher_id, "name": cfg["name"],
                "tt": cfg["ttype"], "qc": cfg["qcount"], "tl": cfg["qcount"] * 10,
                "lmin": cfg["lmin"], "lmax": cfg["lmax"], "qt": cfg["qtypes"],
            })

            assignment_id = uid()
            await db.execute(text("""
                INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                    test_code, assignment_type, engine_type, status, assigned_at)
                VALUES (:id, :cid, :sid, :tid, :code, 'mastery', :et, 'pending', now())
            """), {
                "id": assignment_id, "cid": config_id, "sid": student["id"],
                "tid": teacher_id, "code": code, "et": cfg["engine"],
            })

            codes.append({"code": code, "engine": cfg["engine"], "student": student["name"], "config": cfg["name"]})

    await db.commit()
    return codes


# ── Phase 3: Completed Reports ───────────────────────────────────────────────

async def load_words(db: AsyncSession) -> list[dict]:
    """Load words from DB grouped by level."""
    words = []
    for lv in range(1, 16):
        r = await db.execute(text(
            "SELECT id, english, korean, level FROM words WHERE level = :lv AND is_excluded = false ORDER BY random() LIMIT 50"
        ), {"lv": lv})
        for x in r.fetchall():
            words.append({"id": x.id, "english": x.english, "korean": x.korean, "level": x.level})
    return words


async def create_completed_report(
    db: AsyncSession,
    student: dict,
    teacher_id: str,
    engine_type: str,
    profile: dict,
    all_words: list[dict],
    report_idx: int,
) -> dict:
    """Create one completed report with all required data. Returns summary dict."""
    acc = random.randint(*profile["acc"])
    level = random.randint(*profile["lv"])
    combo = random.randint(*profile["combo"])
    spd = profile["spd"]
    sublevel = random.randint(1, 3)
    rank = RANK_NAMES.get(level, "Iron")

    # Select words around the target level
    eligible = [w for w in all_words if abs(w["level"] - level) <= 2]
    if len(eligible) < 20:
        eligible = all_words[:50]
    n_questions = min(30, len(eligible))
    test_words = random.sample(eligible, n_questions)
    n_correct = max(1, int(n_questions * acc / 100))

    # IDs
    config_id = uid()
    assignment_id = uid()
    session_id = uid()
    ts_id = uid()  # TestSession ID (for dashboard)

    # Test code for completed report
    prefix = "DMLU" if engine_type == "levelup" else "DMLG"
    code = f"{prefix}{report_idx:04d}"

    started = rnd_kst(1, 14)
    completed = started + timedelta(minutes=random.randint(3, 12))
    score = acc

    # 1. TestConfig
    await db.execute(text("""
        INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
            time_limit_seconds, is_active, level_range_min, level_range_max,
            per_question_time_seconds, question_types, created_at, updated_at)
        VALUES (:id, :tid, :name, 'placement', :qc, :tl, true, 1, 15, 10,
                'en_to_ko,ko_to_en', now(), now())
    """), {"id": config_id, "tid": teacher_id,
           "name": f"Demo {engine_type} #{report_idx}", "qc": n_questions, "tl": n_questions * 10})

    # 2. TestSession FIRST (FK dependency: test_assignments.test_session_id -> test_sessions.id)
    await db.execute(text("""
        INSERT INTO test_sessions (id, student_id, test_config_id, test_type,
            total_questions, correct_count, determined_level, determined_sublevel,
            rank_name, score, started_at, completed_at)
        VALUES (:id, :sid, :cid, 'placement', :tq, :cc, :dl, :ds, :rn, :sc, :sa, :ca)
    """), {"id": ts_id, "sid": student["id"], "cid": config_id,
           "tq": n_questions, "cc": n_correct, "dl": level, "ds": sublevel,
           "rn": rank, "sc": score, "sa": started, "ca": completed})

    # 3. TestAssignment (completed, references test_session_id)
    await db.execute(text("""
        INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
            test_code, assignment_type, engine_type, status, test_session_id, assigned_at, completed_at)
        VALUES (:id, :cid, :sid, :tid, :code, 'mastery', :et, 'completed', :tsid, :aa, :ca)
    """), {"id": assignment_id, "cid": config_id, "sid": student["id"],
           "tid": teacher_id, "code": code, "et": engine_type, "tsid": ts_id,
           "aa": started - timedelta(days=1), "ca": completed})

    # 4. LearningSession (for mastery-report endpoint)
    await db.execute(text("""
        INSERT INTO learning_sessions (id, student_id, assignment_id,
            current_stage, current_level, words_practiced, words_advanced,
            words_demoted, best_combo, started_at, completed_at)
        VALUES (:id, :sid, :aid, :stg, :lv, :wp, :wa, :wd, :bc, :sa, :ca)
    """), {"id": session_id, "sid": student["id"], "aid": assignment_id,
           "stg": random.randint(1, 5), "lv": level,
           "wp": n_questions, "wa": n_correct, "wd": random.randint(0, 3),
           "bc": combo, "sa": started, "ca": completed})

    # 5. Generate answers
    correct_set = set(random.sample(range(len(test_words)), n_correct))
    t = started

    for i, w in enumerate(test_words):
        is_correct = i in correct_set
        time_sec = round(random.uniform(*spd), 1)
        t += timedelta(seconds=time_sec + random.uniform(0.5, 1.5))
        stage = random.choices([1, 2, 3, 4, 5], weights=[15, 25, 30, 20, 10])[0]
        qt = random.choices(Q_TYPES, weights=Q_WEIGHTS)[0]

        # Determine correct/selected answers based on question type
        if qt in ("en_to_ko", "listen_en", "listen_ko"):
            c_ans = w["korean"]
        else:
            c_ans = w["english"]

        if is_correct:
            s_ans = c_ans
        else:
            others = [x for x in test_words if x["id"] != w["id"]]
            if others:
                pick = random.choice(others)
                s_ans = pick["korean"] if qt in ("en_to_ko", "listen_en", "listen_ko") else pick["english"]
            else:
                s_ans = c_ans

        # WordMastery (upsert)
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
        """), {"id": m_id, "sid": student["id"], "wid": w["id"], "aid": assignment_id,
               "stg": stage, "ss": random.randint(0, 3), "c": 1 if is_correct else 0,
               "cb": random.randint(0, combo), "lp": t, "ma": mastered_at})

        # Get actual mastery ID
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
        """), {"id": uid(), "sid": session_id, "mid": actual_m_id, "wid": w["id"],
               "stg": stage, "ic": is_correct, "sa": s_ans, "ca": c_ans,
               "tt": time_sec, "aa": t, "qt": qt})

        # TestAnswer (for enhanced report endpoint)
        await db.execute(text("""
            INSERT INTO test_answers (id, test_session_id, word_id,
                selected_answer, correct_answer, is_correct, question_order,
                answered_at, question_type)
            VALUES (:id, :tsid, :wid, :sa, :ca, :ic, :qo, :aa, :qt)
        """), {"id": uid(), "tsid": ts_id, "wid": w["id"],
               "sa": s_ans, "ca": c_ans, "ic": is_correct, "qo": i + 1,
               "aa": t, "qt": qt})

    await db.commit()

    return {
        "student": student["name"],
        "engine": engine_type,
        "level": level,
        "rank": rank,
        "score": score,
        "session_id": session_id,
        "test_session_id": ts_id,
        "code": code,
    }


# ── Main ─────────────────────────────────────────────────────────────────────

async def main():
    print("\n" + "=" * 60)
    print("  SEED DEMO - 2-Engine Architecture (levelup + legacy)")
    print("=" * 60)

    SessionLocal = get_session_factory()

    async with SessionLocal() as db:
        await db.execute(text("SELECT 1"))
        print("[OK] DB connected\n")

        # Phase 0: Cleanup
        print("[Phase 0] Cleanup existing demo data")
        await cleanup(db)

        # Phase 1: Accounts
        print("\n[Phase 1] Accounts")
        teacher_id, students = await ensure_accounts(db)
        print(f"  Teacher ID: {teacher_id[:8]}...")
        print(f"  {len(students)} students ready\n")

        # Phase 2: Pending test codes
        print("[Phase 2] Pending test codes")
        codes = await create_pending_codes(db, teacher_id, students)
        print(f"  Created {len(codes)} pending test codes\n")

        # Phase 3: Completed reports
        print("[Phase 3] Completed reports")
        words = await load_words(db)
        print(f"  Loaded {len(words)} words from DB")

        if len(words) < 20:
            print("[ERROR] Not enough words in DB! Need at least 20 words.")
            print("  Run word import first, then re-run this script.")
            sys.exit(1)

        reports = []
        report_idx = 1
        for si, student in enumerate(students):
            profile = SCORE_PROFILES[si % len(SCORE_PROFILES)]
            for engine in ["levelup", "legacy"]:
                for _ in range(2):  # 2 reports per engine per student
                    r = await create_completed_report(
                        db, student, teacher_id, engine, profile, words, report_idx,
                    )
                    reports.append(r)
                    print(f"    #{report_idx:2d} {r['student']:4s} ({r['engine']:7s}) Lv{r['level']:2d} {r['rank']:12s} {r['score']}%")
                    report_idx += 1

        # ── Summary ──────────────────────────────────────────────────────────
        print(f"\n{'=' * 60}")
        print("  SEED COMPLETE!")
        print(f"{'=' * 60}")

        print("\n  [Login Info]")
        print(f"  Teacher: {TEACHER['username']} / test1234")
        for s in STUDENTS:
            print(f"  Student: {s['username']} / test1234  ({s['name']})")

        print(f"\n  [Pending Test Codes] ({len(codes)})")
        for engine in ["levelup", "legacy"]:
            engine_codes = [c for c in codes if c["engine"] == engine]
            print(f"\n  {engine}:")
            for c in engine_codes:
                print(f"    {c['code']}  {c['student']:4s}  {c['config']}")

        print(f"\n  [Completed Reports] ({len(reports)})")
        for r in reports:
            print(f"    {r['code']:8s}  {r['student']:4s}  {r['engine']:7s}  Lv{r['level']:2d}  {r['rank']:12s}  {r['score']}%")

        print(f"\n  [Report URLs]")
        print(f"  Mastery: /api/v1/stats/student/{{id}}/mastery-report/{{session_id}}")
        print(f"  Enhanced: /api/v1/stats/student/{{id}}/report/{{test_session_id}}")
        print(f"{'=' * 60}\n")


if __name__ == "__main__":
    asyncio.run(main())
