"""Statistics and analytics endpoints."""
from typing import Annotated
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.schemas.stats import (
    DashboardStats,
    LevelDistribution,
    RecentTest,
    ScoreTrend,
    TestHistoryItem,
    TestHistoryResponse,
)
from app.core.deps import CurrentTeacher, CurrentUser
from app.models.user import User
from app.models.word import Word
from app.models.test_session import TestSession

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get aggregated dashboard statistics (teacher only)."""

    # Total students
    students_query = select(func.count()).select_from(User).where(
        and_(User.role == "student", User.teacher_id == teacher.id)
    )
    total_students_result = await db.execute(students_query)
    total_students = total_students_result.scalar() or 0

    # Total words
    words_query = select(func.count()).select_from(Word)
    total_words_result = await db.execute(words_query)
    total_words = total_words_result.scalar() or 0

    # Get student IDs for teacher
    student_ids_query = select(User.id).where(
        and_(User.role == "student", User.teacher_id == teacher.id)
    )
    student_ids_result = await db.execute(student_ids_query)
    student_ids = [row[0] for row in student_ids_result.fetchall()]

    if not student_ids:
        # No students, return empty stats
        return DashboardStats(
            total_students=0,
            total_words=total_words,
            total_tests=0,
            avg_score=0.0,
            avg_time_seconds=0.0,
            level_distribution=[],
            recent_tests=[],
            weekly_test_count=0,
            score_trend=[],
        )

    # Total tests for teacher's students
    tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(TestSession.student_id.in_(student_ids))
    )
    total_tests_result = await db.execute(tests_query)
    total_tests = total_tests_result.scalar() or 0

    # Average score (only completed tests with score)
    avg_score_query = (
        select(func.avg(TestSession.score))
        .where(
            and_(
                TestSession.student_id.in_(student_ids),
                TestSession.completed_at.isnot(None),
                TestSession.score.isnot(None),
            )
        )
    )
    avg_score_result = await db.execute(avg_score_query)
    avg_score = avg_score_result.scalar() or 0.0

    # Level distribution (from determined_level in completed tests)
    level_dist_query = (
        select(
            TestSession.determined_level,
            func.count(TestSession.id).label("count"),
        )
        .where(
            and_(
                TestSession.student_id.in_(student_ids),
                TestSession.determined_level.isnot(None),
            )
        )
        .group_by(TestSession.determined_level)
        .order_by(TestSession.determined_level)
    )
    level_dist_result = await db.execute(level_dist_query)
    level_distribution = [
        LevelDistribution(level=row[0], count=row[1])
        for row in level_dist_result.fetchall()
    ]

    # Recent tests (last 10 completed)
    recent_tests_query = (
        select(TestSession, User.name)
        .join(User, TestSession.student_id == User.id)
        .where(
            and_(
                TestSession.student_id.in_(student_ids),
                TestSession.completed_at.isnot(None),
            )
        )
        .order_by(TestSession.completed_at.desc())
        .limit(10)
    )
    recent_tests_result = await db.execute(recent_tests_query)
    recent_tests = [
        RecentTest(
            id=row[0].id,
            student_name=row[1],
            score=row[0].score,
            determined_level=row[0].determined_level,
            completed_at=str(row[0].completed_at) if row[0].completed_at else None,
        )
        for row in recent_tests_result.fetchall()
    ]

    # Weekly test count (last 7 days)
    week_ago = datetime.utcnow() - timedelta(days=7)
    weekly_tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(
            and_(
                TestSession.student_id.in_(student_ids),
                TestSession.completed_at.isnot(None),
                TestSession.completed_at >= week_ago,
            )
        )
    )
    weekly_tests_result = await db.execute(weekly_tests_query)
    weekly_test_count = weekly_tests_result.scalar() or 0

    # Score trend (daily averages for last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    score_trend_query = (
        select(
            func.date(TestSession.completed_at).label("date"),
            func.avg(TestSession.score).label("avg_score"),
            func.count(TestSession.id).label("count"),
        )
        .where(
            and_(
                TestSession.student_id.in_(student_ids),
                TestSession.completed_at.isnot(None),
                TestSession.score.isnot(None),
                TestSession.completed_at >= thirty_days_ago,
            )
        )
        .group_by(func.date(TestSession.completed_at))
        .order_by(func.date(TestSession.completed_at))
    )
    score_trend_result = await db.execute(score_trend_query)
    score_trend = [
        ScoreTrend(
            date=str(row[0]),
            avg_score=float(row[1]),
            count=row[2],
        )
        for row in score_trend_result.fetchall()
    ]

    return DashboardStats(
        total_students=total_students,
        total_words=total_words,
        total_tests=total_tests,
        avg_score=float(avg_score),
        avg_time_seconds=0.0,  # No timing data in model yet
        level_distribution=level_distribution,
        recent_tests=recent_tests,
        weekly_test_count=weekly_test_count,
        score_trend=score_trend,
    )


@router.get("/student/{student_id}/history", response_model=TestHistoryResponse)
async def get_student_history(
    student_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get test history for a student (for charts)."""
    query = (
        select(TestSession)
        .where(
            and_(
                TestSession.student_id == student_id,
                TestSession.completed_at.isnot(None),
            )
        )
        .order_by(TestSession.started_at.desc())
        .limit(10)
    )
    result = await db.execute(query)
    sessions = list(result.scalars().all())
    sessions.reverse()  # oldest first for chart display

    history = []
    for s in sessions:
        accuracy = round((s.correct_count / s.total_questions) * 100) if s.total_questions > 0 else 0
        test_date = s.started_at.strftime("%m/%d") if s.started_at else ""
        duration = None
        if s.completed_at and s.started_at:
            duration = int((s.completed_at - s.started_at).total_seconds())
        history.append(
            TestHistoryItem(
                test_date=test_date,
                accuracy=accuracy,
                determined_level=s.determined_level,
                rank_name=s.rank_name,
                correct_count=s.correct_count,
                total_questions=s.total_questions,
                duration_seconds=duration,
            )
        )

    return TestHistoryResponse(history=history)
