"""Create a demo teacher account TEST0221/TEST0221 with same data as demo_teacher."""
import asyncio
import uuid
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def uid():
    return str(uuid.uuid4())


async def main():
    engine = create_async_engine(
        settings.DATABASE_URL, echo=False,
        connect_args={"statement_cache_size": 0},
    )
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    pw_hash = pwd_context.hash("TEST0221")

    async with SessionLocal() as db:
        # Get demo_teacher
        r = await db.execute(text("SELECT id FROM users WHERE username = 'demo_teacher'"))
        demo_tid = r.scalar()
        if not demo_tid:
            print("ERROR: demo_teacher not found")
            sys.exit(1)
        print(f"demo_teacher: {demo_tid[:8]}...")

        # Delete old TEST0221 if exists
        r = await db.execute(text("SELECT id FROM users WHERE username = 'TEST0221'"))
        old = r.scalar()
        if old:
            # Clean up old assignments
            r2 = await db.execute(text("SELECT id, test_config_id FROM test_assignments WHERE teacher_id = :tid"), {"tid": old})
            old_assigns = r2.fetchall()
            if old_assigns:
                old_ids = [x.id for x in old_assigns]
                old_cids = [x.test_config_id for x in old_assigns if x.test_config_id]
                await db.execute(text("DELETE FROM test_assignments WHERE id = ANY(:i)"), {"i": old_ids})
                if old_cids:
                    await db.execute(text("""
                        DELETE FROM test_configs WHERE id = ANY(:i)
                        AND id NOT IN (SELECT test_config_id FROM test_assignments WHERE test_config_id IS NOT NULL)
                    """), {"i": old_cids})
            await db.execute(text("DELETE FROM users WHERE id = :id"), {"id": old})
            print("Cleaned old TEST0221")

        # Create teacher
        new_tid = uid()
        await db.execute(text("""
            INSERT INTO users (id, username, password_hash, name, role, school_name, grade, created_at, updated_at)
            VALUES (:id, 'TEST0221', :pw, '김선생 (데모)', 'teacher', '조슈아영어학원', '', now(), now())
        """), {"id": new_tid, "pw": pw_hash})
        print(f"Created TEST0221: {new_tid[:8]}...")

        # Duplicate completed assignments from demo_teacher
        r = await db.execute(text("""
            SELECT ta.test_config_id, ta.student_id, ta.test_code, ta.assignment_type,
                   ta.engine_type, ta.status, ta.test_session_id, ta.assigned_at, ta.completed_at
            FROM test_assignments ta WHERE ta.teacher_id = :tid AND ta.status = 'completed'
        """), {"tid": demo_tid})
        completed = r.fetchall()

        for a in completed:
            r2 = await db.execute(text("""
                SELECT name, test_type, question_count, time_limit_seconds, is_active,
                       book_name, level_range_min, level_range_max, per_question_time_seconds, question_types
                FROM test_configs WHERE id = :id
            """), {"id": a.test_config_id})
            cfg = r2.first()
            if not cfg:
                continue

            new_cid = uid()
            await db.execute(text("""
                INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
                    time_limit_seconds, is_active, book_name, level_range_min, level_range_max,
                    per_question_time_seconds, question_types, created_at, updated_at)
                VALUES (:id, :tid, :name, :tt, :qc, :tl, :ia, :bn, :lmin, :lmax, :pqt, :qt, now(), now())
            """), {
                "id": new_cid, "tid": new_tid, "name": cfg.name,
                "tt": cfg.test_type, "qc": cfg.question_count, "tl": cfg.time_limit_seconds,
                "ia": cfg.is_active, "bn": cfg.book_name or "",
                "lmin": cfg.level_range_min, "lmax": cfg.level_range_max,
                "pqt": cfg.per_question_time_seconds, "qt": cfg.question_types,
            })

            new_code = "V" + a.test_code[1:]
            await db.execute(text("""
                INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                    test_code, assignment_type, engine_type, status, test_session_id, assigned_at, completed_at)
                VALUES (:id, :cid, :sid, :tid, :code, :at, :et, :st, :tsid, :aa, :ca)
            """), {
                "id": uid(), "cid": new_cid, "sid": a.student_id,
                "tid": new_tid, "code": new_code, "at": a.assignment_type,
                "et": a.engine_type, "st": a.status, "tsid": a.test_session_id,
                "aa": a.assigned_at, "ca": a.completed_at,
            })

        # Duplicate pending assignments
        r = await db.execute(text("""
            SELECT ta.test_config_id, ta.student_id, ta.test_code, ta.assignment_type,
                   ta.engine_type, ta.status, ta.assigned_at
            FROM test_assignments ta WHERE ta.teacher_id = :tid AND ta.status = 'pending'
        """), {"tid": demo_tid})
        pending = r.fetchall()

        for a in pending:
            r2 = await db.execute(text("""
                SELECT name, test_type, question_count, time_limit_seconds, is_active,
                       book_name, level_range_min, level_range_max, per_question_time_seconds, question_types
                FROM test_configs WHERE id = :id
            """), {"id": a.test_config_id})
            cfg = r2.first()
            if not cfg:
                continue

            new_cid = uid()
            await db.execute(text("""
                INSERT INTO test_configs (id, teacher_id, name, test_type, question_count,
                    time_limit_seconds, is_active, book_name, level_range_min, level_range_max,
                    per_question_time_seconds, question_types, created_at, updated_at)
                VALUES (:id, :tid, :name, :tt, :qc, :tl, :ia, :bn, :lmin, :lmax, :pqt, :qt, now(), now())
            """), {
                "id": new_cid, "tid": new_tid, "name": cfg.name,
                "tt": cfg.test_type, "qc": cfg.question_count, "tl": cfg.time_limit_seconds,
                "ia": cfg.is_active, "bn": cfg.book_name or "",
                "lmin": cfg.level_range_min, "lmax": cfg.level_range_max,
                "pqt": cfg.per_question_time_seconds, "qt": cfg.question_types,
            })

            new_code = "V" + a.test_code[1:]
            await db.execute(text("""
                INSERT INTO test_assignments (id, test_config_id, student_id, teacher_id,
                    test_code, assignment_type, engine_type, status, assigned_at)
                VALUES (:id, :cid, :sid, :tid, :code, :at, :et, :st, :aa)
            """), {
                "id": uid(), "cid": new_cid, "sid": a.student_id,
                "tid": new_tid, "code": new_code, "at": a.assignment_type,
                "et": a.engine_type, "st": a.status, "aa": a.assigned_at,
            })

        await db.commit()

        print(f"\nDONE!")
        print(f"  Login: TEST0221 / TEST0221")
        print(f"  Duplicated: {len(completed)} completed + {len(pending)} pending assignments")


if __name__ == "__main__":
    asyncio.run(main())
