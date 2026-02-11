"""Report engine - calculates enhanced report metrics for Placement Test Report.

Provides:
- Radar chart metrics (4 axes: 어휘수준/정답률/속도/어휘사이즈, each 0-10)
- Rank-to-grade/vocab/book mappings
- Peer ranking (percentile within same grade)
- Metric descriptions (interpretive text per axis)
- Time breakdown by category
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.user import User
from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer


# ---------------------------------------------------------------------------
# Static mapping tables
# ---------------------------------------------------------------------------

RANK_TO_GRADE: dict[int, str] = {
    1: "초등 1-2학년",
    2: "초등 3-4학년",
    3: "초등 5-6학년",
    4: "중등 1학년",
    5: "중등 2학년",
    6: "중등 3학년",
    7: "고등 1학년",
    8: "고등 2학년",
    9: "고등 3학년",
    10: "대학/성인",
}

RANK_TO_VOCAB_DESC: dict[int, str] = {
    1: "초등 필수단어 20% 이해",
    2: "초등 필수단어 40% 이해",
    3: "초등 필수단어 완성 수준",
    4: "중학 기본 어휘 30% 이해",
    5: "중학 기본 어휘 60% 이해",
    6: "중학 어휘 완성 수준",
    7: "고등 기본 어휘 이해",
    8: "고등 핵심 어휘 습득",
    9: "수능 필수 어휘 완성",
    10: "고급/학술 어휘 수준",
}

RANK_TO_BOOK: dict[int, str] = {
    1: "POWER VOCA 5000-01",
    2: "POWER VOCA 5000-02",
    3: "POWER VOCA 5000-03",
    4: "POWER VOCA 5000-04",
    5: "POWER VOCA 5000-05",
    6: "POWER VOCA 5000-06",
    7: "POWER VOCA 5000-07",
    8: "POWER VOCA 5000-08",
    9: "POWER VOCA 5000-09",
    10: "POWER VOCA 5000-10",
}

# Per-metric interpretive descriptions by rank range
_METRIC_DESC: dict[str, dict[str, str]] = {
    "vocabulary_level": {
        "low": "기초적인 어휘를 학습하는 단계입니다. 일상 생활에서 자주 사용하는 기본 단어부터 체계적으로 학습하세요.",
        "mid": "중급 수준의 어휘력입니다. 학교 교과서에 나오는 단어들을 이해하고 사용할 수 있습니다.",
        "high": "상급 수준의 어휘력입니다. 다양한 분야의 전문적인 단어를 이해하고 활용할 수 있습니다.",
    },
    "accuracy": {
        "low": "정답률을 높이기 위해 틀린 단어를 반복 학습하세요. 특히 혼동하기 쉬운 단어들에 집중하면 효과적입니다.",
        "mid": "안정적인 정답률입니다. 고난도 어휘의 정확도를 높이면 더 큰 성장이 가능합니다.",
        "high": "매우 높은 정답률입니다. 꾸준한 학습 습관이 좋은 결과로 이어지고 있습니다.",
    },
    "speed": {
        "low": "응답 속도가 느린 편입니다. 단어를 보자마자 뜻이 떠오르도록 반복 연습하세요.",
        "mid": "적절한 응답 속도입니다. 꾸준한 연습으로 더 빠르게 단어를 인식할 수 있습니다.",
        "high": "빠른 응답 속도를 보여주고 있습니다. 단어 인식이 자동화되어 있어 효율적인 학습이 가능합니다.",
    },
    "vocabulary_size": {
        "low": "학습한 단어 수가 아직 적습니다. 매일 꾸준히 새로운 단어를 학습하면 빠르게 성장할 수 있습니다.",
        "mid": "적정 수준의 어휘량입니다. 복습과 새 단어 학습을 병행하면 어휘력이 더욱 탄탄해집니다.",
        "high": "풍부한 어휘량을 보유하고 있습니다. 다양한 맥락에서 단어를 활용하는 연습이 도움됩니다.",
    },
}

METRIC_NAMES: dict[str, str] = {
    "vocabulary_level": "어휘수준",
    "accuracy": "정답률",
    "speed": "속도",
    "vocabulary_size": "어휘사이즈",
}


# ---------------------------------------------------------------------------
# Calculation functions
# ---------------------------------------------------------------------------

def _score_tier(score: float) -> str:
    """Map 0-10 score to description tier."""
    if score <= 3:
        return "low"
    if score <= 6:
        return "mid"
    return "high"


def calculate_speed_score(answers: list[dict]) -> float:
    """Calculate speed score (0-10) from correct answers' time_taken_seconds.

    Faster average = higher score.
    Baseline: 3s per question = 10, 30s per question = 0.
    """
    times = [
        a["time_taken_seconds"]
        for a in answers
        if a.get("is_correct") and a.get("time_taken_seconds") is not None
    ]
    if not times:
        return 5.0  # default when no timing data

    avg_time = sum(times) / len(times)
    # Scale: 0s→10, 30s→0, capped
    score = max(0.0, min(10.0, 10.0 - (avg_time / 3.0)))
    return round(score, 1)


def calculate_accuracy_score(correct: int, total: int) -> float:
    """Normalize accuracy to 0-10 scale."""
    if total == 0:
        return 0.0
    return round((correct / total) * 10, 1)


async def calculate_vocab_size(
    db: AsyncSession, student_id: str
) -> tuple[int, float]:
    """Calculate vocabulary size and normalized 0-10 score.

    Combines:
    1. Mastered words (stage >= 5 in word_mastery)
    2. Unique correct words from placement tests (test_answers)

    Returns (raw_count, normalized_score).
    """
    # Count mastered words
    mastered_q = (
        select(func.count(WordMastery.id))
        .where(
            and_(
                WordMastery.student_id == student_id,
                WordMastery.mastered_at.isnot(None),
            )
        )
    )
    mastered_result = await db.execute(mastered_q)
    mastered_count = mastered_result.scalar() or 0

    # Count unique correct words from tests
    correct_words_q = (
        select(func.count(func.distinct(TestAnswer.word_id)))
        .join(TestSession, TestAnswer.test_session_id == TestSession.id)
        .where(
            and_(
                TestSession.student_id == student_id,
                TestAnswer.is_correct == True,  # noqa: E712
            )
        )
    )
    correct_result = await db.execute(correct_words_q)
    correct_count = correct_result.scalar() or 0

    # Deduplicate: mastered words are likely also correct in tests,
    # but we take the larger of (mastered, correct) + some bonus
    raw_count = max(mastered_count, correct_count)
    if mastered_count > 0 and correct_count > 0:
        # Both sources available — union approximation
        raw_count = max(mastered_count, correct_count) + min(mastered_count, correct_count) // 3

    # Normalize against total words in DB
    total_words_q = select(func.count(Word.id))
    total_result = await db.execute(total_words_q)
    total_words = total_result.scalar() or 1

    normalized = min(10.0, round((raw_count / total_words) * 10, 1))
    return raw_count, normalized


async def calculate_peer_ranking(
    db: AsyncSession, student_id: str, score: int, grade: str | None
) -> dict | None:
    """Calculate peer ranking (percentile) within same grade.

    Returns None if no peers found or grade is unknown.
    """
    if not grade or score is None:
        return None

    # Find all completed test scores from students with same grade
    peer_scores_q = (
        select(func.max(TestSession.score))
        .join(User, TestSession.student_id == User.id)
        .where(
            and_(
                User.grade == grade,
                User.role == "student",
                TestSession.completed_at.isnot(None),
                TestSession.score.isnot(None),
            )
        )
        .group_by(TestSession.student_id)
    )
    result = await db.execute(peer_scores_q)
    peer_scores = [row[0] for row in result.fetchall() if row[0] is not None]

    if len(peer_scores) < 2:
        return None

    # Calculate percentile (higher score = lower percentile number = better)
    better_count = sum(1 for s in peer_scores if s <= score)
    percentile = max(1, round((1 - better_count / len(peer_scores)) * 100))

    return {
        "percentile": percentile,
        "total_peers": len(peer_scores),
    }


async def calculate_member_averages(
    db: AsyncSession, teacher_id: str
) -> dict[str, float]:
    """Calculate average radar metrics across all teacher's students.

    Returns dict with keys: vocabulary_level, accuracy, speed, vocabulary_size.
    """
    # Get all completed test sessions for teacher's students
    student_ids_subq = (
        select(User.id)
        .where(and_(User.role == "student", User.teacher_id == teacher_id))
        .scalar_subquery()
    )

    # Average determined_level
    avg_level_q = (
        select(func.avg(TestSession.determined_level))
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
                TestSession.determined_level.isnot(None),
            )
        )
    )
    avg_level_result = await db.execute(avg_level_q)
    avg_level = avg_level_result.scalar() or 5.0

    # Average accuracy
    avg_score_q = (
        select(func.avg(TestSession.score))
        .where(
            and_(
                TestSession.student_id.in_(student_ids_subq),
                TestSession.completed_at.isnot(None),
                TestSession.score.isnot(None),
            )
        )
    )
    avg_score_result = await db.execute(avg_score_q)
    avg_score = avg_score_result.scalar() or 50.0

    return {
        "vocabulary_level": round(float(avg_level), 1),
        "accuracy": round(float(avg_score) / 10, 1),
        "speed": 5.0,  # Cannot easily calculate avg speed across students
        "vocabulary_size": round(float(avg_level) * 0.8, 1),  # Approximate
    }


def calculate_time_breakdown(answers: list[dict]) -> tuple[int | None, dict[str, int]]:
    """Calculate total time and time breakdown from answers.

    Returns (total_seconds, {"단어": secs, "빈칸": secs, "뜻": secs}).
    """
    total = 0.0
    categories: dict[str, float] = {"단어": 0.0, "빈칸": 0.0, "뜻": 0.0}

    for a in answers:
        t = a.get("time_taken_seconds")
        if t is None:
            continue
        total += t
        # Distribute time across categories by word level range
        wl = a.get("word_level", 1)
        if wl <= 4:
            categories["단어"] += t
        elif wl <= 7:
            categories["빈칸"] += t
        else:
            categories["뜻"] += t

    if total == 0:
        return None, {}

    return round(total), {k: round(v) for k, v in categories.items()}


def get_metric_descriptions(
    rank: int, metrics: dict[str, float]
) -> list[dict]:
    """Generate interpretive text for each radar metric.

    Returns list of MetricDetail dicts.
    """
    details = []
    for key in ["vocabulary_level", "accuracy", "speed", "vocabulary_size"]:
        score = metrics.get(key, 5.0)
        tier = _score_tier(score)
        desc = _METRIC_DESC.get(key, {}).get(tier, "")

        details.append({
            "key": key,
            "name": METRIC_NAMES[key],
            "my_score": score,
            "avg_score": 0.0,  # filled by caller
            "description": desc,
            "raw_value": None,  # filled by caller
        })

    return details
