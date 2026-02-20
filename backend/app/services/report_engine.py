"""Report engine - calculates enhanced report metrics for test reports.

Provides:
- Radar chart metrics (4 axes: 어휘수준/정답률/속도/어휘사이즈, each 0-10)
- Per-engine accuracy/speed/count analysis
- Weakness/strength diagnosis per engine type
- Rank-to-grade/vocab/book mappings
- Peer ranking (percentile within same grade)
- Metric descriptions (interpretive text per axis)
- Time breakdown by engine category
- Consolidated report assembly (assemble_report_metrics)
"""
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.user import User
from app.models.word import Word
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer


# ---------------------------------------------------------------------------
# Static mapping tables
# ---------------------------------------------------------------------------

RANK_TO_GRADE: dict[int, str] = {
    1: "초5~중1",         # Iron      (5000-01, diff 26.6)
    2: "중1~중2",         # Bronze    (5000-02, diff 31.5)
    3: "중2~중3",         # Silver    (5000-03, diff 37.4)
    4: "중3~고1",         # Gold      (5000-04, diff 44.6)
    5: "고1",             # Platinum  (5000-05, diff 47.1)
    6: "고1~고2",         # Emerald   (5000-06, diff 47.8)
    7: "중3~고1",         # Diamond   (5000-07, diff 44.6)
    8: "고2~고3",         # Master    (5000-08, diff 53.7)
    9: "고2",             # Grandmaster (5000-09, diff 49.7)
    10: "고2~고3",        # Challenger (5000-10, diff 53.2)
    11: "고1~고2",        # Legend 1  (수능기출-01, diff 46.7)
    12: "고2~고3",        # Legend 2  (수능기출-02, diff 51.9)
    13: "고3~수능",       # Legend 3  (수능기출-03, diff 55.2)
    14: "고3",            # Legend 4  (수능기출-04, diff 53.8)
    15: "고3~수능",       # Legend 5  (수능기출-05, diff 54.6)
}

# Base vocab descriptions per rank (combined with accuracy in get_vocab_description)
_RANK_VOCAB_LABEL: dict[int, str] = {
    1: "초등 필수 단어",
    2: "중학 기초 어휘",
    3: "중학 필수 어휘",
    4: "중학 심화 어휘",
    5: "고등 기초 어휘",
    6: "고등 필수 어휘",
    7: "중학 심화 어휘",
    8: "고등 핵심 어휘",
    9: "고등 심화 어휘",
    10: "고등 핵심 어휘",
    11: "수능 기출 기초",
    12: "수능 기출 핵심",
    13: "수능 기출 심화",
    14: "수능 기출 고급",
    15: "수능 기출 완성",
}

# Keep for backward compat (static, no accuracy)
RANK_TO_VOCAB_DESC: dict[int, str] = _RANK_VOCAB_LABEL


def get_vocab_description(rank: int, accuracy_pct: int) -> str:
    """Generate one-line vocab description combining rank label + accuracy.

    Example: "초등필수 단어 40% 이해"
    """
    label = _RANK_VOCAB_LABEL.get(rank, "어휘")
    return f"{label} {accuracy_pct}% 이해"

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
    11: "POWER VOCA 수능 기출 5000-01",
    12: "POWER VOCA 수능 기출 5000-02",
    13: "POWER VOCA 수능 기출 5000-03",
    14: "POWER VOCA 수능 기출 5000-04",
    15: "POWER VOCA 수능 기출 5000-05",
}

# Per-metric interpretive descriptions by rank range
_METRIC_DESC: dict[str, dict[str, str]] = {
    "vocabulary_level": {
        "low": "동학년 학생들과 비교했을 때 기초적인 어휘를 학습하는 단계입니다. 초등 수준의 필수 단어부터 체계적으로 익혀야 합니다. 일상 회화에서 자주 사용되는 기본 동사, 명사, 형용사를 중심으로 매일 10~20개씩 반복 학습하면 빠르게 성장할 수 있습니다. 우선 추천 교재의 앞부분부터 차근차근 진행하세요.",
        "mid": "동학년 평균과 비슷한 중급 수준의 어휘력입니다. 학교 교과서에 나오는 단어들을 이해하고 사용할 수 있는 수준으로, 기본적인 독해와 듣기 활동이 가능합니다. 다만 고난도 지문이나 수능 수준의 어휘에는 아직 부족함이 있으므로, 현재 레벨의 교재를 꾸준히 반복하면서 다음 단계 어휘를 조금씩 미리 학습하면 효과적입니다.",
        "high": "동학년 학생들 중에서도 상급 수준의 어휘력입니다. 다양한 분야의 전문적인 단어를 이해하고 활용할 수 있습니다. 수능 및 공인 영어 시험에서 요구하는 핵심 어휘를 대부분 알고 있으며, 학술 텍스트나 영자 신문도 무리 없이 읽을 수 있는 수준입니다. 심화 어휘와 다의어 학습으로 어휘의 깊이를 더해 보세요.",
    },
    "accuracy": {
        "low": "동학년 평균보다 정답률이 낮은 편입니다. 단어의 뜻을 정확히 기억하지 못하거나, 비슷한 단어끼리 혼동하는 경우가 많은 것으로 보입니다. 틀린 단어를 따로 모아 오답 노트를 만들고, 하루 3~5회 반복 복습하면 정확도가 크게 향상됩니다. 특히 헷갈리는 단어 쌍(예: affect/effect)을 함께 정리하세요.",
        "mid": "동학년 평균과 비슷한 안정적인 정답률을 보이고 있습니다. 기본 어휘는 탄탄하게 잡혀 있으나, 고난도 어휘나 다의어에서 오답이 발생하는 경향이 있습니다. 중급 이상의 단어에서 문맥에 따른 뜻 변화를 학습하고, 예문과 함께 단어를 익히면 정답률을 더 높일 수 있습니다.",
        "high": "동학년 학생들 중에서도 매우 높은 정답률입니다. 꾸준한 학습 습관이 좋은 결과로 이어지고 있습니다. 단어의 뜻을 정확하게 파악하는 능력이 뛰어나며, 오답이 거의 없는 수준입니다. 이 정답률을 유지하면서 더 높은 난이도의 어휘에 도전해 보세요.",
    },
    "speed": {
        "low": "동학년 평균보다 응답 속도가 느린 편입니다. 단어를 보고 뜻을 떠올리는 데 시간이 오래 걸린다는 것은 아직 단어가 완전히 내재화되지 않았다는 의미입니다. 플래시카드 방식으로 단어를 보자마자 3초 안에 뜻을 말하는 연습을 반복하세요. 타이머를 설정하고 연습하면 자연스럽게 속도가 빨라집니다.",
        "mid": "동학년 평균과 비슷한 적절한 응답 속도를 보이고 있습니다. 대부분의 단어를 무리 없이 인식하지만, 일부 어려운 단어에서 망설이는 경향이 있습니다. 꾸준한 반복 학습으로 더 빠르고 자동적으로 단어를 인식할 수 있도록 연습하면, 실제 시험에서도 시간 여유를 확보할 수 있습니다.",
        "high": "동학년 학생들 중에서도 빠른 응답 속도를 보여주고 있습니다. 단어 인식이 자동화되어 있어 효율적인 학습이 가능합니다. 단어를 보는 즉시 의미를 파악하는 능력이 뛰어나므로, 이 속도를 유지하면서 더 복잡한 문맥(예문, 독해)에서의 어휘 활용 연습을 병행하면 좋습니다.",
    },
    "vocabulary_size": {
        "low": "동학년 평균보다 학습한 단어 수가 아직 적습니다. 현재 시험 범위에서 맞춘 단어 수가 전체 대비 낮은 편이므로, 매일 꾸준히 새로운 단어를 학습하면 빠르게 성장할 수 있습니다. 하루 20~30개의 새 단어를 목표로 설정하고, 이전에 학습한 단어를 주기적으로 복습하는 것이 중요합니다.",
        "mid": "동학년 평균과 비슷한 적정 수준의 어휘량을 보유하고 있습니다. 시험 범위에서 중간 정도의 단어를 정확히 알고 있으며, 복습과 새 단어 학습을 병행하면 어휘력이 더욱 탄탄해집니다. 이미 아는 단어의 다양한 의미와 용법을 함께 학습하면 실질적인 어휘력이 더욱 깊어집니다.",
        "high": "동학년 학생들 중에서도 풍부한 어휘량을 보유하고 있습니다. 시험 범위의 대부분의 단어를 정확히 알고 있으며, 다양한 난이도의 어휘를 골고루 습득한 상태입니다. 이제는 양적 확대보다 질적 심화에 집중하여, 동의어/반의어/파생어까지 확장 학습하면 어휘의 활용도가 한층 높아집니다.",
    },
}

METRIC_NAMES: dict[str, str] = {
    "vocabulary_level": "어휘 수준",
    "accuracy": "정확도",
    "speed": "속도",
    "vocabulary_size": "어휘 범위",
}


# ---------------------------------------------------------------------------
# Engine analysis tables
# ---------------------------------------------------------------------------

STAGE_ENGINE_MAP: dict[int, str] = {
    1: "en_to_ko",
    2: "ko_to_en",
    3: "listen_type",
    4: "listen_ko",
    5: "ko_type",
}

ENGINE_LABELS: dict[str, str] = {
    "en_to_ko": "영한",
    "ko_to_en": "한영",
    "emoji": "이모지",
    "sentence": "예문",
    "listen_en": "리스닝E",
    "listen_ko": "리스닝K",
    "listen_type": "리스닝T",
    "ko_type": "한영T",
}

_ENGINE_CATEGORY: dict[str, str] = {
    "en_to_ko": "단어",
    "ko_to_en": "단어",
    "emoji": "이모지",
    "sentence": "빈칸",
    "listen_en": "리스닝",
    "listen_ko": "리스닝",
    "listen_type": "리스닝",
    "ko_type": "타이핑",
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


def calculate_speed_score(answers: list[dict]) -> tuple[float, float | None]:
    """Calculate speed score (0-10) and avg_time from correct answers.

    Faster average = higher score.
    Baseline: 0s→10, 30s→0, capped.
    Returns (score, avg_time_seconds).
    """
    times = [
        a["time_taken_seconds"]
        for a in answers
        if a.get("is_correct") and a.get("time_taken_seconds") is not None
    ]
    if not times:
        return 5.0, None

    avg_time = round(sum(times) / len(times), 1)
    score = max(0.0, min(10.0, 10.0 - (avg_time / 3.0)))
    return round(score, 1), avg_time


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
    """Calculate estimated vocabulary size and normalized 0-10 score.

    Cumulative approach based on curriculum position:
    - Levels below determined_rank: all words assumed known
    - At determined_rank: words * test accuracy (partial knowledge)

    Returns (raw_count, normalized_score).
    """
    # Words in all levels below the determined rank (fully known)
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

    # Cumulative estimate: all lower-level words + partial current level
    raw_count = words_below + int(words_at_rank * current_rank_accuracy)

    # Total words in scope for normalization (all levels up to rank+1)
    scope_words_q = (
        select(func.count(Word.id))
        .where(Word.level <= min(determined_rank + 1, 15))
    )
    scope_result = await db.execute(scope_words_q)
    scope_words = scope_result.scalar() or 1

    normalized = min(10.0, round((raw_count / scope_words) * 10, 1))
    return raw_count, normalized


async def calculate_peer_ranking(
    db: AsyncSession, student_id: str, score: int, grade: str | None
) -> dict | None:
    """Calculate peer ranking (percentile) within same grade.

    Falls back to estimated dummy ranking when insufficient peer data.
    """
    if score is None:
        return _estimate_peer_ranking(50)

    if not grade:
        return _estimate_peer_ranking(score)

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
        # Not enough real peers → return estimated dummy ranking
        return _estimate_peer_ranking(score)

    # Calculate percentile (higher score = lower percentile number = better)
    better_count = sum(1 for s in peer_scores if s <= score)
    percentile = max(1, round((1 - better_count / len(peer_scores)) * 100))

    return {
        "percentile": percentile,
        "total_peers": len(peer_scores),
    }


def _estimate_peer_ranking(score: int) -> dict:
    """Estimate peer ranking from score when real peer data is unavailable.

    Maps accuracy (0-100) to a plausible percentile among ~120 virtual peers.
    Higher score → lower percentile (= better rank).
    """
    import random
    random.seed(score)  # deterministic for same score

    if score >= 90:
        percentile = random.randint(3, 10)
    elif score >= 80:
        percentile = random.randint(10, 25)
    elif score >= 70:
        percentile = random.randint(20, 40)
    elif score >= 60:
        percentile = random.randint(35, 55)
    elif score >= 50:
        percentile = random.randint(45, 65)
    elif score >= 40:
        percentile = random.randint(55, 75)
    else:
        percentile = random.randint(70, 90)

    return {
        "percentile": percentile,
        "total_peers": random.randint(95, 130),
    }


async def calculate_member_averages(
    db: AsyncSession, teacher_id: str, grade: str | None = None
) -> dict[str, float]:
    """Calculate average radar metrics across same-grade students.

    If grade is provided, filters to students with the same grade.
    Falls back to all teacher's students if no grade match.
    Returns dict with keys: vocabulary_level, accuracy, speed, vocabulary_size.
    """
    # Get students filtered by grade (same-grade peers) or all teacher's students
    filters = [User.role == "student", User.teacher_id == teacher_id]
    if grade:
        filters.append(User.grade == grade)
    student_ids_subq = (
        select(User.id)
        .where(and_(*filters))
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
        "speed": 8.0,  # Dummy ~6s avg answer time
        "vocabulary_size": round(float(avg_level) * 0.7, 1),  # Approximate
    }


async def get_total_word_count(db: AsyncSession) -> int:
    """Return total word count for levels 1-10 (curriculum scope)."""
    result = await db.execute(
        select(func.count(Word.id)).where(Word.level.between(1, 10))
    )
    return result.scalar() or 0


# ---------------------------------------------------------------------------
# Per-engine analysis functions
# ---------------------------------------------------------------------------

def infer_question_type(answer: dict) -> str | None:
    """Infer canonical question_type from answer dict when not stored.

    For LearningAnswer: use stage mapping as fallback.
    For TestAnswer: no reliable inference possible (return None).
    """
    qt = answer.get("question_type")
    if qt:
        return qt
    stage = answer.get("stage")
    if stage:
        return STAGE_ENGINE_MAP.get(stage)
    return None


def calculate_per_engine_stats(answers: list[dict]) -> list[dict]:
    """Calculate per-engine accuracy, speed, and count.

    Returns list of dicts sorted by accuracy ascending (weakest first).
    Each dict: {engine, label, total, correct, accuracy_pct, avg_time_sec}.
    """
    engine_data: dict[str, dict] = {}

    for a in answers:
        qt = infer_question_type(a)
        if not qt:
            continue

        if qt not in engine_data:
            engine_data[qt] = {"total": 0, "correct": 0, "times": []}

        engine_data[qt]["total"] += 1
        if a.get("is_correct"):
            engine_data[qt]["correct"] += 1
        t = a.get("time_taken_seconds")
        if t is not None and a.get("is_correct"):
            engine_data[qt]["times"].append(t)

    results = []
    for engine_name, data in engine_data.items():
        total = data["total"]
        correct = data["correct"]
        times = data["times"]
        accuracy_pct = round(correct / total * 100, 1) if total > 0 else 0.0
        avg_time = round(sum(times) / len(times), 1) if times else None

        results.append({
            "engine": engine_name,
            "label": ENGINE_LABELS.get(engine_name, engine_name),
            "total": total,
            "correct": correct,
            "accuracy_pct": accuracy_pct,
            "avg_time_sec": avg_time,
        })

    results.sort(key=lambda x: x["accuracy_pct"])
    return results


def diagnose_strengths_weaknesses(
    engine_stats: list[dict],
    threshold_weak: float = 60.0,
    threshold_strong: float = 80.0,
) -> dict:
    """Identify weak and strong engines from per-engine stats.

    Returns {"weaknesses": [...], "strengths": [...]}.
    Only includes engines with >= 2 questions for reliability.
    """
    weaknesses = [
        {"engine": s["engine"], "label": s["label"], "total": s["total"], "correct": s["correct"], "accuracy_pct": s["accuracy_pct"], "avg_time_sec": s.get("avg_time_sec")}
        for s in engine_stats
        if s["accuracy_pct"] < threshold_weak and s["total"] >= 2
    ]
    strengths = [
        {"engine": s["engine"], "label": s["label"], "total": s["total"], "correct": s["correct"], "accuracy_pct": s["accuracy_pct"], "avg_time_sec": s.get("avg_time_sec")}
        for s in engine_stats
        if s["accuracy_pct"] >= threshold_strong and s["total"] >= 2
    ]
    return {"weaknesses": weaknesses, "strengths": strengths}


def calculate_time_breakdown(answers: list[dict]) -> tuple[int | None, dict[str, int]]:
    """Calculate total time and time breakdown by engine category.

    Returns (total_seconds, {"단어": secs, "리스닝": secs, ...}).
    """
    total = 0.0
    categories: dict[str, float] = {}

    for a in answers:
        t = a.get("time_taken_seconds")
        if t is None:
            continue
        total += t
        qt = infer_question_type(a)
        cat = _ENGINE_CATEGORY.get(qt, "기타") if qt else "기타"
        categories[cat] = categories.get(cat, 0.0) + t

    if total == 0:
        return None, {}

    return round(total), {k: round(v) for k, v in categories.items() if round(v) > 0}


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


# ---------------------------------------------------------------------------
# Consolidated report assembly
# ---------------------------------------------------------------------------

async def assemble_report_metrics(
    db: AsyncSession,
    student_id: str,
    teacher_id: str | None,
    student_grade: str | None,
    rank: int,
    score: int,
    correct_count: int,
    total_questions: int,
    answers: list[dict],
) -> dict:
    """Consolidated report metric assembly used by all report endpoints.

    Returns dict with keys: radar, metric_details, peer_ranking, grade_level,
    vocab_description, recommended_book, total_time_seconds, category_times,
    per_engine_stats, diagnosis, vocab_raw.
    """
    # Radar metrics
    accuracy_score = calculate_accuracy_score(correct_count, total_questions)
    speed_score, avg_time = calculate_speed_score(answers)
    vocab_raw, vocab_score = await calculate_vocab_size(
        db, student_id, determined_rank=rank, test_answers=answers
    )

    radar = {
        "vocabulary_level": float(rank),
        "accuracy": accuracy_score,
        "speed": speed_score,
        "vocabulary_size": vocab_score,
    }

    # Peer ranking
    peer = await calculate_peer_ranking(db, student_id, score, student_grade)

    # Same-grade averages
    if teacher_id:
        avg_metrics = await calculate_member_averages(
            db, teacher_id, grade=student_grade
        )
    else:
        avg_metrics = {
            "vocabulary_level": 5.0, "accuracy": 5.0,
            "speed": 5.0, "vocabulary_size": 5.0,
        }

    # Metric details with descriptions
    details_raw = get_metric_descriptions(rank, radar)
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
        metric_details.append(d)

    # Time breakdown (by engine category)
    total_time, cat_times = calculate_time_breakdown(answers)

    # Per-engine stats and diagnosis
    engine_stats = calculate_per_engine_stats(answers)
    diagnosis = diagnose_strengths_weaknesses(engine_stats)

    # Mappings
    grade_level = RANK_TO_GRADE.get(rank, "미정")
    vocab_desc = get_vocab_description(rank, score)
    recommended_book = RANK_TO_BOOK.get(rank, "")

    return {
        "radar": radar,
        "metric_details": metric_details,
        "peer_ranking": peer,
        "grade_level": grade_level,
        "vocab_description": vocab_desc,
        "recommended_book": recommended_book,
        "total_time_seconds": total_time,
        "category_times": cat_times,
        "per_engine_stats": engine_stats,
        "diagnosis": diagnosis,
        "vocab_raw": vocab_raw,
    }
