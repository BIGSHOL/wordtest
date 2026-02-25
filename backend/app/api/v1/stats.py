"""Statistics and analytics endpoints."""
from typing import Annotated, Optional
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.test_common import format_rank_label
from app.schemas.stats import (
    AllResultsResponse,
    DashboardStats,
    EngineDiagnosis,
    EngineStats,
    EnhancedTestReport,
    LevelDistribution,
    MasteryAnswerDetail,
    MasteryReportResponse,
    MasterySessionData,
    MasteryWordSummary,
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
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.word_mastery import WordMastery
from app.core.timezone import now_kst
from app.services.test_common import get_test_result
from app.services import report_engine

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("/all-results", response_model=AllResultsResponse)
async def get_all_results(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
    search: Optional[str] = Query(None),
    test_type: Optional[str] = Query(None, description="test | mastery"),
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
):
    """Get all test results with pagination (teacher only)."""
    student_ids_subq = (
        select(User.id)
        .where(and_(User.role == "student", User.teacher_id == teacher.id))
        .scalar_subquery()
    )

    results: list[RecentTest] = []

    # --- TestSession results ---
    if test_type != "mastery":
        ts_query = (
            select(TestSession, User.name, User.id, User.school_name, User.grade)
            .join(User, TestSession.student_id == User.id)
            .where(
                and_(
                    TestSession.student_id.in_(student_ids_subq),
                    TestSession.completed_at.isnot(None),
                )
            )
        )
        if search:
            ts_query = ts_query.where(User.name.ilike(f"%{search}%"))
        ts_result = await db.execute(ts_query.order_by(TestSession.completed_at.desc()))
        for row in ts_result.fetchall():
            session = row[0]
            duration = None
            if session.completed_at and session.started_at:
                duration = int((session.completed_at - session.started_at).total_seconds())
            rank_label = None
            if session.determined_level and session.determined_sublevel:
                rank_label = format_rank_label(session.determined_level, session.determined_sublevel)
            results.append(
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
                    test_type="test",
                )
            )

    # --- LearningSession (mastery) results ---
    if test_type != "test":
        ms_query = (
            select(LearningSession, User.name, User.id, User.school_name, User.grade)
            .join(User, LearningSession.student_id == User.id)
            .where(
                and_(
                    LearningSession.student_id.in_(student_ids_subq),
                    LearningSession.completed_at.isnot(None),
                )
            )
        )
        if search:
            ms_query = ms_query.where(User.name.ilike(f"%{search}%"))
        ms_result = await db.execute(ms_query.order_by(LearningSession.completed_at.desc()))
        for row in ms_result.fetchall():
            ms = row[0]
            ans_result = await db.execute(
                select(
                    func.count(LearningAnswer.id),
                    func.sum(func.cast(LearningAnswer.is_correct, Integer)),
                    func.sum(LearningAnswer.time_taken_sec),
                ).where(LearningAnswer.session_id == ms.id)
            )
            ans_row = ans_result.fetchone()
            total_q = ans_row[0] or 0
            correct_q = int(ans_row[1] or 0)
            duration = int(ans_row[2] or 0) or None
            if not duration and ms.completed_at and ms.started_at:
                duration = int((ms.completed_at - ms.started_at).total_seconds())
            score = round((correct_q / total_q * 100) if total_q > 0 else 0)
            rank_label = format_rank_label(ms.current_level, 1) if ms.current_level else None
            results.append(
                RecentTest(
                    id=ms.id,
                    student_id=row[2],
                    student_name=row[1],
                    student_school=row[3],
                    student_grade=row[4],
                    score=score,
                    determined_level=ms.current_level,
                    rank_name=None,
                    rank_label=rank_label,
                    total_questions=total_q,
                    correct_count=correct_q,
                    duration_seconds=duration,
                    completed_at=str(ms.completed_at) if ms.completed_at else None,
                    test_type="mastery",
                )
            )

    # Sort by completed_at descending
    results.sort(key=lambda t: t.completed_at or "", reverse=True)
    total = len(results)
    paginated = results[skip : skip + limit]

    return AllResultsResponse(results=paginated, total=total)


@router.get("/dashboard", response_model=DashboardStats)
async def get_dashboard_stats(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = Query("all"),
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

    # Compute period filter
    if period == "weekly":
        period_start = now_kst() - timedelta(days=7)
    elif period == "monthly":
        period_start = now_kst() - timedelta(days=30)
    else:
        period_start = None

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

    # Total tests for teacher's students (TestSession + LearningSession)
    tests_conditions = [TestSession.student_id.in_(student_ids_subq)]
    if period_start:
        tests_conditions.append(TestSession.completed_at >= period_start)
    tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(and_(*tests_conditions))
    )
    total_tests_result = await db.execute(tests_query)
    total_tests = total_tests_result.scalar() or 0

    mastery_conditions = [
        LearningSession.student_id.in_(student_ids_subq),
        LearningSession.completed_at.isnot(None),
    ]
    if period_start:
        mastery_conditions.append(LearningSession.completed_at >= period_start)
    mastery_tests_query = (
        select(func.count())
        .select_from(LearningSession)
        .where(and_(*mastery_conditions))
    )
    mastery_tests_result = await db.execute(mastery_tests_query)
    total_tests += mastery_tests_result.scalar() or 0

    # Average score (only completed tests with score)
    avg_score_conditions = [
        TestSession.student_id.in_(student_ids_subq),
        TestSession.completed_at.isnot(None),
        TestSession.score.isnot(None),
    ]
    if period_start:
        avg_score_conditions.append(TestSession.completed_at >= period_start)
    avg_score_query = (
        select(func.avg(TestSession.score))
        .where(and_(*avg_score_conditions))
    )
    avg_score_result = await db.execute(avg_score_query)
    avg_score = avg_score_result.scalar() or 0.0

    # Average answer time (seconds per question, from completed tests)
    completed_sessions_subq = (
        select(TestSession.id)
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
            )
        )
        .scalar_subquery()
    )
    avg_time_conditions = [
        TestSession.student_id.in_(student_ids_subq),
        TestSession.completed_at.isnot(None),
        TestSession.started_at.isnot(None),
        TestSession.total_questions > 0,
    ]
    if period_start:
        avg_time_conditions.append(TestSession.completed_at >= period_start)
    avg_time_query = (
        select(
            func.avg(
                (func.extract('epoch', TestSession.completed_at) -
                 func.extract('epoch', TestSession.started_at))
                / func.nullif(TestSession.total_questions, 0)
            )
        )
        .where(and_(*avg_time_conditions))
    )
    avg_time_result = await db.execute(avg_time_query)
    avg_time_per_question = avg_time_result.scalar() or 0.0

    # Level distribution (from determined_level in completed tests + mastery current_level)
    level_conditions = [
        TestSession.student_id.in_(student_ids_subq),
        TestSession.determined_level.isnot(None),
    ]
    if period_start:
        level_conditions.append(TestSession.completed_at >= period_start)
    level_dist_query = (
        select(
            TestSession.determined_level,
            func.count(TestSession.id).label("count"),
        )
        .where(and_(*level_conditions))
        .group_by(TestSession.determined_level)
        .order_by(TestSession.determined_level)
    )
    level_dist_result = await db.execute(level_dist_query)
    level_counts: dict[int, int] = {}
    for row in level_dist_result.fetchall():
        level_counts[row[0]] = row[1]

    # Add mastery session levels
    mastery_level_conditions = [
        LearningSession.student_id.in_(student_ids_subq),
        LearningSession.completed_at.isnot(None),
        LearningSession.current_level.isnot(None),
    ]
    if period_start:
        mastery_level_conditions.append(LearningSession.completed_at >= period_start)
    mastery_level_query = (
        select(
            LearningSession.current_level,
            func.count(LearningSession.id).label("count"),
        )
        .where(and_(*mastery_level_conditions))
        .group_by(LearningSession.current_level)
    )
    mastery_level_result = await db.execute(mastery_level_query)
    for row in mastery_level_result.fetchall():
        level_counts[row[0]] = level_counts.get(row[0], 0) + row[1]

    level_distribution = [
        LevelDistribution(level=lvl, count=cnt)
        for lvl, cnt in sorted(level_counts.items())
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

    # Recent mastery sessions (completed)
    recent_mastery_query = (
        select(LearningSession, User.name, User.id, User.school_name, User.grade)
        .join(User, LearningSession.student_id == User.id)
        .where(
            and_(
                LearningSession.student_id.in_(student_ids_subq),
                LearningSession.completed_at.isnot(None),
            )
        )
        .order_by(LearningSession.completed_at.desc())
        .limit(10)
    )
    recent_mastery_result = await db.execute(recent_mastery_query)
    for row in recent_mastery_result.fetchall():
        ms = row[0]
        # Use actual answer-level stats from LearningAnswer
        ans_result = await db.execute(
            select(
                func.count(LearningAnswer.id),
                func.sum(func.cast(LearningAnswer.is_correct, Integer)),
                func.sum(LearningAnswer.time_taken_sec),
            )
            .where(LearningAnswer.session_id == ms.id)
        )
        ans_row = ans_result.fetchone()
        total_q = ans_row[0] or 0
        correct_q = int(ans_row[1] or 0)
        duration = int(ans_row[2] or 0) or None
        if not duration and ms.completed_at and ms.started_at:
            duration = int((ms.completed_at - ms.started_at).total_seconds())
        score = round((correct_q / total_q * 100) if total_q > 0 else 0)

        rank_label = format_rank_label(ms.current_level, 1) if ms.current_level else None
        recent_tests.append(
            RecentTest(
                id=ms.id,
                student_id=row[2],
                student_name=row[1],
                student_school=row[3],
                student_grade=row[4],
                score=score,
                determined_level=ms.current_level,
                rank_name=None,
                rank_label=rank_label,
                total_questions=total_q,
                correct_count=correct_q,
                duration_seconds=duration,
                completed_at=str(ms.completed_at) if ms.completed_at else None,
                test_type="mastery",
            )
        )

    # Sort all recent tests by completed_at descending and take top 10
    recent_tests.sort(key=lambda t: t.completed_at or "", reverse=True)
    recent_tests = recent_tests[:10]

    # Weekly test count (last 7 days) - TestSession + LearningSession
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

    weekly_mastery_query = (
        select(func.count())
        .select_from(LearningSession)
        .where(
            and_(
                LearningSession.student_id.in_(student_ids_subq),
                LearningSession.completed_at.isnot(None),
                LearningSession.completed_at >= week_ago,
            )
        )
    )
    weekly_mastery_result = await db.execute(weekly_mastery_query)
    weekly_test_count += weekly_mastery_result.scalar() or 0

    # Today test count - TestSession + LearningSession
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

    today_mastery_query = (
        select(func.count())
        .select_from(LearningSession)
        .where(
            and_(
                LearningSession.student_id.in_(student_ids_subq),
                LearningSession.completed_at.isnot(None),
                LearningSession.completed_at >= today_start,
            )
        )
    )
    today_mastery_result = await db.execute(today_mastery_query)
    today_test_count += today_mastery_result.scalar() or 0

    # Score trend - adjust range based on period
    if period == "weekly":
        trend_days = 7
    elif period == "monthly":
        trend_days = 30
    else:
        trend_days = 90
    trend_start = now_kst() - timedelta(days=trend_days)
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
                TestSession.completed_at >= trend_start,
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
        avg_time_seconds=round(float(avg_time_per_question), 1),
        level_distribution=level_distribution,
        recent_tests=recent_tests,
        weekly_test_count=weekly_test_count,
        today_test_count=today_test_count,
        score_trend=score_trend,
    )


@router.get("/word-stats", response_model=WordStatsResponse)
async def get_word_stats(
    teacher: CurrentTeacher,
    db: Annotated[AsyncSession, Depends(get_db)],
    period: str = Query("all"),
):
    """Get per-word accuracy and response time stats (teacher only)."""
    student_ids_subq = (
        select(User.id)
        .where(and_(User.role == "student", User.teacher_id == teacher.id))
        .scalar_subquery()
    )

    # Compute period filter
    if period == "weekly":
        ws_period_start = now_kst() - timedelta(days=7)
    elif period == "monthly":
        ws_period_start = now_kst() - timedelta(days=30)
    else:
        ws_period_start = None

    # Aggregate from LearningAnswer only (TestAnswer is a legacy seed-data
    # duplicate and not created by app code, so excluded to avoid double-counting)
    la_conditions = [LearningSession.student_id.in_(student_ids_subq)]
    if ws_period_start:
        la_conditions.append(LearningSession.completed_at >= ws_period_start)
    la_query = (
        select(
            LearningAnswer.word_id,
            Word.english,
            Word.korean,
            func.count(LearningAnswer.id).label("attempt_count"),
            func.sum(func.cast(LearningAnswer.is_correct, Integer)).label("correct_count"),
            func.avg(LearningAnswer.time_taken_sec).label("avg_time"),
        )
        .join(Word, LearningAnswer.word_id == Word.id)
        .join(LearningSession, LearningAnswer.session_id == LearningSession.id)
        .where(and_(*la_conditions))
        .group_by(LearningAnswer.word_id, Word.english, Word.korean)
    )
    la_result = await db.execute(la_query)
    word_map: dict[str, dict] = {}
    for row in la_result.fetchall():
        attempt_cnt = row.attempt_count or 0
        word_map[row.word_id] = {
            "english": row.english,
            "korean": row.korean,
            "attempts": attempt_cnt,
            "correct": int(row.correct_count or 0),
            "avg_time": float(row.avg_time or 0),
        }

    # Build WordStat list (minimum 2 attempts to be meaningful)
    all_stats = []
    for wid, d in word_map.items():
        if d["attempts"] < 2:
            continue
        acc = round(d["correct"] / d["attempts"] * 100, 1)
        avg_t = round(d["avg_time"], 1) if d["avg_time"] > 0 else None
        all_stats.append(WordStat(
            word_id=wid,
            english=d["english"],
            korean=d["korean"],
            accuracy=acc,
            attempt_count=d["attempts"],
            avg_time_seconds=avg_t,
        ))

    lowest_accuracy = sorted(all_stats, key=lambda w: w.accuracy)[:20]
    slowest_response = sorted(
        [w for w in all_stats if w.avg_time_seconds],
        key=lambda w: -(w.avg_time_seconds or 0),
    )[:20]

    return WordStatsResponse(
        lowest_accuracy=lowest_accuracy,
        slowest_response=slowest_response,
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
                id=s.id,
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
    # Inline session response (was previously in tests.py)
    rank_label_str = None
    if session.determined_level and session.determined_sublevel:
        rank_label_str = format_rank_label(session.determined_level, session.determined_sublevel)
    session_resp = TestSessionResponse(
        id=session.id,
        student_id=session.student_id,
        test_type=session.test_type,
        total_questions=session.total_questions,
        correct_count=session.correct_count,
        determined_level=session.determined_level,
        determined_sublevel=session.determined_sublevel,
        rank_name=session.rank_name,
        rank_label=rank_label_str,
        score=session.score,
        test_config_id=session.test_config_id,
        started_at=str(session.started_at),
        completed_at=str(session.completed_at) if session.completed_at else None,
    )

    # Calculate all metrics via consolidated function
    rank = session.determined_level or 1
    score = session.score or 0
    teacher_id = student.teacher_id or current_user.id

    metrics = await report_engine.assemble_report_metrics(
        db=db,
        student_id=student_id,
        teacher_id=teacher_id,
        student_grade=student.grade,
        rank=rank,
        score=score,
        correct_count=session.correct_count,
        total_questions=session.total_questions,
        answers=answers,
    )

    return EnhancedTestReport(
        test_session=session_resp,
        answers=[AnswerDetail(**a) for a in answers],
        radar_metrics=RadarMetrics(**metrics["radar"]),
        metric_details=[MetricDetail(**d) for d in metrics["metric_details"]],
        peer_ranking=PeerRanking(**metrics["peer_ranking"]) if metrics["peer_ranking"] else None,
        grade_level=metrics["grade_level"],
        vocab_description=metrics["vocab_description"],
        recommended_book=metrics["recommended_book"],
        total_time_seconds=metrics["total_time_seconds"],
        category_times=metrics["category_times"],
        per_engine_stats=[EngineStats(**s) for s in metrics["per_engine_stats"]],
        diagnosis=EngineDiagnosis(**metrics["diagnosis"]),
    )


@router.get(
    "/student/{student_id}/mastery-report/{session_id}",
    response_model=MasteryReportResponse,
)
async def get_mastery_report(
    student_id: str,
    session_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get enhanced mastery session report."""
    # Authorization
    if current_user.role == "student" and current_user.id != student_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    if current_user.role == "teacher":
        student_check = await db.execute(select(User).where(User.id == student_id))
        student = student_check.scalar_one_or_none()
        if not student or student.teacher_id != current_user.id:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    else:
        student_check = await db.execute(select(User).where(User.id == student_id))
        student = student_check.scalar_one_or_none()

    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Load LearningSession
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Mastery session not found")
    if session.student_id != student_id:
        raise HTTPException(status_code=403, detail="Session does not belong to student")

    # Load all answers with word info
    answers_result = await db.execute(
        select(LearningAnswer, Word)
        .join(Word, LearningAnswer.word_id == Word.id)
        .where(LearningAnswer.session_id == session_id)
        .order_by(LearningAnswer.answered_at)
    )
    answer_rows = answers_result.fetchall()

    # Calculate stats
    total_q = len(answer_rows)
    correct_q = sum(1 for row in answer_rows if row[0].is_correct)
    accuracy_pct = round((correct_q / total_q * 100) if total_q > 0 else 0, 1)
    total_time = round(sum(row[0].time_taken_sec or 0 for row in answer_rows))
    score = round(accuracy_pct)

    # Build answer details
    answers_list = []
    for idx, (ans, word) in enumerate(answer_rows):
        answers_list.append(MasteryAnswerDetail(
            question_order=idx + 1,
            word_english=word.english,
            word_korean=word.korean,
            correct_answer=ans.correct_answer,
            selected_answer=ans.selected_answer,
            is_correct=ans.is_correct,
            word_level=word.level,
            time_taken_seconds=ans.time_taken_sec,
            stage=ans.stage,
            question_type=ans.question_type,
        ))

    # Build word summaries (group by word_id)
    word_groups: dict[str, dict] = {}
    for ans, word in answer_rows:
        if word.id not in word_groups:
            word_groups[word.id] = {"word": word, "attempts": []}
        word_groups[word.id]["attempts"].append(ans)

    # Load final WordMastery stages
    if word_groups:
        mastery_result = await db.execute(
            select(WordMastery).where(
                and_(
                    WordMastery.student_id == student_id,
                    WordMastery.word_id.in_(list(word_groups.keys())),
                )
            )
        )
        masteries = {m.word_id: m for m in mastery_result.scalars().all()}
    else:
        masteries = {}

    word_summaries = []
    for word_id, data in word_groups.items():
        word = data["word"]
        attempts = data["attempts"]
        wm = masteries.get(word_id)
        correct = sum(1 for a in attempts if a.is_correct)
        times = [a.time_taken_sec for a in attempts if a.time_taken_sec]
        word_summaries.append(MasteryWordSummary(
            word_id=word_id,
            english=word.english,
            korean=word.korean,
            final_stage=wm.stage if wm else 1,
            total_attempts=len(attempts),
            correct_count=correct,
            accuracy=round(correct / len(attempts) * 100, 1) if attempts else 0,
            avg_time_sec=round(sum(times) / len(times), 1) if times else None,
            mastered=wm.mastered_at is not None if wm else False,
        ))

    # Sort word summaries: mastered first, then by accuracy desc
    word_summaries.sort(key=lambda w: (-int(w.mastered), -w.accuracy))

    # Build answer dicts for report engine
    rank = session.current_level or 1
    teacher_id = student.teacher_id or current_user.id

    answer_dicts = [
        {
            "is_correct": ans.is_correct,
            "time_taken_seconds": ans.time_taken_sec,
            "question_type": ans.question_type,
            "stage": ans.stage,
            "word_level": word.level,
        }
        for ans, word in answer_rows
    ]

    metrics = await report_engine.assemble_report_metrics(
        db=db,
        student_id=student_id,
        teacher_id=teacher_id,
        student_grade=student.grade,
        rank=rank,
        score=score,
        correct_count=correct_q,
        total_questions=total_q,
        answers=answer_dicts,
    )

    total_word_count = await report_engine.get_total_word_count(db)

    session_data = MasterySessionData(
        id=session.id,
        student_id=student_id,
        total_questions=total_q,
        correct_count=correct_q,
        determined_level=session.current_level,
        score=score,
        started_at=str(session.started_at) if session.started_at else None,
        completed_at=str(session.completed_at) if session.completed_at else None,
        best_combo=session.best_combo or 0,
        words_practiced=session.words_practiced or 0,
        words_advanced=session.words_advanced or 0,
        words_demoted=session.words_demoted or 0,
    )

    return MasteryReportResponse(
        session=session_data,
        answers=answers_list,
        radar_metrics=RadarMetrics(**metrics["radar"]),
        metric_details=[MetricDetail(**d) for d in metrics["metric_details"]],
        peer_ranking=PeerRanking(**metrics["peer_ranking"]) if metrics["peer_ranking"] else None,
        grade_level=metrics["grade_level"],
        vocab_description=metrics["vocab_description"],
        recommended_book=metrics["recommended_book"],
        total_time_seconds=metrics["total_time_seconds"],
        total_word_count=total_word_count,
        word_summaries=word_summaries,
        per_engine_stats=[EngineStats(**s) for s in metrics["per_engine_stats"]],
        diagnosis=EngineDiagnosis(**metrics["diagnosis"]),
    )
