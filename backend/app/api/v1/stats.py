"""Statistics and analytics endpoints."""
from typing import Annotated
from datetime import timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, and_, Integer
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.session import get_db
from app.services.level_engine import format_rank_label
from app.schemas.stats import (
    DashboardStats,
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
from app.models.test_answer import TestAnswer
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.word_mastery import WordMastery
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

    # Total tests for teacher's students (TestSession + LearningSession)
    tests_query = (
        select(func.count())
        .select_from(TestSession)
        .where(TestSession.student_id.in_(student_ids_subq))
    )
    total_tests_result = await db.execute(tests_query)
    total_tests = total_tests_result.scalar() or 0

    mastery_tests_query = (
        select(func.count())
        .select_from(LearningSession)
        .where(
            and_(
                LearningSession.student_id.in_(student_ids_subq),
                LearningSession.completed_at.isnot(None),
            )
        )
    )
    mastery_tests_result = await db.execute(mastery_tests_query)
    total_tests += mastery_tests_result.scalar() or 0

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
    avg_time_query = (
        select(
            func.avg(
                (func.extract('epoch', TestSession.completed_at) -
                 func.extract('epoch', TestSession.started_at))
                / func.nullif(TestSession.total_questions, 0)
            )
        )
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
                TestSession.started_at.isnot(None),
                TestSession.total_questions > 0,
            )
        )
    )
    avg_time_result = await db.execute(avg_time_query)
    avg_time_per_question = avg_time_result.scalar() or 0.0

    # Level distribution (from determined_level in completed tests + mastery current_level)
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
    level_counts: dict[int, int] = {}
    for row in level_dist_result.fetchall():
        level_counts[row[0]] = row[1]

    # Add mastery session levels
    mastery_level_query = (
        select(
            LearningSession.current_level,
            func.count(LearningSession.id).label("count"),
        )
        .where(
            and_(
                LearningSession.student_id.in_(student_ids_subq),
                LearningSession.completed_at.isnot(None),
                LearningSession.current_level.isnot(None),
            )
        )
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
        avg_time_seconds=round(float(avg_time_per_question), 1),
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
    speed_score, avg_answer_time = report_engine.calculate_speed_score(answers)
    vocab_raw, vocab_score = await report_engine.calculate_vocab_size(
        db, student_id, determined_rank=rank, test_answers=answers
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

    # Same-grade averages
    teacher_id = student.teacher_id or current_user.id
    avg_metrics = await report_engine.calculate_member_averages(db, teacher_id, grade=student.grade)

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
        "speed": f"평균 {avg_answer_time}초" if avg_answer_time else "-",
        "vocabulary_size": f"{vocab_raw:,}개",
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

    # Radar metrics
    rank = session.current_level or 1
    accuracy_score = report_engine.calculate_accuracy_score(correct_q, total_q)

    # Speed score from correct answer times
    correct_times = [
        row[0].time_taken_sec for row in answer_rows
        if row[0].is_correct and row[0].time_taken_sec
    ]
    if correct_times:
        avg_time = round(sum(correct_times) / len(correct_times), 1)
        speed_score = round(max(0.0, min(10.0, 10.0 - (avg_time / 3.0))), 1)
    else:
        avg_time = None
        speed_score = 5.0

    vocab_raw, vocab_score = await report_engine.calculate_vocab_size(
        db, student_id, determined_rank=rank
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

    # Same-grade averages
    teacher_id = student.teacher_id or current_user.id
    avg_metrics = await report_engine.calculate_member_averages(db, teacher_id, grade=student.grade)

    # Total word count for frontend bar proportions
    total_word_count = await report_engine.get_total_word_count(db)

    # Metric details
    metrics_dict = {
        "vocabulary_level": float(rank),
        "accuracy": accuracy_score,
        "speed": speed_score,
        "vocabulary_size": vocab_score,
    }
    details_raw = report_engine.get_metric_descriptions(rank, metrics_dict)
    raw_values = {
        "vocabulary_level": f"Lv.{rank}",
        "accuracy": f"{score}%",
        "speed": f"평균 {avg_time}초" if avg_time else "-",
        "vocabulary_size": f"{vocab_raw:,}개",
    }
    metric_details = []
    for d in details_raw:
        d["avg_score"] = avg_metrics.get(d["key"], 5.0)
        d["raw_value"] = raw_values.get(d["key"])
        metric_details.append(MetricDetail(**d))

    # Mappings
    grade_level = report_engine.RANK_TO_GRADE.get(rank, "미정")
    vocab_desc = report_engine.RANK_TO_VOCAB_DESC.get(rank, "")
    recommended_book = report_engine.RANK_TO_BOOK.get(rank, "")

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
        radar_metrics=radar,
        metric_details=metric_details,
        peer_ranking=peer_ranking,
        grade_level=grade_level,
        vocab_description=vocab_desc,
        recommended_book=recommended_book,
        total_time_seconds=total_time or None,
        total_word_count=total_word_count,
        word_summaries=word_summaries,
    )
