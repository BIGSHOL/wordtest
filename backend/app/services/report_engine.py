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
    1: "초등 1학년",
    2: "초등 2학년",
    3: "초등 3학년",
    4: "초등 4학년",
    5: "초등 5학년",
    6: "초등 6학년",
    7: "중등 1학년",
    8: "중등 2학년",
    9: "중등 3학년",
    10: "고등 1학년",
}

RANK_TO_VOCAB_DESC: dict[int, str] = {
    1: "초등 기초 단어",
    2: "초등 필수 단어",
    3: "초등 심화 단어",
    4: "중학 기초 어휘",
    5: "중학 필수 어휘",
    6: "중학 완성 어휘",
    7: "고등 기초 어휘",
    8: "고등 핵심 어휘",
    9: "수능 필수 어휘",
    10: "고급 학술 어휘",
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
        "low": "기초적인 어휘를 학습하는 단계입니다. 초등 수준의 필수 단어부터 체계적으로 익혀야 합니다. 일상 회화에서 자주 사용되는 기본 동사, 명사, 형용사를 중심으로 매일 10~20개씩 반복 학습하면 빠르게 성장할 수 있습니다. 우선 추천 교재의 앞부분부터 차근차근 진행하세요.",
        "mid": "중급 수준의 어휘력입니다. 학교 교과서에 나오는 단어들을 이해하고 사용할 수 있는 수준으로, 기본적인 독해와 듣기 활동이 가능합니다. 다만 고난도 지문이나 수능 수준의 어휘에는 아직 부족함이 있으므로, 현재 레벨의 교재를 꾸준히 반복하면서 다음 단계 어휘를 조금씩 미리 학습하면 효과적입니다.",
        "high": "상급 수준의 어휘력입니다. 다양한 분야의 전문적인 단어를 이해하고 활용할 수 있습니다. 수능 및 공인 영어 시험에서 요구하는 핵심 어휘를 대부분 알고 있으며, 학술 텍스트나 영자 신문도 무리 없이 읽을 수 있는 수준입니다. 심화 어휘와 다의어 학습으로 어휘의 깊이를 더해 보세요.",
    },
    "accuracy": {
        "low": "정답률이 낮은 편입니다. 단어의 뜻을 정확히 기억하지 못하거나, 비슷한 단어끼리 혼동하는 경우가 많은 것으로 보입니다. 틀린 단어를 따로 모아 오답 노트를 만들고, 하루 3~5회 반복 복습하면 정확도가 크게 향상됩니다. 특히 헷갈리는 단어 쌍(예: affect/effect)을 함께 정리하세요.",
        "mid": "안정적인 정답률을 보이고 있습니다. 기본 어휘는 탄탄하게 잡혀 있으나, 고난도 어휘나 다의어에서 오답이 발생하는 경향이 있습니다. 중급 이상의 단어에서 문맥에 따른 뜻 변화를 학습하고, 예문과 함께 단어를 익히면 정답률을 더 높일 수 있습니다.",
        "high": "매우 높은 정답률입니다. 꾸준한 학습 습관이 좋은 결과로 이어지고 있습니다. 단어의 뜻을 정확하게 파악하는 능력이 뛰어나며, 오답이 거의 없는 수준입니다. 이 정답률을 유지하면서 더 높은 난이도의 어휘에 도전해 보세요.",
    },
    "speed": {
        "low": "응답 속도가 느린 편입니다. 단어를 보고 뜻을 떠올리는 데 시간이 오래 걸린다는 것은 아직 단어가 완전히 내재화되지 않았다는 의미입니다. 플래시카드 방식으로 단어를 보자마자 3초 안에 뜻을 말하는 연습을 반복하세요. 타이머를 설정하고 연습하면 자연스럽게 속도가 빨라집니다.",
        "mid": "적절한 응답 속도를 보이고 있습니다. 대부분의 단어를 무리 없이 인식하지만, 일부 어려운 단어에서 망설이는 경향이 있습니다. 꾸준한 반복 학습으로 더 빠르고 자동적으로 단어를 인식할 수 있도록 연습하면, 실제 시험에서도 시간 여유를 확보할 수 있습니다.",
        "high": "빠른 응답 속도를 보여주고 있습니다. 단어 인식이 자동화되어 있어 효율적인 학습이 가능합니다. 단어를 보는 즉시 의미를 파악하는 능력이 뛰어나므로, 이 속도를 유지하면서 더 복잡한 문맥(예문, 독해)에서의 어휘 활용 연습을 병행하면 좋습니다.",
    },
    "vocabulary_size": {
        "low": "학습한 단어 수가 아직 적습니다. 현재 시험 범위에서 맞춘 단어 수가 전체 대비 낮은 편이므로, 매일 꾸준히 새로운 단어를 학습하면 빠르게 성장할 수 있습니다. 하루 20~30개의 새 단어를 목표로 설정하고, 이전에 학습한 단어를 주기적으로 복습하는 것이 중요합니다.",
        "mid": "적정 수준의 어휘량을 보유하고 있습니다. 시험 범위에서 중간 정도의 단어를 정확히 알고 있으며, 복습과 새 단어 학습을 병행하면 어휘력이 더욱 탄탄해집니다. 이미 아는 단어의 다양한 의미와 용법을 함께 학습하면 실질적인 어휘력이 더욱 깊어집니다.",
        "high": "풍부한 어휘량을 보유하고 있습니다. 시험 범위의 대부분의 단어를 정확히 알고 있으며, 다양한 난이도의 어휘를 골고루 습득한 상태입니다. 이제는 양적 확대보다 질적 심화에 집중하여, 동의어/반의어/파생어까지 확장 학습하면 어휘의 활용도가 한층 높아집니다.",
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
    db: AsyncSession, student_id: str,
    determined_rank: int = 1,
    test_answers: list[dict] | None = None,
) -> tuple[int, float]:
    """Calculate vocabulary size and normalized 0-10 score.

    Uses a level-based estimation approach:
    1. For ranks below the determined rank, assume ~80% of words are known
    2. For the determined rank, use actual test accuracy
    3. Add any mastered words from word_mastery as bonus

    Returns (raw_count, normalized_score).
    """
    # Count words per level up to determined rank
    words_below_q = (
        select(func.count(Word.id))
        .where(Word.level < determined_rank)
    )
    words_below_result = await db.execute(words_below_q)
    words_below = words_below_result.scalar() or 0

    # Words at the determined rank level
    words_at_rank_q = (
        select(func.count(Word.id))
        .where(Word.level == determined_rank)
    )
    words_at_rank_result = await db.execute(words_at_rank_q)
    words_at_rank = words_at_rank_result.scalar() or 0

    # Calculate accuracy at current rank from test answers
    current_rank_accuracy = 0.5  # default
    if test_answers:
        rank_answers = [
            a for a in test_answers
            if a.get("word_level") == determined_rank
        ]
        if rank_answers:
            correct_at_rank = sum(1 for a in rank_answers if a.get("is_correct"))
            current_rank_accuracy = correct_at_rank / len(rank_answers)

    # Estimate known words
    estimated_below = int(words_below * 0.8)  # 80% of lower-level words
    estimated_at_rank = int(words_at_rank * current_rank_accuracy * 0.6)
    raw_count = estimated_below + estimated_at_rank

    # Add mastered words as bonus (from mastery learning)
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
    raw_count = max(raw_count, raw_count + mastered_count // 2)

    # Also count unique correct words from current test
    if test_answers:
        test_correct = sum(1 for a in test_answers if a.get("is_correct"))
        raw_count = max(raw_count, test_correct)

    # Normalize against total words in the test scope (up to determined rank + 1)
    scope_words_q = (
        select(func.count(Word.id))
        .where(Word.level <= min(determined_rank + 1, 10))
    )
    scope_result = await db.execute(scope_words_q)
    scope_words = scope_result.scalar() or 1

    normalized = min(10.0, round((raw_count / scope_words) * 10, 1))
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
