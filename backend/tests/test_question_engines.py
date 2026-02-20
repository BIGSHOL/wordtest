"""Unit tests for the modular question engine system."""
import pytest
from unittest.mock import MagicMock

from app.services.question_engines import (
    ENGINES,
    get_engine,
    build_pool,
    resolve_name,
    to_level_name,
    to_mastery_name,
    LEGACY_NAME_MAP,
)
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import (
    pick_korean_distractors,
    pick_english_distractors,
    shuffle_choices,
    is_phrase,
    has_tilde,
)
from app.services.question_engines.sentence import make_sentence_blank, apply_sentence_overlay
from app.services.question_engines.report import generate_report, format_report_text


# ── Helpers ──────────────────────────────────────────────────────────────────

def _make_word(
    english: str = "apple",
    korean: str = "사과",
    level: int = 1,
    lesson: str = "Lesson 01",
    example_en: str | None = "I ate an apple.",
    example_ko: str | None = "나는 사과를 먹었다.",
    word_id: str = "w1",
) -> MagicMock:
    """Create a mock Word object."""
    w = MagicMock()
    w.id = word_id
    w.english = english
    w.korean = korean
    w.level = level
    w.lesson = lesson
    w.example_en = example_en
    w.example_ko = example_ko
    w.book_name = "Power Voca 5000-01"
    w.is_excluded = False
    w.part_of_speech = "n."
    return w


def _make_pool(extra_english: list[str] | None = None, extra_korean: list[str] | None = None) -> DistractorPool:
    """Create a minimal DistractorPool."""
    base_en = ["apple", "banana", "cherry", "date", "elderberry", "fig", "grape"]
    base_ko = ["사과", "바나나", "체리", "대추", "엘더베리", "무화과", "포도"]
    en = list(set(base_en + (extra_english or [])))
    ko = list(set(base_ko + (extra_korean or [])))
    words = [_make_word(e, k, word_id=f"w{i}") for i, (e, k) in enumerate(zip(en, ko))]
    return DistractorPool(all_korean=ko, all_english=en, all_words=words)


# ── Registry Tests ───────────────────────────────────────────────────────────

class TestRegistry:
    def test_all_8_engines_registered(self):
        assert len(ENGINES) == 8
        expected = {"en_to_ko", "ko_to_en", "emoji", "sentence",
                    "listen_en", "listen_ko", "listen_type", "ko_type"}
        assert set(ENGINES.keys()) == expected

    def test_get_engine_canonical(self):
        engine = get_engine("en_to_ko")
        assert engine.question_type == "en_to_ko"

    def test_get_engine_legacy_level(self):
        engine = get_engine("word_meaning")
        assert engine.question_type == "en_to_ko"

    def test_get_engine_legacy_mastery(self):
        engine = get_engine("word_to_meaning")
        assert engine.question_type == "en_to_ko"

    def test_get_engine_unknown_raises(self):
        with pytest.raises(KeyError):
            get_engine("nonexistent_type")

    def test_resolve_name(self):
        assert resolve_name("word_meaning") == "en_to_ko"
        assert resolve_name("listen_and_type") == "listen_type"
        assert resolve_name("en_to_ko") == "en_to_ko"  # already canonical

    def test_to_level_name(self):
        assert to_level_name("en_to_ko") == "word_meaning"
        assert to_level_name("emoji") == "emoji_word"

    def test_to_mastery_name(self):
        assert to_mastery_name("en_to_ko") == "word_to_meaning"
        assert to_mastery_name("listen_type") == "listen_and_type"

    def test_all_legacy_names_resolve(self):
        for legacy, canonical in LEGACY_NAME_MAP.items():
            assert canonical in ENGINES, f"{legacy} -> {canonical} not in ENGINES"


# ── build_pool Tests ─────────────────────────────────────────────────────────

class TestBuildPool:
    def test_builds_from_words(self):
        words = [
            _make_word("apple", "사과", word_id="w1"),
            _make_word("banana", "바나나", word_id="w2"),
            _make_word("apple", "사과", word_id="w3"),  # duplicate
        ]
        pool = build_pool(words)
        assert len(pool.all_words) == 3
        assert "apple" in pool.all_english
        assert "바나나" in pool.all_korean
        # Unique dedup
        assert len(pool.all_english) == 2
        assert len(pool.all_korean) == 2


# ── Distractor Tests ─────────────────────────────────────────────────────────

class TestDistractors:
    def test_pick_korean_distractors(self):
        all_ko = ["사과", "~하다", "바나나", "~먹다", "체리"]
        result = pick_korean_distractors("사과", all_ko, 3)
        assert len(result) == 3
        assert "사과" not in result

    def test_pick_korean_tilde_matching(self):
        all_ko = ["~하다", "~먹다", "~자다", "~가다", "사과"]
        result = pick_korean_distractors("~하다", all_ko, 3)
        assert len(result) == 3
        # Should prefer tilde-prefixed
        tilde_count = sum(1 for r in result if has_tilde(r))
        assert tilde_count >= 2  # at least 2 out of 3 should have tilde

    def test_pick_english_distractors(self):
        all_en = ["apple", "banana", "cherry", "date", "fig"]
        result = pick_english_distractors("apple", all_en, 3)
        assert len(result) == 3
        assert "apple" not in result

    def test_pick_english_phrase_matching(self):
        all_en = ["take care of", "look up", "give up", "apple", "banana"]
        result = pick_english_distractors("take care of", all_en, 2)
        assert len(result) == 2
        assert "take care of" not in result

    def test_shuffle_choices(self):
        result = shuffle_choices("A", ["B", "C", "D"])
        assert set(result) == {"A", "B", "C", "D"}
        assert len(result) == 4

    def test_is_phrase(self):
        assert is_phrase("take care of") is True
        assert is_phrase("apple") is False

    def test_has_tilde(self):
        assert has_tilde("~하다") is True
        assert has_tilde("사과") is False


# ── Individual Engine Tests ──────────────────────────────────────────────────

class TestEnToKoEngine:
    def test_can_generate(self):
        engine = get_engine("en_to_ko")
        assert engine.can_generate(_make_word(korean="사과"))
        assert not engine.can_generate(_make_word(korean=""))

    def test_generate(self):
        engine = get_engine("en_to_ko")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "en_to_ko"
        assert spec.correct_answer == "사과"
        assert spec.choices is not None
        assert "사과" in spec.choices
        assert spec.is_typing is False


class TestKoToEnEngine:
    def test_can_generate(self):
        engine = get_engine("ko_to_en")
        assert engine.can_generate(_make_word(korean="사과"))

    def test_generate(self):
        engine = get_engine("ko_to_en")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "ko_to_en"
        assert spec.correct_answer == "apple"
        assert "apple" in spec.choices


class TestEmojiEngine:
    def test_can_generate_with_emoji(self):
        engine = get_engine("emoji")
        # "dog" has emoji in EMOJI_MAP
        assert engine.can_generate(_make_word(english="dog"))

    def test_can_generate_without_emoji(self):
        engine = get_engine("emoji")
        assert not engine.can_generate(_make_word(english="phenomenon"))

    def test_generate(self):
        engine = get_engine("emoji")
        pool = _make_pool(extra_english=["dog", "cat", "bird", "fish"])
        word = _make_word(english="dog", korean="개")
        spec = engine.generate(word, pool)
        assert spec.question_type == "emoji"
        assert spec.correct_answer == "dog"
        assert spec.emoji is not None


class TestSentenceEngine:
    def test_can_generate_with_example(self):
        engine = get_engine("sentence")
        word = _make_word(example_en="I ate an apple.")
        assert engine.can_generate(word)

    def test_can_generate_without_example(self):
        engine = get_engine("sentence")
        word = _make_word(example_en=None)
        assert not engine.can_generate(word)

    def test_generate(self):
        engine = get_engine("sentence")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "sentence"
        assert spec.context_mode == "sentence"
        assert spec.sentence_blank is not None
        assert "____" in spec.sentence_blank
        assert spec.correct_answer == "apple"

    def test_make_sentence_blank(self):
        result = make_sentence_blank("The dog runs fast.", "dog")
        assert result == "The ____ runs fast."

    def test_make_sentence_blank_inflected(self):
        result = make_sentence_blank("She played happily.", "play")
        assert result is not None
        assert "____" in result

    def test_make_sentence_blank_not_found(self):
        result = make_sentence_blank("The cat sleeps.", "zzz")
        assert result is None


class TestListenEnEngine:
    def test_can_generate(self):
        engine = get_engine("listen_en")
        assert engine.can_generate(_make_word())

    def test_generate(self):
        engine = get_engine("listen_en")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "listen_en"
        assert spec.correct_answer == "apple"
        assert spec.choices is not None
        assert spec.is_typing is False


class TestListenKoEngine:
    def test_can_generate(self):
        engine = get_engine("listen_ko")
        assert engine.can_generate(_make_word(korean="사과"))

    def test_generate(self):
        engine = get_engine("listen_ko")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "listen_ko"
        assert spec.correct_answer == "사과"
        assert spec.choices is not None


class TestListenTypeEngine:
    def test_can_generate(self):
        engine = get_engine("listen_type")
        assert engine.can_generate(_make_word())

    def test_generate(self):
        engine = get_engine("listen_type")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "listen_type"
        assert spec.correct_answer == "apple"
        assert spec.choices is None
        assert spec.is_typing is True


class TestKoTypeEngine:
    def test_can_generate(self):
        engine = get_engine("ko_type")
        assert engine.can_generate(_make_word(korean="사과"))

    def test_generate(self):
        engine = get_engine("ko_type")
        pool = _make_pool()
        word = _make_word()
        spec = engine.generate(word, pool)
        assert spec.question_type == "ko_type"
        assert spec.correct_answer == "apple"
        assert spec.choices is None
        assert spec.is_typing is True


# ── Sentence Overlay Tests ───────────────────────────────────────────────────

class TestSentenceOverlay:
    def test_apply_overlay_success(self):
        pool = _make_pool()
        word = _make_word(example_en="I ate an apple.")
        engine = get_engine("en_to_ko")
        spec = engine.generate(word, pool)
        overlaid = apply_sentence_overlay(spec)
        assert overlaid is not None
        assert overlaid.context_mode == "sentence"
        assert "____" in overlaid.sentence_blank

    def test_apply_overlay_no_example(self):
        pool = _make_pool()
        word = _make_word(example_en=None)
        engine = get_engine("en_to_ko")
        spec = engine.generate(word, pool)
        overlaid = apply_sentence_overlay(spec)
        assert overlaid is None


# ── Report Engine Tests ──────────────────────────────────────────────────────

class TestReportEngine:
    def test_generate_report(self):
        words = [
            _make_word("dog", "개", word_id="w1"),
            _make_word("cat", "고양이", word_id="w2"),
            _make_word("apple", "사과", word_id="w3"),
            _make_word("banana", "바나나", word_id="w4", example_en=None),
        ]
        report = generate_report(words)

        assert len(report.engine_reports) == 8
        assert report.pool_health.total_words == 4

        # en_to_ko should cover all 4 (all have korean)
        en_to_ko_report = next(r for r in report.engine_reports if r.canonical_name == "en_to_ko")
        assert en_to_ko_report.eligible_count == 4
        assert en_to_ko_report.coverage_pct == 100.0

        # emoji should cover dog, cat (in EMOJI_MAP)
        emoji_report = next(r for r in report.engine_reports if r.canonical_name == "emoji")
        assert emoji_report.eligible_count >= 2  # dog, cat at least

        # sentence should not cover banana (no example_en)
        sentence_report = next(r for r in report.engine_reports if r.canonical_name == "sentence")
        assert sentence_report.eligible_count <= 3

    def test_format_report_text(self):
        words = [_make_word("dog", "개", word_id="w1")]
        report = generate_report(words)
        text = format_report_text(report)
        assert "QUESTION ENGINE SYSTEM REPORT" in text
        assert "en_to_ko" in text
        assert "Legacy Name Mapping" in text
        assert "Consumer Usage Matrix" in text
