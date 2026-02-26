"""Report Engine - generates per-engine coverage and diagnostic reports.

Analyzes the word pool against each question engine to produce:
- Per-engine coverage stats (how many words each engine can handle)
- Distractor pool health
- Legacy name mapping reference
- Consumer usage matrix (which test system uses which engine)
"""
from __future__ import annotations

from dataclasses import dataclass, field

from app.models.word import Word
from app.services.question_engines.base import DistractorPool
from app.services.question_engines import (
    ENGINES,
    CANONICAL_TO_LEVEL,
    CANONICAL_TO_MASTERY,
    build_pool,
)


@dataclass
class EngineReport:
    """Report for a single engine."""
    canonical_name: str
    korean_name: str
    description: str
    level_test_name: str       # legacy name in level test API
    mastery_name: str          # legacy name in mastery API
    card_component: str        # frontend card used
    answer_direction: str      # e.g. "English -> Korean" or "Audio -> English (typing)"
    is_typing: bool
    eligible_count: int        # words that can_generate
    total_words: int
    coverage_pct: float
    sample_words: list[str]    # up to 5 sample eligible words


@dataclass
class PoolHealthReport:
    """Health metrics for the distractor pool."""
    total_words: int
    unique_korean: int
    unique_english: int
    words_with_example: int
    example_coverage_pct: float


@dataclass
class ConsumerUsage:
    """Which engines each test consumer uses."""
    consumer: str              # "Level Test" | "Mastery (Stage)" | "Mastery (Mixed)" etc.
    engines_used: list[str]    # canonical engine names


@dataclass
class FullReport:
    """Complete question engine system report."""
    engine_reports: list[EngineReport]
    pool_health: PoolHealthReport
    consumer_usages: list[ConsumerUsage]
    legacy_mapping: dict[str, str]   # legacy name -> canonical


# ── Engine metadata ──────────────────────────────────────────────────────────

_ENGINE_META: dict[str, dict] = {
    "en_to_ko": {
        "korean_name": "영한",
        "description": "영어 단어를 보여주고 한국어 뜻 고르기",
        "card": "WordCard",
        "direction": "English -> Korean (choice)",
    },
    "ko_to_en": {
        "korean_name": "한영",
        "description": "한국어 뜻을 보여주고 영어 단어 고르기",
        "card": "MeaningCard",
        "direction": "Korean -> English (choice)",
    },
    "emoji": {
        "korean_name": "이모지",
        "description": "이모지를 보여주고 영어 단어 고르기",
        "card": "EmojiCard",
        "direction": "Emoji -> English (choice)",
    },
    "sentence": {
        "korean_name": "예문 빈칸",
        "description": "빈칸 문장을 보여주고 영어 단어 고르기",
        "card": "SentenceCard",
        "direction": "Sentence blank -> English (choice)",
    },
    "listen_en": {
        "korean_name": "듣기 영어",
        "description": "TTS 발음을 듣고 영어 단어 고르기",
        "card": "ListeningCard",
        "direction": "Audio -> English (choice)",
    },
    "listen_ko": {
        "korean_name": "듣기 한국어",
        "description": "TTS 발음을 듣고 한국어 뜻 고르기",
        "card": "ListeningCard",
        "direction": "Audio -> Korean (choice)",
    },
    "listen_type": {
        "korean_name": "듣기 타이핑",
        "description": "TTS 발음을 듣고 영어 단어 타이핑",
        "card": "ListeningCard + TypingInput",
        "direction": "Audio -> English (typing)",
    },
    "ko_type": {
        "korean_name": "한영 타이핑",
        "description": "한국어 뜻을 보고 영어 단어 타이핑",
        "card": "MeaningCard + TypingInput",
        "direction": "Korean -> English (typing)",
    },
    "antonym_type": {
        "korean_name": "반의어 타이핑",
        "description": "영어 단어의 반의어를 타이핑",
        "card": "AntonymCard + TypingInput",
        "direction": "English -> Antonym (typing)",
    },
    "antonym_choice": {
        "korean_name": "반의어 고르기",
        "description": "영어 단어의 반의어를 4지선다로 고르기",
        "card": "AntonymCard",
        "direction": "English -> Antonym (choice)",
    },
}

_CONSUMER_USAGES = [
    ConsumerUsage(
        consumer="Level Test (placement)",
        engines_used=["en_to_ko", "ko_to_en", "emoji", "sentence", "listen_en"],
    ),
    ConsumerUsage(
        consumer="Mastery Stage Test (stage 1)",
        engines_used=["en_to_ko", "emoji"],
    ),
    ConsumerUsage(
        consumer="Mastery Stage Test (stage 2)",
        engines_used=["ko_to_en", "emoji"],
    ),
    ConsumerUsage(
        consumer="Mastery Stage Test (stage 3)",
        engines_used=["listen_type"],
    ),
    ConsumerUsage(
        consumer="Mastery Stage Test (stage 4)",
        engines_used=["listen_ko"],
    ),
    ConsumerUsage(
        consumer="Mastery Stage Test (stage 5)",
        engines_used=["ko_type"],
    ),
    ConsumerUsage(
        consumer="Mastery Mixed (adaptive)",
        engines_used=["en_to_ko", "ko_to_en", "emoji", "sentence", "listen_type", "listen_ko", "ko_type"],
    ),
    ConsumerUsage(
        consumer="Mastery Word-only",
        engines_used=["en_to_ko", "ko_to_en", "sentence"],
    ),
    ConsumerUsage(
        consumer="Mastery Listen-only",
        engines_used=["listen_type", "listen_ko"],
    ),
    ConsumerUsage(
        consumer="Listening Engine (legacy)",
        engines_used=["listen_en"],
    ),
]


def generate_report(words: list[Word]) -> FullReport:
    """Generate a complete report analyzing all engines against the given word pool."""
    pool = build_pool(words)
    total = len(words)

    engine_reports: list[EngineReport] = []

    for canonical_name, engine in ENGINES.items():
        meta = _ENGINE_META.get(canonical_name, {})
        eligible = [w for w in words if engine.can_generate(w)]
        eligible_count = len(eligible)
        coverage = (eligible_count / total * 100) if total > 0 else 0.0

        # Sample up to 5 eligible words
        sample = [w.english for w in eligible[:5]]

        engine_reports.append(EngineReport(
            canonical_name=canonical_name,
            korean_name=meta.get("korean_name", ""),
            description=meta.get("description", ""),
            level_test_name=CANONICAL_TO_LEVEL.get(canonical_name, "N/A"),
            mastery_name=CANONICAL_TO_MASTERY.get(canonical_name, "N/A"),
            card_component=meta.get("card", ""),
            answer_direction=meta.get("direction", ""),
            is_typing=canonical_name in ("listen_type", "ko_type", "antonym_type"),
            eligible_count=eligible_count,
            total_words=total,
            coverage_pct=round(coverage, 1),
            sample_words=sample,
        ))

    words_with_example = sum(1 for w in words if w.example_en)
    pool_health = PoolHealthReport(
        total_words=total,
        unique_korean=len(pool.all_korean),
        unique_english=len(pool.all_english),
        words_with_example=words_with_example,
        example_coverage_pct=round(words_with_example / total * 100, 1) if total > 0 else 0.0,
    )

    from app.services.question_engines import LEGACY_NAME_MAP

    return FullReport(
        engine_reports=engine_reports,
        pool_health=pool_health,
        consumer_usages=_CONSUMER_USAGES,
        legacy_mapping=dict(LEGACY_NAME_MAP),
    )


def format_report_text(report: FullReport) -> str:
    """Format the FullReport as a human-readable text string."""
    lines: list[str] = []
    lines.append("=" * 70)
    lines.append("  QUESTION ENGINE SYSTEM REPORT")
    lines.append("=" * 70)

    # Pool Health
    ph = report.pool_health
    lines.append("")
    lines.append(f"  Pool: {ph.total_words} words | "
                 f"{ph.unique_korean} unique KO | "
                 f"{ph.unique_english} unique EN | "
                 f"{ph.words_with_example} with example ({ph.example_coverage_pct}%)")
    lines.append("")

    # Engine Reports
    lines.append("-" * 70)
    lines.append(f"  {'Engine':<14} {'Name':<8} {'Cover':>7} {'Eligible':>9} "
                 f"{'Typing':>7}  {'Direction'}")
    lines.append("-" * 70)

    for er in report.engine_reports:
        typing_mark = "YES" if er.is_typing else ""
        lines.append(
            f"  {er.canonical_name:<14} {er.korean_name:<8} {er.coverage_pct:>6.1f}% "
            f"{er.eligible_count:>8}/{er.total_words}  "
            f"{typing_mark:>5}  {er.answer_direction}"
        )

    # Legacy Mapping
    lines.append("")
    lines.append("-" * 70)
    lines.append("  Legacy Name Mapping")
    lines.append("-" * 70)
    for legacy, canonical in sorted(report.legacy_mapping.items()):
        lines.append(f"    {legacy:<22} -> {canonical}")

    # Consumer Usage
    lines.append("")
    lines.append("-" * 70)
    lines.append("  Consumer Usage Matrix")
    lines.append("-" * 70)
    for cu in report.consumer_usages:
        engines_str = ", ".join(cu.engines_used)
        lines.append(f"    {cu.consumer}")
        lines.append(f"      -> [{engines_str}]")

    lines.append("")
    lines.append("=" * 70)
    return "\n".join(lines)
