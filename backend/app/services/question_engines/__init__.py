"""Question Engine Registry - modular question generation system.

Usage:
    from app.services.question_engines import get_engine, build_pool, ENGINES

    pool = build_pool(all_words)
    engine = get_engine("en_to_ko")
    if engine.can_generate(word):
        spec = engine.generate(word, pool)
"""
from app.services.question_engines.base import QuestionSpec, DistractorPool, QuestionEngine
from app.services.question_engines.en_to_ko import EnToKoEngine
from app.services.question_engines.ko_to_en import KoToEnEngine
from app.services.question_engines.emoji import EmojiEngine
from app.services.question_engines.sentence import SentenceEngine, apply_sentence_overlay, make_sentence_blank
from app.services.question_engines.listen_en import ListenEnEngine
from app.services.question_engines.listen_ko import ListenKoEngine
from app.services.question_engines.listen_type import ListenTypeEngine
from app.services.question_engines.ko_type import KoTypeEngine
from app.services.question_engines.antonym_type import AntonymTypeEngine
from app.services.question_engines.antonym_choice import AntonymChoiceEngine
from app.services.question_engines.sentence_type import SentenceTypeEngine
from app.services.question_engines.distractors import (
    pick_korean_distractors,
    pick_english_distractors,
    shuffle_choices,
)

from app.models.word import Word


# ── Engine instances ─────────────────────────────────────────────────────────

ENGINES: dict[str, QuestionEngine] = {
    "en_to_ko": EnToKoEngine(),
    "ko_to_en": KoToEnEngine(),
    "emoji": EmojiEngine(),
    "sentence": SentenceEngine(),
    "listen_en": ListenEnEngine(),
    "listen_ko": ListenKoEngine(),
    "listen_type": ListenTypeEngine(),
    "ko_type": KoTypeEngine(),
    "antonym_type": AntonymTypeEngine(),
    "antonym_choice": AntonymChoiceEngine(),
    "sentence_type": SentenceTypeEngine(),
}


# ── Legacy Name Mapping ─────────────────────────────────────────────────────
# Maps old question type names → canonical engine names.

LEGACY_NAME_MAP: dict[str, str] = {
    # Level test legacy → canonical
    "word_meaning": "en_to_ko",
    "meaning_word": "ko_to_en",
    "emoji_word": "emoji",
    "sentence_blank": "sentence",
    "listening": "listen_en",
    # Mastery legacy → canonical
    "word_to_meaning": "en_to_ko",
    "meaning_to_word": "ko_to_en",
    "emoji_to_word": "emoji",
    "listen_and_type": "listen_type",
    "listen_to_meaning": "listen_ko",
    "meaning_and_type": "ko_type",
    "antonym_and_type": "antonym_type",
    "antonym_and_choice": "antonym_choice",
    "sentence_and_type": "sentence_type",
}

# Canonical → legacy names (for API response backward compatibility)
CANONICAL_TO_LEVEL: dict[str, str] = {
    "en_to_ko": "word_meaning",
    "ko_to_en": "meaning_word",
    "emoji": "emoji_word",
    "sentence": "sentence_blank",
    "listen_en": "listening",
    "listen_ko": "listening",      # no direct level-test equivalent
    "listen_type": "listening",    # no direct level-test equivalent
    "ko_type": "meaning_word",     # no direct level-test equivalent
    "antonym_type": "word_meaning",     # no direct level-test equivalent
    "antonym_choice": "word_meaning",   # no direct level-test equivalent
    "sentence_type": "sentence_blank",   # no direct level-test equivalent
}

CANONICAL_TO_MASTERY: dict[str, str] = {
    "en_to_ko": "word_to_meaning",
    "ko_to_en": "meaning_to_word",
    "emoji": "emoji_to_word",
    "sentence": "meaning_to_word",  # sentence is an overlay, base = ko_to_en
    "listen_en": "listen_to_meaning",
    "listen_ko": "listen_to_meaning",
    "listen_type": "listen_and_type",
    "ko_type": "meaning_and_type",
    "antonym_type": "antonym_and_type",
    "antonym_choice": "antonym_and_choice",
    "sentence_type": "sentence_and_type",
}


def resolve_name(name: str) -> str:
    """Resolve a legacy or canonical name to canonical engine name."""
    return LEGACY_NAME_MAP.get(name, name)


def get_engine(name: str) -> QuestionEngine:
    """Get engine by canonical or legacy name. Raises KeyError if not found."""
    canonical = resolve_name(name)
    if canonical not in ENGINES:
        raise KeyError(f"Unknown question engine: {name!r} (resolved: {canonical!r})")
    return ENGINES[canonical]


def compute_compatible_engines(word: Word) -> list[str]:
    """Return list of canonical engine names compatible with the given word."""
    return [name for name, engine in ENGINES.items() if engine.can_generate(word)]


def build_pool(all_words: list[Word]) -> DistractorPool:
    """Build a DistractorPool from a list of words."""
    return DistractorPool(
        all_korean=list({w.korean for w in all_words if w.korean}),
        all_english=list({w.english for w in all_words}),
        all_words=all_words,
    )


def to_level_name(canonical: str) -> str:
    """Convert canonical engine name to level test API name."""
    return CANONICAL_TO_LEVEL.get(canonical, canonical)


def to_mastery_name(canonical: str) -> str:
    """Convert canonical engine name to mastery API name."""
    return CANONICAL_TO_MASTERY.get(canonical, canonical)


__all__ = [
    "ENGINES",
    "LEGACY_NAME_MAP",
    "CANONICAL_TO_LEVEL",
    "CANONICAL_TO_MASTERY",
    "QuestionSpec",
    "DistractorPool",
    "QuestionEngine",
    "get_engine",
    "compute_compatible_engines",
    "build_pool",
    "resolve_name",
    "to_level_name",
    "to_mastery_name",
    "apply_sentence_overlay",
    "make_sentence_blank",
    "pick_korean_distractors",
    "pick_english_distractors",
    "shuffle_choices",
]
