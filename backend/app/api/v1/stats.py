"""Statistics and analytics endpoints."""
from typing import Annotated
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.level_engine import format_rank_label
from app.schemas.stats import (
    DashboardStats,
    EnhancedTestReport,
    LevelDistribution,
    MetricDetail,
    PeerRanking,
    RadarMetrics,
    RecentTest,
    ScoreTrend,
    TestHistoryItem,
    TestHistoryResponse,
    WordStat,
    WordStatsResponse,
)
from app.schemas.test import TestSessionResponse, AnswerDetail
from app.core.deps import CurrentTeacher, CurrentUser
from app.models.user import User
from app.models.word import Word
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.core.timezone import now_kst
from app.services.test import get_test_result
from app.services import report_engine

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

    # Subquery for student IDs (avoids loading all IDs into memory)
    student_ids_subq = (
        select(User.id)
        .where(and_(User.role == "student", User.teacher_id == teacher.id))
        .scalar_subquery()
    )

    if total_students == 0:
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
            today_test_count=0,
            score_trend=[],
        )

    # Total tests for teacher's students
    tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(TestSession.student_id.in_(student_ids_subq))
    )
    total_tests_result = await db.execute(tests_query)
    total_tests = total_tests_result.scalar() or 0

    # Average score (only completed tests with score)
    avg_score_query = (
        select(func.avg(TestSession.score))
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
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
                TestSession.student_id.in_(student_ids_subq),
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
        select(TestSession, User.name, User.id, User.school_name, User.grade)
        .join(User, TestSession.student_id == User.id)
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
            )
        )
        .order_by(TestSession.completed_at.desc())
        .limit(10)
    )
    recent_tests_result = await db.execute(recent_tests_query)
    recent_tests = []
    for row in recent_tests_result.fetchall():
        session = row[0]
        duration = None
        if session.completed_at and session.started_at:
            duration = int((session.completed_at - session.started_at).total_seconds())
        rank_label = None
        if session.determined_level and session.determined_sublevel:
            rank_label = format_rank_label(session.determined_level, session.determined_sublevel)
        recent_tests.append(
            RecentTest(
                id=session.id,
                student_id=row[2],
                student_name=row[1],
                student_school=row[3],
                student_grade=row[4],
                score=session.score,
                determined_level=session.determined_level,
                rank_name=session.rank_name,
                rank_label=rank_label,
                total_questions=session.total_questions,
                correct_count=session.correct_count,
                duration_seconds=duration,
                completed_at=str(session.completed_at) if session.completed_at else None,
            )
        )

    # Weekly test count (last 7 days)
    week_ago = now_kst() - timedelta(days=7)
    weekly_tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
                TestSession.completed_at >= week_ago,
            )
        )
    )
    weekly_tests_result = await db.execute(weekly_tests_query)
    weekly_test_count = weekly_tests_result.scalar() or 0

    # Today test count
    today_start = now_kst().replace(hour=0, minute=0, second=0, microsecond=0)
    today_tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
                TestSession.completed_at >= today_start,
            )
        )
    )
    today_tests_result = await db.execute(today_tests_query)
    today_test_count = today_tests_result.scalar() or 0

    # Score trend (daily averages for last 30 days)
    thirty_days_ago = now_kst() - timedelta(days=30)
    score_trend_query = (
        select(
            func.date(TestSession.completed_at).label("date"),
            func.avg(TestSession.score).label("avg_score"),
            func.count(TestSession.id).label("count"),
        )
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
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
        today_test_count=today_test_count,
        score_trend=score_trend,
    )


@router.get("/student/{student_id}/history", response_model=TestHistoryResponse)
async def get_student_history(
    student_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get test history for a student (for charts)."""
    # Authorization: students can only view own history
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this student's history",
        )
    # Teachers can only view their own students' history
    if current_user.role == "teacher":
        student_check = await db.execute(
            select(User).where(User.id == student_id)
        )
        student = student_check.scalar_one_or_none()
        if not student or student.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this student's history",
            )

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
        rl = None
        if s.determined_level and s.determined_sublevel:
            rl = format_rank_label(s.determined_level, s.determined_sublevel)
        history.append(
            TestHistoryItem(
                test_date=test_date,
                accuracy=accuracy,
                determined_level=s.determined_level,
                rank_name=s.rank_name,
                rank_label=rl,
                correct_count=s.correct_count,
                total_questions=s.total_questions,
                duration_seconds=duration,
            )
        )

    return TestHistoryResponse(history=history)


@router.get(
    "/student/{student_id}/report/{test_id}",
    response_model=EnhancedTestReport,
)
async def get_enhanced_report(
    student_id: str,
    test_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get enhanced test report matching Pencil design (E6YZM).

    Combines basic test result with radar metrics, peer ranking,
    grade-level mappings, and interpretive descriptions.
    """
    # Authorization
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized",
        )
    if current_user.role == "teacher":
        student_check = await db.execute(
            select(User).where(User.id == student_id)
        )
        student = student_check.scalar_one_or_none()
        if not student or student.teacher_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized",
            )
    else:
        student_check = await db.execute(
            select(User).where(User.id == student_id)
        )
        student = student_check.scalar_one_or_none()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Load test result
    result = await get_test_result(db, test_id)
    if result is None:
        raise HTTPException(status_code=404, detail="Test not found")

    session, answers = result

    if session.student_id != student_id:
        raise HTTPException(status_code=403, detail="Test does not belong to student")

    # Build session response
    rank_label = None
    if session.determined_level and session.determined_sublevel:
        rank_label = format_rank_label(
            session.determined_level, session.determined_sublevel
        )
    from app.api.v1.tests import _session_response
    session_resp = _session_response(session)

    # Calculate metrics
    rank = session.determined_level or 1
    score = session.score or 0

    # Radar metrics
    accuracy_score = report_engine.calculate_accuracy_score(
        session.correct_count, session.total_questions
    )
    speed_score = report_engine.calculate_speed_score(answers)
    vocab_raw, vocab_score = await report_engine.calculate_vocab_size(
        db, student_id
    )

    radar = RadarMetrics(
        vocabulary_level=float(rank),
        accuracy=accuracy_score,
        speed=speed_score,
        vocabulary_size=vocab_score,
    )

    # Peer ranking
    peer = await report_engine.calculate_peer_ranking(
        db, student_id, score, student.grade
    )
    peer_ranking = PeerRanking(**peer) if peer else None

    # Member averages
    teacher_id = student.teacher_id or current_user.id
    avg_metrics = await report_engine.calculate_member_averages(db, teacher_id)

    # Metric details with descriptions
    metrics_dict = {
        "vocabulary_level": float(rank),
        "accuracy": accuracy_score,
        "speed": speed_score,
        "vocabulary_size": vocab_score,
    }
    details_raw = report_engine.get_metric_descriptions(rank, metrics_dict)

    # Fill avg_score and raw_value
    raw_values = {
        "vocabulary_level": f"Lv.{rank}",
        "accuracy": f"{score}%",
        "speed": f"{speed_score}/10",
        "vocabulary_size": f"{vocab_raw:,}단어",
    }
    metric_details = []
    for d in details_raw:
        d["avg_score"] = avg_metrics.get(d["key"], 5.0)
        d["raw_value"] = raw_values.get(d["key"])
        metric_details.append(MetricDetail(**d))

    # Time breakdown
    total_time, cat_times = report_engine.calculate_time_breakdown(answers)

    # Mappings
    grade_level = report_engine.RANK_TO_GRADE.get(rank, "미정")
    vocab_desc = report_engine.RANK_TO_VOCAB_DESC.get(rank, "")
    recommended_book = report_engine.RANK_TO_BOOK.get(rank, "")

    return EnhancedTestReport(
        test_session=session_resp,
        answers=[AnswerDetail(**a) for a in answers],
        radar_metrics=radar,
        metric_details=metric_details,
        peer_ranking=peer_ranking,
        grade_level=grade_level,
        vocab_description=vocab_desc,
        recommended_book=recommended_book,
        total_time_seconds=total_time,
        category_times=cat_times,
    )
