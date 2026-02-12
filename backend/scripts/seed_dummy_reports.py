"""Create dummy students and 40 completed test reports (4 engines x 10 each).

Reports:
  - xp_stage  x 10  -> mastery-report (learning_sessions)
  - xp_word   x 10  -> mastery-report (learning_sessions)
  - legacy_stage x 10 -> mastery-report (learning_sessions)
  - legacy_word  x 10 -> legacy report  (test_sessions)

Usage:
    cd backend
    python scripts/seed_dummy_reports.py
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

KST = timezone(timedelta(hours=9))
# Unbuffered print
_print = print
def print(*args, **kwargs):
    kwargs.setdefault("flush", True)
    _print(*args, **kwargs)


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


DUMMY_STUDENTS = [
    {"name": "김서연", "grade": "초등6", "username": "dummy_seoyeon", "school": "한빛초등학교"},
    {"name": "이준호", "grade": "중등1", "username": "dummy_junho", "school": "대성중학교"},
    {"name": "박민지", "grade": "중등2", "username": "dummy_minji", "school": "청운중학교"},
    {"name": "최현우", "grade": "중등3", "username": "dummy_hyunwoo", "school": "대성중학교"},
    {"name": "정수빈", "grade": "고등1", "username": "dummy_subin", "school": "명문고등학교"},
    {"name": "강다은", "grade": "초등5", "username": "dummy_daeun", "school": "한빛초등학교"},
    {"name": "윤재민", "grade": "중등1", "username": "dummy_jaemin", "school": "청운중학교"},
    {"name": "한소영", "grade": "고등2", "username": "dummy_soyoung", "school": "명문고등학교"},
]

SCORE_PROFILES = [
    {"label": "상", "acc": (88, 96), "lv": (8, 11), "combo": (12, 25), "spd": (3, 6)},
    {"label": "상", "acc": (85, 95), "lv": (7, 10), "combo": (10, 20), "spd": (3, 7)},
    {"label": "중상", "acc": (75, 87), "lv": (6, 9), "combo": (8, 15), "spd": (4, 8)},
    {"label": "중상", "acc": (72, 84), "lv": (5, 8), "combo": (6, 12), "spd": (5, 9)},
    {"label": "중", "acc": (60, 74), "lv": (4, 7), "combo": (4, 10), "spd": (5, 10)},
    {"label": "중", "acc": (58, 72), "lv": (3, 6), "combo": (3, 8), "spd": (6, 11)},
    {"label": "중하", "acc": (45, 59), "lv": (2, 5), "combo": (2, 6), "spd": (7, 13)},
    {"label": "중하", "acc": (42, 57), "lv": (2, 4), "combo": (2, 5), "spd": (8, 14)},
    {"label": "하", "acc": (30, 44), "lv": (1, 3), "combo": (1, 3), "spd": (9, 16)},
    {"label": "하", "acc": (25, 40), "lv": (1, 2), "combo": (1, 2), "spd": (10, 18)},
]


def uid(): return str(uuid.uuid4())


def rnd_kst(d1=1, d2=30):
    return datetime.now(KST) - timedelta(days=random.randint(d1, d2), hours=random.randint(0, 12), minutes=random.randint(0, 59))


async def cleanup(db: AsyncSession):
    """Delete existing dummy data."""
    r = await db.execute(text(
        "SELECT id FROM test_assignments WHERE test_code LIKE 'DX%' OR test_code LIKE 'DLS%' OR test_code LIKE 'DLW%' OR test_code LIKE 'RPT%' OR test_code LIKE 'RLG%' OR test_code LIKE 'RLW%'"
    ))
    ids = [x.id for x in r.fetchall()]
    if not ids:
        print("  No dummy data to clean")
        return

    # Learning answers
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

    cr = await db.execute(text("SELECT DISTINCT test_config_id FROM test_assignments WHERE id = ANY(:i)"), {"i": ids})
    cids = [x.test_config_id for x in cr.fetchall() if x.test_config_id]

    await db.execute(text("DELETE FROM test_assignments WHERE id = ANY(:i)"), {"i": ids})
    if cids:
        await db.execute(text("""
            DELETE FROM test_configs WHERE id = ANY(:i)
            AND id NOT IN (SELECT test_config_id FROM test_assignments WHERE test_config_id IS NOT NULL)
        """), {"i": cids})

    await db.commit()
    print(f"  Cleaned {len(ids)} dummy assignments")


async def ensure_students(db: AsyncSession, teacher_id: str) -> list[dict]:
    """Create/find dummy students."""
    students = []
    pw = "$2b$12$LJ3m4ys2Yox3GNpGFzqKi.q5B2BZHkEk2X7BuHSRLCClBJOxKNqnm"
    for s in DUMMY_STUDENTS:
        r = await db.execute(text("SELECT id FROM users WHERE username = :u"), {"u": s["username"]})
        row = r.first()
        if row:
            students.append({"id": row.id, **s})
        else:
            sid = uid()
            await db.execute(text("""
                INSERT INTO users (id, username, password_hash, name, role, teacher_id, school_name, grade, created_at, updated_at)
                VALUES (:id, :u, :pw, :n, 'student', :tid, :sch, :gr, now(), now())
            """), {"id": sid, "u": s["username"], "pw": pw, "n": s["name"], "tid": teacher_id, "sch": s["school"], "gr": s["grade"]})
            students.append({"id": sid, **s})
            print(f"    Created {s['name']}")
    await db.commit()
    return students


async def create_mastery_report(
    db: AsyncSession, student: dict, teacher_id: str,
    engine_type: str, profile: dict, words: list[dict], idx: int,
) -> str:
    """Create one mastery-type report (xp_stage, xp_word, legacy_stage). Returns session_id."""
    acc = random.randint(*profile["acc"])
    level = random.randint(*profile["lv"])
    combo = random.randint(*profile["combo"])
    spd = profile["spd"]

    n_questions = 30  # Keep small for speed
    test_words = random.sample(words, min(n_questions, len(words)))
    n_correct = max(1, int(len(test_words) * acc / 100))

    # Test code
    prefix = {"xp_stage": "DXS", "xp_word": "DXW", "legacy_stage": "DLS"}.get(engine_type, "DUM")
    code = f"{prefix}{idx:02d}{chr(65 + random.randint(0,25))}"

    config_id = uid()
    assignment_id = uid()
    session_id = uid()
    atype = "mastery" if engine_type.startswith("xp") else "stage_test"
    started = rnd_kst(1, 30)
    completed = started + timedelta(minutes=random.randint(3, 15))

    # Config + assignment + session
    await db.execute(text("""
        INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
            time_limit_seconds, is_active, level_range_min, level_range_max,
            per_question_time_seconds, question_types, created_at, updated_at)
        VALUES (:id, :tid, :name, 'placement', :qc, :tl, true, 1, 15, 10, 'word_meaning', now(), now())
    """), {"id": config_id, "tid": teacher_id, "name": f"Dummy {engine_type} #{idx}", "qc": n_questions, "tl": n_questions * 10})

    await db.execute(text("""
        INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
            test_code, assignment_type, engine_type, status, assigned_at, completed_at)
        VALUES (:id, :cid, :sid, :tid, :code, :atype, :etype, 'completed', :aa, :ca)
    """), {"id": assignment_id, "cid": config_id, "sid": student["id"], "tid": teacher_id,
           "code": code, "atype": atype, "etype": engine_type, "aa": rnd_kst(5, 60), "ca": rnd_kst(1, 5)})

    await db.execute(text("""
        INSERT INTO learning_sessions (id, student_id, assignment_id,
            current_stage, current_level, words_practiced, words_advanced,
            words_demoted, best_combo, started_at, completed_at)
        VALUES (:id, :sid, :aid, :stg, :lv, :wp, :wa, :wd, :bc, :sa, :ca)
    """), {"id": session_id, "sid": student["id"], "aid": assignment_id,
           "stg": random.randint(1, 5), "lv": level,
           "wp": len(test_words), "wa": int(len(test_words) * acc / 100 * 0.8),
           "wd": random.randint(0, 5), "bc": combo, "sa": started, "ca": completed})

    # Generate answers
    correct_set = set(random.sample(range(len(test_words)), n_correct))
    t = started

    for i, w in enumerate(test_words):
        is_correct = i in correct_set
        time_sec = round(random.uniform(*spd), 1)
        t += timedelta(seconds=time_sec + random.uniform(0.5, 1.5))
        stage = random.choices([1, 2, 3, 4, 5], weights=[15, 25, 30, 20, 10])[0] if is_correct else random.randint(1, 3)
        mastered_at = t if stage >= 5 else None

        # Word mastery (upsert via ON CONFLICT)
        m_id = uid()
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
               "cb": random.randint(0, 5), "lp": t, "ma": mastered_at})
        # Get the actual mastery ID (could be existing or new)
        mr = await db.execute(text("SELECT id FROM word_mastery WHERE student_id = :s AND word_id = :w"),
                              {"s": student["id"], "w": w["id"]})
        m_id = mr.scalar()

        # Correct/wrong answer
        if engine_type == "xp_word":
            qt = random.choice(["word_to_meaning", "meaning_to_word"])
        else:
            qt = random.choice(["word_to_meaning", "meaning_to_word", "listen_and_type", "listen_to_meaning"])
        c_ans = w["korean"] if qt == "word_to_meaning" else w["english"]
        if is_correct:
            s_ans = c_ans
        else:
            others = [x for x in test_words if x["id"] != w["id"]]
            s_ans = random.choice(others)["korean"] if qt == "word_to_meaning" and others else c_ans
            if qt != "word_to_meaning" and others:
                s_ans = random.choice(others)["english"]

        await db.execute(text("""
            INSERT INTO learning_answers (id, session_id, word_mastery_id, word_id,
                stage, is_correct, selected_answer, correct_answer, time_taken_sec, answered_at)
            VALUES (:id, :sid, :mid, :wid, :stg, :ic, :sa, :ca, :tt, :aa)
        """), {"id": uid(), "sid": session_id, "mid": m_id, "wid": w["id"],
               "stg": stage, "ic": is_correct, "sa": s_ans, "ca": c_ans, "tt": time_sec, "aa": t})

    await db.commit()
    return session_id


async def create_legacy_report(
    db: AsyncSession, student: dict, teacher_id: str,
    profile: dict, words: list[dict], idx: int,
) -> str:
    """Create one legacy_word report (test_sessions based). Returns test_session_id."""
    acc = random.randint(*profile["acc"])
    level = random.randint(*profile["lv"])
    spd = profile["spd"]

    n_questions = 30
    test_words = random.sample(words, min(n_questions, len(words)))
    n_correct = max(1, int(n_questions * acc / 100))

    code = f"DLW{idx:02d}{chr(65 + random.randint(0, 25))}"
    config_id = uid()
    assignment_id = uid()
    ts_id = uid()
    started = rnd_kst(1, 30)
    completed = started + timedelta(minutes=random.randint(3, 15))

    rank_names = {1: "Iron", 2: "Bronze", 3: "Silver", 4: "Gold", 5: "Platinum",
                  6: "Emerald", 7: "Diamond", 8: "Master", 9: "Grandmaster", 10: "Challenger", 11: "Legend"}

    await db.execute(text("""
        INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
            time_limit_seconds, is_active, level_range_min, level_range_max,
            per_question_time_seconds, question_types, created_at, updated_at)
        VALUES (:id, :tid, :name, 'placement', :qc, :tl, true, :lmin, :lmax, 10, 'word_meaning', now(), now())
    """), {"id": config_id, "tid": teacher_id, "name": f"Dummy legacy_word #{idx}",
           "qc": n_questions, "tl": n_questions * 10, "lmin": max(1, level - 1), "lmax": min(15, level + 1)})

    await db.execute(text("""
        INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
            test_code, assignment_type, engine_type, status, assigned_at, completed_at)
        VALUES (:id, :cid, :sid, :tid, :code, 'legacy', 'legacy_word', 'completed', :aa, :ca)
    """), {"id": assignment_id, "cid": config_id, "sid": student["id"], "tid": teacher_id,
           "code": code, "aa": rnd_kst(5, 60), "ca": rnd_kst(1, 5)})

    await db.execute(text("""
        INSERT INTO test_sessions (id, student_id, test_config_id, test_type,
            total_questions, correct_count, determined_level, determined_sublevel,
            rank_name, score, started_at, completed_at)
        VALUES (:id, :sid, :cid, 'placement', :tq, :cc, :dl, :ds, :rn, :sc, :sa, :ca)
    """), {"id": ts_id, "sid": student["id"], "cid": config_id,
           "tq": n_questions, "cc": n_correct, "dl": level, "ds": random.randint(1, 3),
           "rn": rank_names.get(level, "Iron"), "sc": acc, "sa": started, "ca": completed})

    await db.execute(text("UPDATE test_assignments SET test_session_id = :tsid WHERE id = :aid"),
                     {"tsid": ts_id, "aid": assignment_id})

    # Answers
    correct_set = set(random.sample(range(len(test_words)), n_correct))
    t = started

    for i, w in enumerate(test_words):
        is_correct = i in correct_set
        time_sec = round(random.uniform(*spd), 1)
        t += timedelta(seconds=time_sec + random.uniform(0.5, 1.5))
        c_ans = w["korean"]
        if is_correct:
            s_ans = c_ans
        else:
            others = [x for x in test_words if x["id"] != w["id"]]
            s_ans = random.choice(others)["korean"] if others else c_ans

        await db.execute(text("""
            INSERT INTO test_answers (id, test_session_id, word_id,
                selected_answer, correct_answer, is_correct, question_order, answered_at)
            VALUES (:id, :tsid, :wid, :sa, :ca, :ic, :qo, :aa)
        """), {"id": uid(), "tsid": ts_id, "wid": w["id"],
               "sa": s_ans, "ca": c_ans, "ic": is_correct, "qo": i + 1, "aa": t})

    await db.commit()
    return ts_id


async def main():
    print("\n[SEED] Create dummy students + 40 reports (4 engines x 10)")
    print("=" * 60)

    SessionLocal = get_session_factory()

    async with SessionLocal() as db:
        await db.execute(text("SELECT 1"))
        print("[OK] Connected")

        # Teacher
        tr = await db.execute(text("SELECT id, name FROM users WHERE role = 'teacher' LIMIT 1"))
        teacher = tr.first()
        if not teacher:
            print("[ERROR] No teacher"); sys.exit(1)
        print(f"Teacher: {teacher.name}\n")

        # Cleanup
        print("[Phase 0] Cleanup")
        await cleanup(db)

        # Students
        print("\n[Phase 1] Students")
        students = await ensure_students(db, teacher.id)
        print(f"  {len(students)} ready\n")

        # Words
        print("[Phase 2] Load words")
        xp_words = []
        legacy_words = []
        for lv in range(1, 16):
            r = await db.execute(text(
                "SELECT id, english, korean, level, lesson FROM words WHERE level = :lv AND is_excluded = false ORDER BY lesson LIMIT 50"
            ), {"lv": lv})
            rows = [{"id": x.id, "english": x.english, "korean": x.korean, "level": x.level, "lesson": x.lesson} for x in r.fetchall()]
            xp_words.extend(rows)
            if 7 <= lv <= 9:
                legacy_words.extend(rows)
        print(f"  XP: {len(xp_words)} words, Legacy: {len(legacy_words)} words\n")

        if len(xp_words) < 30 or len(legacy_words) < 30:
            print("[ERROR] Not enough words"); sys.exit(1)

        # Phase 3: Create reports
        print("[Phase 3] Create 40 reports")
        results = {}

        for engine in ["xp_stage", "xp_word", "legacy_stage", "legacy_word"]:
            print(f"\n  [{engine}]")
            pool = legacy_words if engine.startswith("legacy") else xp_words
            ids = []

            for i in range(10):
                student = students[i % len(students)]
                profile = SCORE_PROFILES[i]

                if engine == "legacy_word":
                    rid = await create_legacy_report(db, student, teacher.id, profile, pool, i + 1)
                    rtype = "result"
                else:
                    rid = await create_mastery_report(db, student, teacher.id, engine, profile, pool, i + 1)
                    rtype = "mastery-report"

                ids.append({"id": rid, "type": rtype, "student": student["name"], "label": profile["label"]})
                print(f"    #{i+1} {student['name']} ({profile['label']}) -> {rid[:8]}...")

            results[engine] = ids

        # Summary
        print(f"\n{'=' * 60}")
        print("  40 Dummy Reports Created!")
        print(f"{'=' * 60}")
        for engine, ids in results.items():
            rtype = ids[0]["type"] if ids else "?"
            print(f"\n  [{engine}] -> /{rtype}/{{id}}")
            for r in ids:
                print(f"    {r['student']:6s} ({r['label']:2s}) {r['id']}")

        print(f"\n{'=' * 60}")
        print("  XP:     /mastery-report/<session_id>")
        print("  Legacy: /result/<test_session_id> (legacy_word)")
        print("          /mastery-report/<session_id> (legacy_stage)")
        print(f"{'=' * 60}\n")


if __name__ == "__main__":
    asyncio.run(main())
