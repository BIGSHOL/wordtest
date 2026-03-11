"""User management service (master only)."""
import secrets
import string
from typing import Any

from sqlalchemy import func, select, text, union_all
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import get_password_hash_async
from app.models.grammar_answer import GrammarAnswer
from app.models.grammar_session import GrammarSession
from app.models.learning_answer import LearningAnswer
from app.models.learning_session import LearningSession
from app.models.test_answer import TestAnswer
from app.models.test_session import TestSession
from app.models.user import User


async def list_all_users_with_activity(
    db: AsyncSession,
    page: int = 1,
    page_size: int = 50,
    search: str | None = None,
    role_filter: str | None = None,
    sort_by: str = "created_at",
    sort_dir: str = "desc",
) -> tuple[list[dict], int]:
    """Return paginated list of users with activity stats via UNION ALL subqueries."""

    # --- Subquery 1: LearningSession activity per student ---
    ls_last = (
        select(
            LearningSession.student_id.label("user_id"),
            func.max(LearningSession.started_at).label("last_active"),
            func.count(LearningSession.id).label("total_sessions"),
        )
        .group_by(LearningSession.student_id)
        .subquery("ls_agg")
    )

    # LearningAnswer correct counts per session
    la_correct = (
        select(
            LearningAnswer.session_id.label("session_id"),
            func.sum(
                func.cast(LearningAnswer.is_correct, type_=func.count().type)
            ).label("correct_count"),
            func.count(LearningAnswer.id).label("total_count"),
        )
        .group_by(LearningAnswer.session_id)
        .subquery("la_agg")
    )

    ls_acc = (
        select(
            LearningSession.student_id.label("user_id"),
            func.avg(
                func.cast(la_correct.c.correct_count, type_=func.count().type)
                * 100.0
                / func.nullif(
                    func.cast(la_correct.c.total_count, type_=func.count().type), 0
                )
            ).label("accuracy_avg"),
        )
        .join(la_correct, LearningSession.id == la_correct.c.session_id)
        .group_by(LearningSession.student_id)
        .subquery("ls_acc_agg")
    )

    # --- Subquery 2: GrammarSession activity per student ---
    gs_agg = (
        select(
            GrammarSession.student_id.label("user_id"),
            func.max(GrammarSession.started_at).label("last_active"),
            func.count(GrammarSession.id).label("total_sessions"),
            func.avg(
                GrammarSession.correct_count * 100.0
                / func.nullif(GrammarSession.total_questions, 0)
            ).label("accuracy_avg"),
        )
        .group_by(GrammarSession.student_id)
        .subquery("gs_agg")
    )

    # --- Subquery 3: TestSession activity per student ---
    ts_agg = (
        select(
            TestSession.student_id.label("user_id"),
            func.max(TestSession.started_at).label("last_active"),
            func.count(TestSession.id).label("total_sessions"),
            func.avg(
                TestSession.correct_count * 100.0
                / func.nullif(TestSession.total_questions, 0)
            ).label("accuracy_avg"),
        )
        .group_by(TestSession.student_id)
        .subquery("ts_agg")
    )

    # --- Combined stats per user (raw SQL UNION ALL for efficiency) ---
    # We build a raw text-based CTE to aggregate all three sources in one pass.
    # SQLAlchemy union_all requires same column structure, so we produce a simple
    # per-user aggregate using three separate LEFT JOINs on the User table.

    # Base user query with LEFT JOINs to the three aggregated subqueries
    base_q = (
        select(
            User.id,
            User.email,
            User.username,
            User.name,
            User.role,
            User.teacher_id,
            User.school_name,
            User.grade,
            User.phone_number,
            User.created_at,
            User.updated_at,
            # last_active: greatest across all session types
            func.greatest(
                ls_last.c.last_active,
                gs_agg.c.last_active,
                ts_agg.c.last_active,
            ).label("last_active"),
            # total_sessions: sum across all types
            (
                func.coalesce(ls_last.c.total_sessions, 0)
                + func.coalesce(gs_agg.c.total_sessions, 0)
                + func.coalesce(ts_agg.c.total_sessions, 0)
            ).label("total_sessions"),
            # accuracy_pct: weighted average (treat each source equally)
            func.case(
                (
                    (
                        func.coalesce(ls_last.c.total_sessions, 0)
                        + func.coalesce(gs_agg.c.total_sessions, 0)
                        + func.coalesce(ts_agg.c.total_sessions, 0)
                    )
                    > 0,
                    (
                        func.coalesce(ls_acc.c.accuracy_avg, 0)
                        * func.coalesce(ls_last.c.total_sessions, 0)
                        + func.coalesce(gs_agg.c.accuracy_avg, 0)
                        * func.coalesce(gs_agg.c.total_sessions, 0)
                        + func.coalesce(ts_agg.c.accuracy_avg, 0)
                        * func.coalesce(ts_agg.c.total_sessions, 0)
                    )
                    / func.nullif(
                        (
                            func.coalesce(ls_last.c.total_sessions, 0)
                            + func.coalesce(gs_agg.c.total_sessions, 0)
                            + func.coalesce(ts_agg.c.total_sessions, 0)
                        ),
                        0,
                    ),
                ),
                else_=None,
            ).label("accuracy_pct"),
        )
        .outerjoin(ls_last, User.id == ls_last.c.user_id)
        .outerjoin(ls_acc, User.id == ls_acc.c.user_id)
        .outerjoin(gs_agg, User.id == gs_agg.c.user_id)
        .outerjoin(ts_agg, User.id == ts_agg.c.user_id)
        # Exclude dummy data
        .where(~User.name.like("[DUMMY]%"))
    )

    # Apply optional filters
    if role_filter:
        base_q = base_q.where(User.role == role_filter)

    if search:
        pattern = f"%{search}%"
        base_q = base_q.where(
            User.name.ilike(pattern)
            | User.username.ilike(pattern)
            | User.email.ilike(pattern)
        )

    # Count query
    count_q = select(func.count()).select_from(base_q.subquery())
    total_result = await db.execute(count_q)
    total = total_result.scalar() or 0

    # Sorting
    _sort_col_map = {
        "name": User.name,
        "role": User.role,
        "created_at": User.created_at,
    }

    if sort_by in _sort_col_map:
        col = _sort_col_map[sort_by]
        base_q = base_q.order_by(col.desc() if sort_dir == "desc" else col.asc())
    elif sort_by == "last_active":
        # Sort by the computed column using text label reference
        direction = "DESC NULLS LAST" if sort_dir == "desc" else "ASC NULLS LAST"
        base_q = base_q.order_by(text(f"last_active {direction}"))
    elif sort_by == "total_sessions":
        direction = "DESC" if sort_dir == "desc" else "ASC"
        base_q = base_q.order_by(text(f"total_sessions {direction}"))
    else:
        base_q = base_q.order_by(User.created_at.desc())

    # Pagination
    offset = (page - 1) * page_size
    base_q = base_q.offset(offset).limit(page_size)

    rows = (await db.execute(base_q)).mappings().all()

    # Fetch teacher names for students with teacher_id
    teacher_ids = {
        r["teacher_id"] for r in rows if r["teacher_id"] is not None
    }
    teacher_name_map: dict[str, str] = {}
    if teacher_ids:
        t_result = await db.execute(
            select(User.id, User.name).where(User.id.in_(teacher_ids))
        )
        for t_id, t_name in t_result.all():
            teacher_name_map[t_id] = t_name

    result: list[dict] = []
    for r in rows:
        row_dict = dict(r)
        row_dict["teacher_name"] = (
            teacher_name_map.get(row_dict["teacher_id"])
            if row_dict.get("teacher_id")
            else None
        )
        result.append(row_dict)

    return result, total


async def get_user_detail(db: AsyncSession, user_id: str) -> dict | None:
    """Return user info + all sessions from all 3 session types."""
    user = await db.get(User, user_id)
    if user is None:
        return None

    # Fetch teacher name if applicable
    teacher_name: str | None = None
    if user.teacher_id:
        teacher = await db.get(User, user.teacher_id)
        if teacher:
            teacher_name = teacher.name

    sessions: list[dict] = []

    # --- LearningSession ---
    ls_rows = (
        await db.execute(
            select(LearningSession).where(LearningSession.student_id == user_id)
        )
    ).scalars().all()

    for ls in ls_rows:
        # Count answers from LearningAnswer
        ans_result = await db.execute(
            select(
                func.count(LearningAnswer.id).label("total"),
                func.sum(
                    func.cast(LearningAnswer.is_correct, type_=func.count().type)
                ).label("correct"),
            ).where(LearningAnswer.session_id == ls.id)
        )
        ans_row = ans_result.one()
        total_q = ans_row.total or 0
        correct_q = int(ans_row.correct or 0)
        accuracy = round(correct_q * 100.0 / total_q, 1) if total_q > 0 else None
        duration: int | None = None
        if ls.completed_at and ls.started_at:
            duration = int((ls.completed_at - ls.started_at).total_seconds())
        sessions.append(
            {
                "session_id": ls.id,
                "session_type": "mastery",
                "started_at": ls.started_at,
                "completed_at": ls.completed_at,
                "total_questions": total_q,
                "correct_count": correct_q,
                "accuracy_pct": accuracy,
                "duration_seconds": duration,
            }
        )

    # --- GrammarSession ---
    gs_rows = (
        await db.execute(
            select(GrammarSession).where(GrammarSession.student_id == user_id)
        )
    ).scalars().all()

    for gs in gs_rows:
        total_q = gs.total_questions or 0
        correct_q = gs.correct_count or 0
        accuracy = round(correct_q * 100.0 / total_q, 1) if total_q > 0 else None
        duration = None
        if gs.completed_at and gs.started_at:
            duration = int((gs.completed_at - gs.started_at).total_seconds())
        sessions.append(
            {
                "session_id": gs.id,
                "session_type": "grammar",
                "started_at": gs.started_at,
                "completed_at": gs.completed_at,
                "total_questions": total_q,
                "correct_count": correct_q,
                "accuracy_pct": accuracy,
                "duration_seconds": duration,
            }
        )

    # --- TestSession ---
    ts_rows = (
        await db.execute(
            select(TestSession).where(TestSession.student_id == user_id)
        )
    ).scalars().all()

    for ts in ts_rows:
        total_q = ts.total_questions or 0
        correct_q = ts.correct_count or 0
        accuracy = round(correct_q * 100.0 / total_q, 1) if total_q > 0 else None
        duration = None
        if ts.completed_at and ts.started_at:
            duration = int((ts.completed_at - ts.started_at).total_seconds())
        sessions.append(
            {
                "session_id": ts.id,
                "session_type": "word_test",
                "started_at": ts.started_at,
                "completed_at": ts.completed_at,
                "total_questions": total_q,
                "correct_count": correct_q,
                "accuracy_pct": accuracy,
                "duration_seconds": duration,
            }
        )

    # Sort all sessions by started_at desc
    sessions.sort(key=lambda s: s["started_at"], reverse=True)

    # Compute aggregate stats for the user overview
    total_sessions = len(sessions)
    last_active = sessions[0]["started_at"] if sessions else None
    accuracy_pct: float | None = None
    if sessions:
        scored = [s["accuracy_pct"] for s in sessions if s["accuracy_pct"] is not None]
        if scored:
            accuracy_pct = round(sum(scored) / len(scored), 1)

    user_dict: dict[str, Any] = {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "name": user.name,
        "role": user.role,
        "teacher_id": user.teacher_id,
        "school_name": user.school_name,
        "grade": user.grade,
        "phone_number": user.phone_number,
        "created_at": user.created_at,
        "updated_at": user.updated_at,
        "teacher_name": teacher_name,
        "last_active": last_active,
        "total_sessions": total_sessions,
        "accuracy_pct": accuracy_pct,
    }

    return {"user": user_dict, "sessions": sessions}


async def create_any_user(
    db: AsyncSession,
    username: str,
    password: str,
    name: str,
    role: str,
    email: str | None = None,
    phone_number: str | None = None,
    school_name: str | None = None,
    grade: str | None = None,
    teacher_id: str | None = None,
) -> User:
    """Create a user of any role."""
    user = User(
        username=username,
        email=email,
        password_hash=await get_password_hash_async(password),
        name=name,
        role=role,
        phone_number=phone_number,
        school_name=school_name,
        grade=grade,
        teacher_id=teacher_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_any_user(
    db: AsyncSession,
    user: User,
    name: str | None = None,
    email: str | None = None,
    password: str | None = None,
    phone_number: str | None = None,
    school_name: str | None = None,
    grade: str | None = None,
    role: str | None = None,
    teacher_id: str | None = None,
) -> User:
    """Update any provided fields on a user."""
    if name is not None:
        user.name = name
    if email is not None:
        user.email = email
    if password is not None:
        user.password_hash = await get_password_hash_async(password)
    if phone_number is not None:
        user.phone_number = phone_number
    if school_name is not None:
        user.school_name = school_name
    if grade is not None:
        user.grade = grade
    if role is not None:
        user.role = role
    if teacher_id is not None:
        user.teacher_id = teacher_id
    await db.commit()
    await db.refresh(user)
    return user


def generate_temp_password(length: int = 8) -> str:
    """Generate a random temporary password."""
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))
