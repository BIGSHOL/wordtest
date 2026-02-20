"""Create 20 test codes for testing all question types.

TEST0210-TEST0219: One question type each (10 tests)
TEST0220-TEST0229: Mixed pairs of 2 types (10 tests)

All: engine=levelup, level_range=1-10, question_count=30

Usage:
    cd backend
    python scripts/seed_test_types.py
"""
import asyncio
import uuid
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

# ── Config ───────────────────────────────────────────────────────────────────

# 8 canonical question types
SINGLE_TYPES = [
    ("TEST0210", "en_to_ko",    "영한 선택"),
    ("TEST0211", "ko_to_en",    "한영 선택"),
    ("TEST0212", "listen_en",   "듣기 영어"),
    ("TEST0213", "listen_ko",   "듣기 한국어"),
    ("TEST0214", "listen_type", "듣기 타이핑"),
    ("TEST0215", "ko_type",     "한영 타이핑"),
    ("TEST0216", "emoji",       "이모지"),
    ("TEST0217", "sentence",    "예문 빈칸"),
    ("TEST0218", "en_to_ko,ko_to_en", "기본 (영한+한영)"),
    ("TEST0219", "listen_en,listen_ko,listen_type", "리스닝 종합"),
]

MIXED_TYPES = [
    ("TEST0220", "en_to_ko,listen_en",       "영한+듣기영어"),
    ("TEST0221", "ko_to_en,ko_type",         "한영+한영타이핑"),
    ("TEST0222", "en_to_ko,emoji",           "영한+이모지"),
    ("TEST0223", "ko_to_en,sentence",        "한영+예문빈칸"),
    ("TEST0224", "listen_en,emoji",          "듣기영어+이모지"),
    ("TEST0225", "listen_ko,ko_type",        "듣기한국어+한영타이핑"),
    ("TEST0226", "listen_type,sentence",     "듣기타이핑+예문빈칸"),
    ("TEST0227", "en_to_ko,ko_to_en,emoji",  "영한+한영+이모지"),
    ("TEST0228", "listen_en,listen_ko,ko_type", "듣기영어+한국어+타이핑"),
    ("TEST0229", "en_to_ko,sentence,emoji",  "영한+예문+이모지"),
]

ALL_CONFIGS = SINGLE_TYPES + MIXED_TYPES

# Unbuffered print
_print = print
def print(*args, **kwargs):
    kwargs.setdefault("flush", True)
    _print(*args, **kwargs)


def uid():
    return str(uuid.uuid4())


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def main():
    print("\n" + "=" * 60)
    print("  SEED TEST TYPES - 20 question type test codes")
    print("=" * 60)

    SessionLocal = get_session_factory()

    async with SessionLocal() as db:
        await db.execute(text("SELECT 1"))
        print("[OK] DB connected\n")

        # Find demo teacher
        r = await db.execute(text("SELECT id FROM users WHERE username = 'demo_teacher'"))
        teacher_row = r.first()
        if not teacher_row:
            print("[ERROR] demo_teacher not found. Run seed_demo.py first.")
            sys.exit(1)
        teacher_id = teacher_row.id
        print(f"  Teacher: demo_teacher ({teacher_id[:8]}...)")

        # Find first student (student01)
        r = await db.execute(text("SELECT id, name FROM users WHERE username = 'student01'"))
        student_row = r.first()
        if not student_row:
            print("[ERROR] student01 not found. Run seed_demo.py first.")
            sys.exit(1)
        student_id = student_row.id
        student_name = student_row.name
        print(f"  Student: student01 / {student_name} ({student_id[:8]}...)\n")

        # Cleanup existing TEST02xx codes
        print("[Phase 1] Cleanup existing TEST02xx codes")
        r = await db.execute(text(
            "SELECT id, test_config_id FROM test_assignments WHERE test_code LIKE 'TEST02%'"
        ))
        existing = r.fetchall()
        if existing:
            ids = [x.id for x in existing]
            cids = [x.test_config_id for x in existing if x.test_config_id]

            # Clean FK chain
            sr = await db.execute(text(
                "SELECT id FROM learning_sessions WHERE assignment_id = ANY(:i)"
            ), {"i": ids})
            sids = [x.id for x in sr.fetchall()]
            if sids:
                await db.execute(text("DELETE FROM learning_answers WHERE session_id = ANY(:i)"), {"i": sids})
            await db.execute(text("DELETE FROM learning_sessions WHERE assignment_id = ANY(:i)"), {"i": ids})
            await db.execute(text("DELETE FROM word_mastery WHERE assignment_id = ANY(:i)"), {"i": ids})
            await db.execute(text("DELETE FROM test_assignments WHERE id = ANY(:i)"), {"i": ids})
            if cids:
                await db.execute(text("""
                    DELETE FROM test_configs WHERE id = ANY(:i)
                    AND id NOT IN (SELECT test_config_id FROM test_assignments WHERE test_config_id IS NOT NULL)
                """), {"i": cids})
            await db.commit()
            print(f"  Cleaned {len(existing)} existing codes")
        else:
            print("  No existing TEST02xx codes")

        # Create 20 test codes
        print(f"\n[Phase 2] Creating {len(ALL_CONFIGS)} test codes")
        created = []

        for code, qtypes, label in ALL_CONFIGS:
            config_id = uid()
            await db.execute(text("""
                INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
                    time_limit_seconds, is_active, book_name, level_range_min, level_range_max,
                    per_question_time_seconds, question_types, created_at, updated_at)
                VALUES (:id, :tid, :name, 'placement', 30, 300, true, '', 1, 10, 10, :qt, now(), now())
            """), {
                "id": config_id, "tid": teacher_id,
                "name": f"[테스트] {label}", "qt": qtypes,
            })

            assignment_id = uid()
            await db.execute(text("""
                INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                    test_code, assignment_type, engine_type, status, assigned_at)
                VALUES (:id, :cid, :sid, :tid, :code, 'mastery', 'levelup', 'pending', now())
            """), {
                "id": assignment_id, "cid": config_id, "sid": student_id,
                "tid": teacher_id, "code": code, "et": "levelup",
            })

            created.append({"code": code, "qtypes": qtypes, "label": label})
            print(f"  {code}  {label:20s}  ({qtypes})")

        await db.commit()

        # Summary
        print(f"\n{'=' * 60}")
        print("  DONE!")
        print(f"{'=' * 60}")
        print(f"\n  Student: student01 / test1234 ({student_name})")
        print(f"\n  [Single Type Tests] TEST0210-TEST0219")
        for c in created[:10]:
            print(f"    {c['code']}  {c['label']:20s}  {c['qtypes']}")
        print(f"\n  [Mixed Type Tests] TEST0220-TEST0229")
        for c in created[10:]:
            print(f"    {c['code']}  {c['label']:20s}  {c['qtypes']}")
        print(f"\n{'=' * 60}\n")


if __name__ == "__main__":
    asyncio.run(main())
