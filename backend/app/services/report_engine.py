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

# ── Skill area (능력영역) system ───────────────────────────────────────────
# 6 testable areas: 5 core + comprehensive (sentence_type engine)

SKILL_AREA_ENGINES: dict[str, list[str]] = {
    "meaning":        ["en_to_ko", "antonym_choice"],
    "association":    ["ko_to_en", "emoji"],
    "listening":      ["listen_en", "listen_ko"],
    "inference":      ["sentence"],
    "spelling":       ["listen_type", "ko_type", "antonym_type"],
    "comprehensive":  ["sentence_type"],
}

ENGINE_TO_SKILL: dict[str, str] = {
    engine: skill
    for skill, engines in SKILL_AREA_ENGINES.items()
    for engine in engines
}

SKILL_AREA_NAMES: dict[str, str] = {
    "meaning": "의미파악력",
    "association": "단어연상력",
    "listening": "발음청취력",
    "inference": "어휘추론력",
    "spelling": "철자기억력",
    "comprehensive": "종합응용력",
}

SKILL_AREA_KEYS = ["meaning", "association", "listening", "inference", "spelling", "comprehensive"]

# Per-skill-area interpretive descriptions by 10% score tier (1~10)
# Tier 1 = 0~10%, Tier 2 = 11~20%, ... Tier 10 = 91~100%
_SKILL_DESC: dict[str, dict[int, str]] = {
    "meaning": {
        1: "영어 단어의 뜻을 거의 파악하지 못하는 단계입니다. 가장 기초적인 생활 영단어(예: apple, book, happy)부터 그림 카드와 함께 매일 5개씩 반복 학습하는 것을 권장합니다.",
        2: "기초 단어의 뜻을 일부 알고 있으나 대부분 혼동합니다. 자주 접하는 일상 단어를 플래시카드로 만들어 하루 10개씩 반복하면 빠르게 기초를 다질 수 있습니다.",
        3: "기본 단어의 뜻을 어렴풋이 알지만 정확도가 낮습니다. 단어장을 활용해 뜻과 예문을 함께 외우는 습관을 들이면 의미 파악력이 크게 향상됩니다.",
        4: "일상적인 단어의 뜻은 대체로 파악하지만 비슷한 뜻의 단어를 혼동하는 경우가 많습니다. 유의어를 그룹으로 묶어 차이를 비교하며 학습하세요.",
        5: "중간 수준의 의미 파악력을 보입니다. 기본 어휘는 안정적이나 다의어나 추상적 단어에서 오답이 발생합니다. 예문 속에서 단어의 쓰임을 파악하는 연습이 필요합니다.",
        6: "평균 이상의 의미 파악력입니다. 대부분의 단어 뜻을 맞히지만 고난도 어휘에서 간혹 실수합니다. 수능 빈출 어휘와 다의어의 두 번째, 세 번째 뜻까지 학습해 보세요.",
        7: "우수한 의미 파악력을 보여줍니다. 다의어의 문맥별 뜻 차이를 대부분 구분합니다. 학술 용어와 고급 어휘로 영역을 확장하면 상위권에 진입할 수 있습니다.",
        8: "뛰어난 의미 파악력입니다. 고난도 어휘와 유사어의 미묘한 차이까지 정확히 구분합니다. 영영 사전으로 뉘앙스를 더 깊이 이해하면 최상위 수준에 도달합니다.",
        9: "최상위 수준의 의미 파악력입니다. 대부분의 어휘를 정확하고 빠르게 파악하며, 학술 및 전문 용어까지 폭넓게 이해합니다. 원서 읽기로 실전 감각을 유지하세요.",
        10: "완벽에 가까운 의미 파악력입니다. 모든 수준의 어휘를 즉시 파악하며 다의어, 유사어, 학술 용어까지 완벽합니다. 현재 수준을 유지하며 독해 속도 향상에 집중하세요.",
    },
    "association": {
        1: "한국어 뜻에서 영어 단어를 거의 떠올리지 못하는 단계입니다. 그림-단어 매칭 게임이나 이미지 연상 카드를 활용해 시각적으로 연결하는 연습부터 시작하세요.",
        2: "아주 기본적인 단어만 연상할 수 있습니다. 매일 사용하는 물건에 영어 이름표를 붙여두고, 보는 즉시 영어 단어를 말하는 습관을 들여 보세요.",
        3: "기초 단어의 연상은 가능하나 속도가 느리고 정확도가 낮습니다. 한국어 뜻을 보고 3초 안에 영어 단어를 말하는 속도 훈련이 효과적입니다.",
        4: "일상 어휘는 연상하지만 비슷한 뜻의 단어끼리 혼동합니다. 유의어(big/large/huge)를 그룹으로 묶어 상황별 쓰임을 구분하는 연습이 도움됩니다.",
        5: "중간 수준의 연상력입니다. 기본 어휘는 빠르게 떠올리지만 추상적 개념이나 고급 어휘에서 막힙니다. 주제별(감정, 과학, 사회) 어휘를 정리하며 연상 범위를 넓히세요.",
        6: "평균 이상의 연상력을 보입니다. 대부분의 단어를 연상하지만 동의어 중 최적의 단어 선택에 어려움이 있습니다. 콜로케이션(자주 함께 쓰는 단어 조합)을 학습하세요.",
        7: "우수한 연상력입니다. 유의어 간 미묘한 차이를 인식하고 상황에 맞는 단어를 선택합니다. 반의어와 파생어까지 함께 정리하면 어휘 네트워크가 더 강화됩니다.",
        8: "뛰어난 연상력을 보여줍니다. 한국어 뜻에서 영어 단어를 즉시 떠올리며 유의어/반의어 관계까지 정확합니다. 영어로 생각하는 습관을 기르면 최고 수준에 도달합니다.",
        9: "최상위 수준의 연상력입니다. 복잡한 개념도 적절한 영어 단어로 즉시 표현하며, 어휘 간 관계를 체계적으로 파악합니다. 영작문을 통해 실전 활용력을 높이세요.",
        10: "완벽한 연상력입니다. 모든 개념을 즉시 영어로 변환하며 뉘앙스에 맞는 최적의 단어를 선택합니다. 현재 수준을 유지하며 표현의 다양성을 더해 보세요.",
    },
    "listening": {
        1: "영어 발음을 듣고 단어를 거의 인식하지 못합니다. 알파벳 음가(phonics)부터 시작해서 기초 단어의 발음을 하나씩 익히세요. 매일 10분씩 영어 발음 듣기 연습을 권장합니다.",
        2: "아주 기본적인 단어 발음만 인식합니다. 영어 단어를 들으며 따라 말하는 섀도잉(shadowing) 연습을 매일 하면 듣기 능력이 빠르게 향상됩니다.",
        3: "기초 단어는 들리지만 비슷한 발음의 단어를 구분하지 못합니다. 최소 대립쌍(예: bat/bet, ship/sheep) 듣기 훈련으로 발음 차이를 인식하는 연습이 필요합니다.",
        4: "일상 단어의 발음을 대체로 인식하지만 강세나 모음 차이에서 혼동합니다. 단어의 강세 위치를 의식하며 듣는 연습을 하고, 발음 기호를 함께 학습하세요.",
        5: "중간 수준의 청취력입니다. 명확한 발음은 잘 인식하지만 빠른 속도나 연음에서 어려움이 있습니다. 영어 동영상을 자막 없이 시청하며 자연스러운 발음에 익숙해지세요.",
        6: "평균 이상의 청취력을 보입니다. 대부분의 단어 발음을 정확히 인식하며, 비슷한 발음도 문맥 속에서 구분합니다. 다양한 억양(미국/영국식)에 노출되면 더 향상됩니다.",
        7: "우수한 청취력입니다. 빠른 속도와 다양한 억양에서도 단어를 정확히 인식합니다. 팟캐스트나 뉴스 청취로 고급 어휘의 발음까지 익히면 최상위권에 진입합니다.",
        8: "뛰어난 청취력을 보여줍니다. 연음, 축약, 다양한 억양 상황에서도 정확하게 단어를 식별합니다. 학술 강연이나 TED 토크 청취로 실전 감각을 유지하세요.",
        9: "최상위 수준의 청취력입니다. 거의 모든 상황에서 영어 발음을 즉시 인식하고 정확한 의미를 파악합니다. 원어민 대화 수준의 자연스러운 영어를 청취하세요.",
        10: "완벽에 가까운 청취력입니다. 모든 속도, 억양, 상황에서 영어 단어를 즉시 정확하게 인식합니다. 현재 수준을 유지하며 리스닝 실력을 독해와 연결해 보세요.",
    },
    "inference": {
        1: "문맥에서 단어를 추론하는 것이 매우 어려운 단계입니다. 짧고 쉬운 영어 문장을 매일 읽으며 단어가 어떤 상황에서 쓰이는지 감각을 키우는 것이 우선입니다.",
        2: "아주 기본적인 문장에서만 단어를 유추할 수 있습니다. 그림이 있는 쉬운 영어 동화책을 읽으며 모르는 단어를 문맥으로 유추하는 연습을 시작하세요.",
        3: "단순한 문맥에서 단어를 추론할 수 있으나 정확도가 낮습니다. 빈칸 채우기 문제를 매일 풀며 문맥 단서를 찾는 습관을 기르면 크게 향상됩니다.",
        4: "일상적 문맥에서는 추론이 가능하지만 복잡한 문장에서 오답이 많습니다. 예문을 많이 읽으면서 단어가 어떤 품사, 어떤 문맥에서 쓰이는지 패턴을 익히세요.",
        5: "중간 수준의 추론력입니다. 기본 문맥 추론은 안정적이나 관용 표현이나 고급 어휘가 포함된 문장에서 어려움이 있습니다. 다양한 장르의 짧은 지문을 읽는 습관이 필요합니다.",
        6: "평균 이상의 추론력을 보입니다. 대부분의 문맥에서 적절한 단어를 찾아내며, 기본 관용 표현도 이해합니다. 수능 유형의 빈칸 추론 문제를 연습하면 더 향상됩니다.",
        7: "우수한 추론력입니다. 복잡한 문장 구조와 관용 표현에서도 정확하게 단어를 추론합니다. 영자 신문이나 잡지를 읽으며 고급 문맥 추론력을 키워 보세요.",
        8: "뛰어난 추론력을 보여줍니다. 학술적 지문이나 복합 문장에서도 빈칸에 맞는 단어를 빠르고 정확하게 찾아냅니다. 원서 다독으로 추론 속도를 더 높여 보세요.",
        9: "최상위 수준의 추론력입니다. 거의 모든 문맥에서 정확한 단어를 추론하며, 문장의 논리 흐름을 빠르게 파악합니다. 비문학 독해로 다양한 분야의 어휘를 확장하세요.",
        10: "완벽에 가까운 추론력입니다. 모든 난이도의 문맥에서 즉시 적절한 단어를 파악하며 논리적 추론이 탁월합니다. 현재 실력을 유지하며 비판적 독해로 발전시키세요.",
    },
    "spelling": {
        1: "영어 철자를 거의 기억하지 못하는 단계입니다. 알파벳과 기초 단어(3~4글자)의 철자를 소리 내어 읽으며 쓰는 연습부터 시작하세요. 하루 3개씩 정확히 외우는 것을 목표로 합니다.",
        2: "아주 기본적인 짧은 단어만 쓸 수 있습니다. 자주 사용하는 단어를 매일 5개씩 발음하며 받아쓰기 하면 철자 감각이 빠르게 형성됩니다.",
        3: "짧은 단어의 철자는 기억하나 모음이나 이중 자음에서 자주 틀립니다. 틀린 단어를 오답 노트에 정리하고 3일 간격으로 반복 테스트하는 것이 효과적입니다.",
        4: "기본 단어의 철자를 대체로 기억하지만 비슷한 철자의 단어를 혼동합니다. 자주 혼동하는 단어 쌍(예: their/there, quiet/quite)을 모아 집중 연습하세요.",
        5: "중간 수준의 철자 기억력입니다. 일상 단어는 정확하게 쓰지만 긴 단어나 불규칙 철자에서 실수합니다. 접두사/접미사 규칙(un-, -tion, -ment)을 학습하면 체계적으로 기억할 수 있습니다.",
        6: "평균 이상의 철자 기억력을 보입니다. 대부분의 단어를 정확히 타이핑하며, 기본적인 형태소 규칙을 이해합니다. 고급 접사와 어근(etymology) 학습으로 더 향상시킬 수 있습니다.",
        7: "우수한 철자 기억력입니다. 긴 단어와 복잡한 철자도 대부분 정확합니다. 라틴어/그리스어 어근을 학습하면 처음 보는 단어의 철자도 추론할 수 있게 됩니다.",
        8: "뛰어난 철자 기억력을 보여줍니다. 불규칙 철자와 예외적인 단어까지 정확하게 기억합니다. 속도와 정확성을 동시에 높이는 타이핑 연습을 병행하세요.",
        9: "최상위 수준의 철자 기억력입니다. 거의 모든 단어를 빠르고 정확하게 타이핑하며, 영어 형태론에 대한 깊은 이해를 보여줍니다. 학술 용어 철자까지 도전해 보세요.",
        10: "완벽에 가까운 철자 기억력입니다. 모든 수준의 단어를 즉시 정확하게 타이핑합니다. 현재 수준을 유지하며 다양한 분야의 전문 용어로 어휘 범위를 넓혀 보세요.",
    },
    "comprehensive": {
        1: "영어 어휘 전반에 걸쳐 기초부터 다져야 하는 단계입니다. 가장 기본적인 생활 영단어부터 차근차근 학습하면 모든 영역이 함께 성장합니다. 꾸준함이 가장 중요합니다.",
        2: "전체적으로 기초 단계이며, 모든 영역에서 기본기 훈련이 필요합니다. 매일 꾸준히 15분씩 단어 학습을 이어가면 빠른 시일 내에 눈에 띄는 성장을 경험할 수 있습니다.",
        3: "기초 어휘력은 형성되어 가고 있으나 전반적으로 보강이 필요합니다. 가장 약한 영역 1~2개를 우선 집중 학습하면 종합 점수가 효과적으로 올라갑니다.",
        4: "기본적인 어휘 능력이 갖춰지고 있습니다. 일부 영역에서 성장이 보이며, 약한 영역을 보완하면 중급 수준에 빠르게 도달할 수 있습니다. 균형 잡힌 학습 계획을 세워 보세요.",
        5: "중간 수준의 종합 어휘력입니다. 기본기는 안정적이며, 영역별 강약이 뚜렷합니다. 강한 영역을 유지하면서 약한 영역에 학습 시간을 더 배분하면 효과적입니다.",
        6: "평균 이상의 종합 어휘력을 보여줍니다. 대부분의 영역에서 안정적인 실력을 갖추고 있으며, 상대적으로 약한 영역 1~2개만 집중하면 상위권에 진입합니다.",
        7: "우수한 종합 어휘력입니다. 여러 영역에서 고른 실력을 보이며 고급 어휘 학습 단계에 접어들었습니다. 심화 학습과 실전 문제 풀이를 병행하면 더욱 성장합니다.",
        8: "뛰어난 종합 어휘력을 보여줍니다. 모든 영역에서 높은 수준의 실력을 유지하고 있습니다. 원서 읽기, 영작문 등 실전 활용을 통해 어휘력을 더욱 견고히 하세요.",
        9: "최상위 수준의 종합 어휘력입니다. 모든 영역에서 탁월한 실력을 보이며 고급 어휘까지 폭넓게 이해합니다. 다양한 분야의 영어 원서를 읽으며 실력을 유지하세요.",
        10: "완벽에 가까운 종합 어휘력입니다. 모든 영역에서 최고 수준의 실력을 갖추고 있습니다. 현재의 뛰어난 실력을 유지하면서 영어 독서와 실전 활용으로 발전시키세요.",
    },
}

# Legacy 4-axis metric names (kept for backward compatibility where needed)
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
    "sentence": "예문 빈칸",
    "listen_en": "듣기 영어",
    "listen_ko": "듣기 한국어",
    "listen_type": "듣기 타이핑",
    "ko_type": "한영 타이핑",
    "antonym_type": "반의어 타이핑",
    "antonym_choice": "반의어 고르기",
    "sentence_type": "예문 타이핑",
}

_ENGINE_CATEGORY: dict[str, str] = {
    engine: SKILL_AREA_NAMES[skill]
    for skill, engines in SKILL_AREA_ENGINES.items()
    for engine in engines
}


# ---------------------------------------------------------------------------
# Calculation functions
# ---------------------------------------------------------------------------

def _score_tier(score: float) -> int:
    """Map 0-10 score to 1~10 tier (each tier = 10%)."""
    tier = max(1, min(10, int(score) + 1))
    # Edge case: exact 0 → tier 1, exact 10 → tier 10
    if score <= 0:
        return 1
    if score >= 10:
        return 10
    return tier


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
    """Calculate average skill area scores across same-grade students.

    Returns dict with keys for all 6 skill areas.
    Currently returns estimated averages; will use real peer data when available.
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

    # Average accuracy as baseline for all skill areas
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
    base = round(float(avg_score) / 10, 1)

    # Approximate per-area averages from overall accuracy
    return {
        "meaning": base,
        "association": round(base * 0.95, 1),
        "listening": round(base * 0.85, 1),
        "inference": round(base * 0.80, 1),
        "spelling": round(base * 0.75, 1),
        "comprehensive": round(base * 0.87, 1),
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


def session_duration_seconds(
    started_at: "datetime | None",
    completed_at: "datetime | None",
) -> int | None:
    """Fallback: compute total seconds from session start/end timestamps."""
    if started_at and completed_at:
        diff = (completed_at - started_at).total_seconds()
        if diff > 0:
            return round(diff)
    return None


def calculate_skill_area_scores(answers: list[dict]) -> dict[str, float]:
    """Calculate per-skill-area accuracy scores (0-10 scale).

    Groups answers by ENGINE_TO_SKILL mapping and calculates accuracy for each.
    Comprehensive uses sentence_type data when available, otherwise weighted avg of other areas.
    Returns dict with keys: meaning, association, listening, inference, spelling, comprehensive.
    """
    skill_data: dict[str, dict] = {k: {"total": 0, "correct": 0} for k in SKILL_AREA_KEYS}

    for a in answers:
        qt = infer_question_type(a)
        if not qt:
            continue
        skill = ENGINE_TO_SKILL.get(qt)
        if not skill:
            continue
        skill_data[skill]["total"] += 1
        if a.get("is_correct"):
            skill_data[skill]["correct"] += 1

    scores: dict[str, float] = {}
    # Track non-comprehensive areas for fallback weighted average
    weighted_sum = 0.0
    total_weight = 0

    for key in SKILL_AREA_KEYS:
        total = skill_data[key]["total"]
        correct = skill_data[key]["correct"]
        if total > 0:
            score = round((correct / total) * 10, 1)
            if key != "comprehensive":
                weighted_sum += score * total
                total_weight += total
        else:
            score = 0.0
        scores[key] = score

    # Fallback: if comprehensive has no data (no sentence_type questions), use weighted avg
    if scores.get("comprehensive", 0.0) == 0.0 and skill_data["comprehensive"]["total"] == 0:
        scores["comprehensive"] = round(weighted_sum / total_weight, 1) if total_weight > 0 else 0.0

    return scores


def get_metric_descriptions(
    rank: int, metrics: dict[str, float]
) -> list[dict]:
    """Generate interpretive text for each skill area metric.

    Returns list of MetricDetail dicts for all 6 skill areas.
    """
    details = []

    for key in SKILL_AREA_KEYS:
        score = metrics.get(key, 0.0)
        tier = _score_tier(score)
        desc = _SKILL_DESC.get(key, {}).get(tier, "")

        details.append({
            "key": key,
            "name": SKILL_AREA_NAMES.get(key, key),
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

    Radar uses 6 skill area axes: meaning, association, listening, inference,
    spelling, comprehensive (sentence_type engine, or weighted avg fallback).
    """
    # Skill area scores (6 axes)
    radar = calculate_skill_area_scores(answers)

    # Peer ranking
    peer = await calculate_peer_ranking(db, student_id, score, student_grade)

    # Same-grade averages (now skill-area based)
    if teacher_id:
        avg_metrics = await calculate_member_averages(
            db, teacher_id, grade=student_grade
        )
    else:
        avg_metrics = {k: 5.0 for k in SKILL_AREA_KEYS}

    # Metric details with descriptions
    details_raw = get_metric_descriptions(rank, radar)
    metric_details = []
    for d in details_raw:
        d["avg_score"] = 5.0  # fixed 50% for all skill areas
        metric_details.append(d)

    # Time breakdown (by skill area category)
    total_time, cat_times = calculate_time_breakdown(answers)

    # Per-engine stats and diagnosis
    engine_stats = calculate_per_engine_stats(answers)
    diagnosis = diagnose_strengths_weaknesses(engine_stats)

    # Mappings
    grade_level = RANK_TO_GRADE.get(rank, "미정")
    vocab_desc = get_vocab_description(rank, score)
    recommended_book = RANK_TO_BOOK.get(rank, "")

    # Legacy values for backward compat
    vocab_raw, _ = await calculate_vocab_size(
        db, student_id, determined_rank=rank, test_answers=answers
    )

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
