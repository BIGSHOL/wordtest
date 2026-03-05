"""Master-only system-wide analytics endpoints."""
from typing import Annotated
from datetime import timedelta
from collections import defaultdict

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, cast, Integer, Date, extract
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.core.deps import CurrentMaster
from app.core.timezone import now_kst
from app.models.user import User
from app.models.word import Word
from app.models.learning_session import LearningSession
from app.models.learning_answer import LearningAnswer
from app.models.grammar_session import GrammarSession
from app.models.grammar_answer import GrammarAnswer
from app.models.grammar_question import GrammarQuestion
from app.models.grammar_book import GrammarBook
from app.models.grammar_chapter import GrammarChapter
from app.models.word_mastery import WordMastery
from app.schemas.master_stats import (
    BadQuestionItem,
    BadQuestionResponse,
    BadWordItem,
    CalibrationResponse,
    ConfusedPair,
    DailyGrowth,
    ErrorPatternResponse,
    GrammarCalibrationItem,
    QuestionTypeAccuracy,
    SrsOptimizationData,
    StageCount,
    StageDuration,
    SystemOverview,
    WordCalibrationItem,
)

router = APIRouter(prefix="/master-stats", tags=["master-stats"])

GRAMMAR_TYPE_LABELS: dict[str, str] = {
    "grammar_blank": "빈칸 채우기",
    "grammar_error": "오류 탐지",
    "grammar_common": "공통점 찾기",
    "grammar_usage": "용법 구별",
    "grammar_pair": "짝 맞추기",
    "grammar_transform": "문장 변환",
    "grammar_order": "단어 배열",
    "grammar_translate": "영작",
}

WORD_ENGINE_LABELS: dict[str, str] = {
    "en_to_ko": "영→한",
    "ko_to_en": "한→영",
    "listen_en": "듣기(영)",
    "listen_ko": "듣기(한)",
    "listen_type": "듣기+타이핑",
    "ko_type": "한→영 타이핑",
    "antonym_choice": "반의어(선택)",
    "antonym_type": "반의어(타이핑)",
    "emoji": "이모지",
    "sentence": "문장",
    "sentence_type": "문장 타이핑",
}


def _real_student_ids_subq():
    """Student IDs excluding [DUMMY] students."""
    return (
        select(User.id)
        .where(User.role == "student", ~User.name.like("[DUMMY]%"))
        .scalar_subquery()
    )


def _suggest_word_level(accuracy: float, current_level: int) -> int:
    if accuracy >= 95:
        return max(1, current_level - 2)
    if accuracy >= 85:
        return max(1, current_level - 1)
    if accuracy >= 60:
        return current_level
    if accuracy >= 40:
        return min(15, current_level + 1)
    return min(15, current_level + 2)


def _suggest_grammar_difficulty(accuracy: float, current_diff: int) -> int:
    if accuracy >= 85:
        return 1
    if accuracy >= 55:
        return 2
    return 3


@router.get("/overview", response_model=SystemOverview)
async def get_overview(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """System-wide overview with counts and 30-day daily growth (master only)."""
    # --- Counts ---
    real_students_subq = select(User.id).where(
        User.role == "student", ~User.name.like("[DUMMY]%")
    ).subquery()

    total_students = (
        await db.execute(select(func.count()).select_from(real_students_subq))
    ).scalar() or 0

    total_teachers = (
        await db.execute(
            select(func.count(User.id)).where(User.role == "teacher")
        )
    ).scalar() or 0

    total_learning = (
        await db.execute(
            select(func.count(LearningSession.id)).where(
                LearningSession.completed_at.isnot(None)
            )
        )
    ).scalar() or 0

    total_grammar = (
        await db.execute(
            select(func.count(GrammarSession.id)).where(
                GrammarSession.completed_at.isnot(None)
            )
        )
    ).scalar() or 0

    total_la = (
        await db.execute(select(func.count(LearningAnswer.id)))
    ).scalar() or 0

    total_ga = (
        await db.execute(select(func.count(GrammarAnswer.id)))
    ).scalar() or 0

    total_words = (
        await db.execute(select(func.count(Word.id)))
    ).scalar() or 0

    total_gq = (
        await db.execute(
            select(func.count(GrammarQuestion.id)).where(
                GrammarQuestion.is_active == True
            )
        )
    ).scalar() or 0

    # --- 30-day daily growth ---
    cutoff = now_kst() - timedelta(days=30)

    # Learning sessions per day
    ls_rows = (
        await db.execute(
            select(
                cast(LearningSession.completed_at, Date).label("day"),
                func.count().label("cnt"),
            )
            .where(
                LearningSession.completed_at.isnot(None),
                LearningSession.completed_at >= cutoff,
            )
            .group_by(cast(LearningSession.completed_at, Date))
        )
    ).fetchall()
    ls_by_date: dict[str, int] = {str(row[0]): row[1] for row in ls_rows}

    # Grammar sessions per day
    gs_rows = (
        await db.execute(
            select(
                cast(GrammarSession.completed_at, Date).label("day"),
                func.count().label("cnt"),
            )
            .where(
                GrammarSession.completed_at.isnot(None),
                GrammarSession.completed_at >= cutoff,
            )
            .group_by(cast(GrammarSession.completed_at, Date))
        )
    ).fetchall()
    gs_by_date: dict[str, int] = {str(row[0]): row[1] for row in gs_rows}

    # New students per day
    ns_rows = (
        await db.execute(
            select(
                cast(User.created_at, Date).label("day"),
                func.count().label("cnt"),
            )
            .where(
                User.role == "student",
                ~User.name.like("[DUMMY]%"),
                User.created_at >= cutoff,
            )
            .group_by(cast(User.created_at, Date))
        )
    ).fetchall()
    ns_by_date: dict[str, int] = {str(row[0]): row[1] for row in ns_rows}

    # Merge all dates
    all_dates = sorted(
        set(ls_by_date.keys()) | set(gs_by_date.keys()) | set(ns_by_date.keys())
    )
    daily_growth = [
        DailyGrowth(
            date=d,
            learning_sessions=ls_by_date.get(d, 0),
            grammar_sessions=gs_by_date.get(d, 0),
            new_students=ns_by_date.get(d, 0),
        )
        for d in all_dates
    ]

    return SystemOverview(
        total_students=total_students,
        total_teachers=total_teachers,
        total_learning_sessions=total_learning,
        total_grammar_sessions=total_grammar,
        total_learning_answers=total_la,
        total_grammar_answers=total_ga,
        total_words=total_words,
        total_grammar_questions=total_gq,
        daily_growth=daily_growth,
    )


@router.get("/calibration", response_model=CalibrationResponse)
async def get_calibration(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Word and grammar difficulty calibration data (master only)."""
    # --- Word calibration ---
    word_rows = (
        await db.execute(
            select(
                LearningAnswer.word_id,
                Word.english,
                Word.korean,
                Word.book_name,
                Word.lesson,
                Word.level,
                func.count(LearningAnswer.id).label("attempts"),
                func.sum(cast(LearningAnswer.is_correct, Integer)).label("correct"),
                func.avg(LearningAnswer.time_taken_sec).label("avg_time"),
            )
            .join(Word, LearningAnswer.word_id == Word.id)
            .group_by(
                LearningAnswer.word_id,
                Word.english,
                Word.korean,
                Word.book_name,
                Word.lesson,
                Word.level,
            )
            .having(func.count(LearningAnswer.id) >= 5)
        )
    ).fetchall()

    word_calibrations: list[WordCalibrationItem] = []
    for row in word_rows:
        attempts = row.attempts or 0
        correct = int(row.correct or 0)
        accuracy = round((correct / attempts * 100) if attempts > 0 else 0, 1)
        current_level = row.level or 1
        suggested = _suggest_word_level(accuracy, current_level)
        gap = suggested - current_level
        avg_time = round(float(row.avg_time), 1) if row.avg_time else None
        word_calibrations.append(
            WordCalibrationItem(
                word_id=row.word_id,
                english=row.english,
                korean=row.korean,
                book_name=row.book_name,
                lesson=row.lesson,
                curriculum_level=current_level,
                actual_accuracy=accuracy,
                attempt_count=attempts,
                avg_time_sec=avg_time,
                suggested_level=suggested,
                gap=gap,
            )
        )

    # Sort by abs(gap) descending, limit 50
    word_calibrations.sort(key=lambda x: abs(x.gap), reverse=True)
    word_calibrations = word_calibrations[:50]

    # --- Grammar calibration ---
    gram_rows = (
        await db.execute(
            select(
                GrammarAnswer.grammar_question_id,
                GrammarQuestion.question_type,
                GrammarQuestion.difficulty,
                GrammarBook.title.label("book_title"),
                GrammarChapter.title.label("chapter_title"),
                func.count(GrammarAnswer.id).label("attempts"),
                func.sum(cast(GrammarAnswer.is_correct, Integer)).label("correct"),
                func.avg(GrammarAnswer.time_taken_seconds).label("avg_time"),
            )
            .join(GrammarQuestion, GrammarAnswer.grammar_question_id == GrammarQuestion.id)
            .join(GrammarBook, GrammarQuestion.book_id == GrammarBook.id)
            .join(GrammarChapter, GrammarQuestion.chapter_id == GrammarChapter.id)
            .where(GrammarQuestion.is_active == True)
            .group_by(
                GrammarAnswer.grammar_question_id,
                GrammarQuestion.question_type,
                GrammarQuestion.difficulty,
                GrammarBook.title,
                GrammarChapter.title,
            )
            .having(func.count(GrammarAnswer.id) >= 3)
        )
    ).fetchall()

    grammar_calibrations: list[GrammarCalibrationItem] = []
    for row in gram_rows:
        attempts = row.attempts or 0
        correct = int(row.correct or 0)
        accuracy = round((correct / attempts * 100) if attempts > 0 else 0, 1)
        current_diff = row.difficulty or 1
        suggested = _suggest_grammar_difficulty(accuracy, current_diff)
        gap = suggested - current_diff
        avg_time = round(float(row.avg_time), 1) if row.avg_time else None
        grammar_calibrations.append(
            GrammarCalibrationItem(
                question_id=row.grammar_question_id,
                question_type=row.question_type,
                question_type_label=GRAMMAR_TYPE_LABELS.get(row.question_type, row.question_type),
                book_title=row.book_title,
                chapter_title=row.chapter_title,
                assigned_difficulty=current_diff,
                actual_accuracy=accuracy,
                attempt_count=attempts,
                avg_time_sec=avg_time,
                suggested_difficulty=suggested,
                gap=gap,
            )
        )

    grammar_calibrations.sort(key=lambda x: abs(x.gap), reverse=True)
    grammar_calibrations = grammar_calibrations[:50]

    return CalibrationResponse(
        word_calibrations=word_calibrations,
        grammar_calibrations=grammar_calibrations,
    )


@router.get("/bad-questions", response_model=BadQuestionResponse)
async def get_bad_questions(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Flag problematic grammar questions and words (master only)."""
    # --- Grammar bad questions ---
    gram_rows = (
        await db.execute(
            select(
                GrammarAnswer.grammar_question_id,
                GrammarQuestion.question_type,
                GrammarQuestion.difficulty,
                GrammarBook.title.label("book_title"),
                GrammarChapter.title.label("chapter_title"),
                func.count(GrammarAnswer.id).label("attempts"),
                func.sum(cast(GrammarAnswer.is_correct, Integer)).label("correct"),
                func.avg(GrammarAnswer.time_taken_seconds).label("avg_time"),
            )
            .join(GrammarQuestion, GrammarAnswer.grammar_question_id == GrammarQuestion.id)
            .join(GrammarBook, GrammarQuestion.book_id == GrammarBook.id)
            .join(GrammarChapter, GrammarQuestion.chapter_id == GrammarChapter.id)
            .where(GrammarQuestion.is_active == True)
            .group_by(
                GrammarAnswer.grammar_question_id,
                GrammarQuestion.question_type,
                GrammarQuestion.difficulty,
                GrammarBook.title,
                GrammarChapter.title,
            )
            .having(func.count(GrammarAnswer.id) >= 3)
        )
    ).fetchall()

    # Compute average time per question_type
    type_times: dict[str, list[float]] = defaultdict(list)
    for row in gram_rows:
        if row.avg_time is not None:
            type_times[row.question_type].append(float(row.avg_time))
    type_avg_time: dict[str, float] = {
        qt: (sum(times) / len(times)) for qt, times in type_times.items() if times
    }

    grammar_issues: list[BadQuestionItem] = []
    for row in gram_rows:
        attempts = row.attempts or 0
        correct = int(row.correct or 0)
        accuracy = round((correct / attempts * 100) if attempts > 0 else 0, 1)
        avg_time = round(float(row.avg_time), 1) if row.avg_time else None

        flag_reason = None
        if accuracy < 10:
            flag_reason = "extreme_hard"
        elif accuracy > 98:
            flag_reason = "extreme_easy"
        elif avg_time is not None and row.question_type in type_avg_time:
            if avg_time > 2 * type_avg_time[row.question_type]:
                flag_reason = "extreme_slow"

        if flag_reason:
            grammar_issues.append(
                BadQuestionItem(
                    question_id=row.grammar_question_id,
                    question_type=row.question_type,
                    question_type_label=GRAMMAR_TYPE_LABELS.get(
                        row.question_type, row.question_type
                    ),
                    book_title=row.book_title,
                    chapter_title=row.chapter_title,
                    difficulty=row.difficulty or 1,
                    accuracy=accuracy,
                    attempt_count=attempts,
                    avg_time_sec=avg_time,
                    flag_reason=flag_reason,
                )
            )

    # --- Word bad questions ---
    word_rows = (
        await db.execute(
            select(
                LearningAnswer.word_id,
                Word.english,
                Word.korean,
                Word.book_name,
                Word.level,
                func.count(LearningAnswer.id).label("attempts"),
                func.sum(cast(LearningAnswer.is_correct, Integer)).label("correct"),
            )
            .join(Word, LearningAnswer.word_id == Word.id)
            .group_by(
                LearningAnswer.word_id,
                Word.english,
                Word.korean,
                Word.book_name,
                Word.level,
            )
            .having(func.count(LearningAnswer.id) >= 10)
        )
    ).fetchall()

    word_issues: list[BadWordItem] = []
    for row in word_rows:
        attempts = row.attempts or 0
        correct = int(row.correct or 0)
        accuracy = round((correct / attempts * 100) if attempts > 0 else 0, 1)
        if accuracy < 20:
            word_issues.append(
                BadWordItem(
                    word_id=row.word_id,
                    english=row.english,
                    korean=row.korean,
                    book_name=row.book_name,
                    curriculum_level=row.level or 1,
                    accuracy=accuracy,
                    attempt_count=attempts,
                    flag_reason="extreme_hard",
                )
            )

    return BadQuestionResponse(
        grammar_issues=grammar_issues,
        word_issues=word_issues,
    )


@router.get("/error-patterns", response_model=ErrorPatternResponse)
async def get_error_patterns(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """System-wide error pattern analysis (master only)."""
    # --- Confused word pairs ---
    pair_rows = (
        await db.execute(
            select(
                LearningAnswer.correct_answer,
                LearningAnswer.selected_answer,
                func.count().label("cnt"),
            )
            .where(
                LearningAnswer.is_correct == False,
                LearningAnswer.selected_answer.isnot(None),
                LearningAnswer.selected_answer != "",
            )
            .group_by(LearningAnswer.correct_answer, LearningAnswer.selected_answer)
            .order_by(func.count().desc())
            .limit(30)
        )
    ).fetchall()

    confused_pairs = [
        ConfusedPair(
            correct_answer=row[0],
            wrong_answer=row[1],
            confusion_count=row[2],
        )
        for row in pair_rows
    ]

    # --- Word question type breakdown ---
    word_type_rows = (
        await db.execute(
            select(
                LearningAnswer.question_type,
                func.count().label("total"),
                func.sum(cast(LearningAnswer.is_correct, Integer)).label("correct"),
                func.avg(LearningAnswer.time_taken_sec).label("avg_time"),
            )
            .where(LearningAnswer.question_type.isnot(None))
            .group_by(LearningAnswer.question_type)
        )
    ).fetchall()

    word_breakdown = [
        QuestionTypeAccuracy(
            question_type=row.question_type,
            label=WORD_ENGINE_LABELS.get(row.question_type, row.question_type),
            total=row.total or 0,
            correct=int(row.correct or 0),
            accuracy_pct=round(
                (int(row.correct or 0) / row.total * 100) if row.total else 0, 1
            ),
            avg_time_sec=round(float(row.avg_time), 1) if row.avg_time else None,
        )
        for row in word_type_rows
    ]

    # --- Grammar question type breakdown ---
    gram_type_rows = (
        await db.execute(
            select(
                GrammarAnswer.question_type,
                func.count().label("total"),
                func.sum(cast(GrammarAnswer.is_correct, Integer)).label("correct"),
                func.avg(GrammarAnswer.time_taken_seconds).label("avg_time"),
            )
            .where(GrammarAnswer.question_type.isnot(None))
            .group_by(GrammarAnswer.question_type)
        )
    ).fetchall()

    grammar_breakdown = [
        QuestionTypeAccuracy(
            question_type=row.question_type,
            label=GRAMMAR_TYPE_LABELS.get(row.question_type, row.question_type),
            total=row.total or 0,
            correct=int(row.correct or 0),
            accuracy_pct=round(
                (int(row.correct or 0) / row.total * 100) if row.total else 0, 1
            ),
            avg_time_sec=round(float(row.avg_time), 1) if row.avg_time else None,
        )
        for row in gram_type_rows
    ]

    return ErrorPatternResponse(
        confused_word_pairs=confused_pairs,
        word_question_type_breakdown=word_breakdown,
        grammar_question_type_breakdown=grammar_breakdown,
    )


@router.get("/srs-data", response_model=SrsOptimizationData)
async def get_srs_data(
    master: CurrentMaster,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """SRS stage distribution and progression data for optimization (master only)."""
    # --- Stage distribution ---
    stage_rows = (
        await db.execute(
            select(WordMastery.stage, func.count().label("cnt"))
            .group_by(WordMastery.stage)
            .order_by(WordMastery.stage)
        )
    ).fetchall()

    stage_distribution = [
        StageCount(stage=row[0], count=row[1])
        for row in stage_rows
    ]

    # --- Average days per stage (time from created_at to updated_at) ---
    duration_rows = (
        await db.execute(
            select(
                WordMastery.stage,
                func.avg(
                    extract("epoch", WordMastery.updated_at - WordMastery.created_at)
                    / 86400.0
                ).label("avg_days"),
            )
            .where(WordMastery.total_attempts >= 1)
            .group_by(WordMastery.stage)
            .order_by(WordMastery.stage)
        )
    ).fetchall()

    avg_days_per_stage = [
        StageDuration(stage=row[0], avg_days=round(float(row[1] or 0), 2))
        for row in duration_rows
    ]

    # --- Total mastered count ---
    total_mastered = (
        await db.execute(
            select(func.count(WordMastery.id)).where(
                WordMastery.mastered_at.isnot(None)
            )
        )
    ).scalar() or 0

    return SrsOptimizationData(
        stage_distribution=stage_distribution,
        avg_days_per_stage=avg_days_per_stage,
        total_mastered=total_mastered,
    )
