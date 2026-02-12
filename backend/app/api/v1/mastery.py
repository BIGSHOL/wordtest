"""Mastery learning API endpoints."""
import logging
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, Integer

logger = logging.getLogger(__name__)

from app.db.session import get_db
from app.core.deps import CurrentUser
from app.core.security import create_access_token
from app.schemas.mastery import (
    StartMasteryByCodeRequest,
    StartMasteryResponse,
    MasteryBatchRequest,
    MasteryBatchResponse,
    SubmitMasteryAnswerRequest,
    MasteryAnswerResult,
    MasteryProgressResponse,
    MasterySessionInfo,
    StageSummary,
)
from app.services.mastery import (
    start_session_by_code,
    get_level_questions,
    submit_answer,
    complete_batch,
    get_mastery_progress,
    _compute_stage_summary,
    _get_words_for_config,
    SEGMENT_SIZE,
)
from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig
from app.models.user import User
from app.schemas.stats import (
    MasteryReportResponse, MasterySessionData, MasteryAnswerDetail,
    MasteryWordSummary, RadarMetrics, MetricDetail, PeerRanking,
)
from app.services import report_engine

router = APIRouter(prefix="/mastery", tags=["mastery"])


def _session_info(session: LearningSession) -> MasterySessionInfo:
    return MasterySessionInfo(
        id=session.id,
        assignment_id=session.assignment_id,
        current_stage=session.current_stage,
        words_practiced=session.words_practiced,
        words_advanced=session.words_advanced,
        best_combo=session.best_combo,
        started_at=session.started_at.isoformat(),
    )


@router.post("/start-by-code", response_model=StartMasteryResponse, status_code=status.HTTP_201_CREATED)
async def start_mastery_by_code(
    body: StartMasteryByCodeRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Start a mastery session. Returns multi-level question pool.

    If the test code is for a stage test (periodic), returns
    assignment_type="stage_test" without creating a mastery session.
    """
    code = body.test_code.strip().upper()
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Test code is required",
        )

    # Early detection: route stage tests (periodic) without creating a session
    from app.services.mastery import _get_assignment_and_config as _lookup
    lookup = await _lookup(db, code)
    if lookup:
        _assignment, _config = lookup
        if _config.test_type == "periodic":
            _student = (await db.execute(
                select(User).where(User.id == _assignment.student_id)
            )).scalar_one_or_none()
            _token = create_access_token(subject=_assignment.student_id)
            return StartMasteryResponse(
                session=MasterySessionInfo(
                    id="", assignment_id=_assignment.id,
                    current_stage=1, words_practiced=0, words_advanced=0,
                    best_combo=0, started_at="",
                ),
                stage_summary=StageSummary(),
                questions=[],
                total_words=0,
                question_count=0,
                access_token=_token,
                student_name=_student.name if _student else "학생",
                assignment_type="stage_test",
                current_level=1,
            )

    try:
        session, questions, masteries, all_words, assignment, student_name, current_level, question_count = \
            await start_session_by_code(db, code, allow_restart=body.allow_restart)
    except ValueError as e:
        msg = str(e)
        if msg.startswith("ALREADY_COMPLETED|"):
            parts = msg.split("|")
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "code": "ALREADY_COMPLETED",
                    "session_id": parts[1],
                    "assignment_id": parts[2],
                },
            )
        if "inactive" in msg.lower() or "invalid" in msg.lower():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=msg)
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=msg)

    access_token = create_access_token(subject=assignment.student_id)
    summary = await _compute_stage_summary(masteries)

    return StartMasteryResponse(
        session=_session_info(session),
        stage_summary=summary,
        questions=questions,
        total_words=len(all_words),
        question_count=question_count,
        access_token=access_token,
        student_name=student_name,
        assignment_type="mastery",
        current_level=current_level,
    )


@router.post("/batch", response_model=MasteryBatchResponse)
async def get_batch(
    body: MasteryBatchRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Fetch more questions at a specific level (lazy loading when pool runs out)."""
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == body.session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    # Load assignment + config
    assignment_result = await db.execute(
        select(TestAssignment).where(TestAssignment.id == session.assignment_id)
    )
    assignment = assignment_result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Assignment not found")

    config_result = await db.execute(
        select(TestConfig).where(TestConfig.id == assignment.test_config_id)
    )
    config = config_result.scalar_one_or_none()
    if not config:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Config not found")

    all_words = await _get_words_for_config(db, config)
    words_map = {w.id: w for w in all_words}
    word_ids = [w.id for w in all_words]

    mastery_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == current_user.id,
            WordMastery.word_id.in_(word_ids),
        )
    )
    masteries = list(mastery_result.scalars().all())

    # Use explicit level if provided, else session.current_level
    target_level = body.level if body.level else session.current_level

    questions = await get_level_questions(
        db, session, masteries, words_map, all_words,
        target_level=target_level,
        batch_size=body.batch_size,
        timer_override=config.per_question_time_seconds,
    )

    summary = await _compute_stage_summary(masteries)
    await db.commit()

    return MasteryBatchResponse(
        questions=questions,
        remaining_in_stage=0,
        stage_summary=summary,
        current_level=session.current_level,
        previous_level=session.current_level,
        level_changed=False,
    )


class CompleteBatchRequest(BaseModel):
    session_id: str
    final_level: int = 1
    best_combo: int = 0


@router.post("/complete-batch")
async def complete_batch_endpoint(
    body: CompleteBatchRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Save frontend-determined final level after all 50 questions.

    No auth required: session_id (UUID) acts as auth token.
    This prevents JWT expiry from blocking test completion.
    """
    try:
        result = await complete_batch(db, body.session_id, body.final_level, body.best_combo)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        logger.exception("complete_batch failed: session=%s level=%s", body.session_id, body.final_level)
        raise HTTPException(status_code=500, detail=str(e))

    return result


@router.post("/{session_id}/answer", response_model=MasteryAnswerResult)
async def submit_mastery_answer(
    session_id: str,
    body: SubmitMasteryAnswerRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Submit an answer and process word mastery stage transition."""
    try:
        result = await submit_answer(
            db,
            session_id=session_id,
            word_mastery_id=body.word_mastery_id,
            selected_answer=body.selected_answer,
            stage=body.stage,
            time_taken_seconds=body.time_taken_seconds,
            question_type=body.question_type,
            context_mode=body.context_mode,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    return MasteryAnswerResult(**result)


@router.get("/progress/{assignment_id}", response_model=MasteryProgressResponse)
async def mastery_progress(
    assignment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get mastery progress for an assignment."""
    try:
        result = await get_mastery_progress(db, assignment_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    return MasteryProgressResponse(**result)


@router.get("/session/{session_id}/summary")
async def mastery_session_summary(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get mastery session summary. No auth - session_id (UUID) acts as token."""
    result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    # Answer stats
    answers_result = await db.execute(
        select(
            func.count(LearningAnswer.id),
            func.sum(func.cast(LearningAnswer.is_correct, Integer)),
        ).where(LearningAnswer.session_id == session_id)
    )
    row = answers_result.one()
    total = row[0] or 0
    correct = int(row[1] or 0)

    # Student name
    student_result = await db.execute(
        select(User.name).where(User.id == session.student_id)
    )
    student_name = student_result.scalar() or "학생"

    return {
        "session_id": str(session.id),
        "student_name": student_name,
        "current_level": session.current_level,
        "total_questions": total,
        "correct_count": correct,
        "accuracy": round(correct / total * 100) if total > 0 else 0,
        "completed_at": session.completed_at.isoformat() if session.completed_at else None,
        "best_combo": session.best_combo,
    }


@router.get("/session/{session_id}/report", response_model=MasteryReportResponse)
async def mastery_session_report(
    session_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Get full mastery report. No auth - session_id (UUID) acts as token.

    This is the student-facing version of the teacher mastery report.
    """
    # Load session
    session_result = await db.execute(
        select(LearningSession).where(LearningSession.id == session_id)
    )
    session = session_result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    student_id = session.student_id

    # Load student
    student_result = await db.execute(select(User).where(User.id == student_id))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    # Load answers with word info
    answers_result = await db.execute(
        select(LearningAnswer, Word)
        .join(Word, LearningAnswer.word_id == Word.id)
        .where(LearningAnswer.session_id == session_id)
        .order_by(LearningAnswer.answered_at)
    )
    answer_rows = answers_result.fetchall()

    total_q = len(answer_rows)
    correct_q = sum(1 for row in answer_rows if row[0].is_correct)
    accuracy_pct = round((correct_q / total_q * 100) if total_q > 0 else 0, 1)
    total_time = round(sum(row[0].time_taken_sec or 0 for row in answer_rows))
    score = round(accuracy_pct)

    # Build answers list
    answers_list = []
    for idx, (ans, word) in enumerate(answer_rows):
        answers_list.append(MasteryAnswerDetail(
            question_order=idx + 1,
            word_english=word.english,
            word_korean=word.korean,
            correct_answer=ans.correct_answer or word.korean,
            selected_answer=ans.selected_answer,
            is_correct=ans.is_correct,
            word_level=word.level,
            time_taken_seconds=ans.time_taken_sec,
            stage=ans.stage or 1,
        ))

    # Word summaries
    word_data: dict[str, dict] = {}
    for ans, word in answer_rows:
        wd = word_data.setdefault(word.id, {"word": word, "attempts": []})
        wd["attempts"].append(ans)

    mastery_result = await db.execute(
        select(WordMastery).where(
            WordMastery.student_id == student_id,
            WordMastery.word_id.in_(list(word_data.keys())),
        )
    )
    mastery_map = {wm.word_id: wm for wm in mastery_result.scalars().all()}

    word_summaries = []
    for word_id, wd in word_data.items():
        word = wd["word"]
        attempts = wd["attempts"]
        wm = mastery_map.get(word_id)
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
    word_summaries.sort(key=lambda w: (-int(w.mastered), -w.accuracy))

    # Radar metrics
    rank = session.current_level or 1
    accuracy_score = report_engine.calculate_accuracy_score(correct_q, total_q)
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
    peer = await report_engine.calculate_peer_ranking(db, student_id, score, student.grade)
    peer_ranking = PeerRanking(**peer) if peer else None

    # Same-grade averages
    teacher_id = student.teacher_id
    if teacher_id:
        avg_metrics = await report_engine.calculate_member_averages(db, teacher_id, grade=student.grade)
    else:
        avg_metrics = {"vocabulary_level": 5.0, "accuracy": 5.0, "speed": 5.0, "vocabulary_size": 5.0}

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

    grade_level = report_engine.RANK_TO_GRADE.get(rank, "미정")
    vocab_desc = report_engine.get_vocab_description(rank, score)
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
        student_name=student.name,
        student_grade=student.grade,
        student_school=student.school_name,
    )
