"""Unit tests for the question engine registry and all 10 engines.

Tests:
- TestEngineRegistry: registry, get_engine, resolve_name, compute_compatible_engines
- TestDistractors: pick_korean/english_distractors, shuffle_choices, build_pool
- TestEnToKo: can_generate, generate
- TestKoToEn: can_generate, generate
- TestEmoji: can_generate, generate
- TestSentence: can_generate, generate, make_sentence_blank
- TestListenEngines: listen_en, listen_ko, listen_type, ko_type
- TestAntonymEngines: antonym_type, antonym_choice
"""
import pytest
from unittest.mock import MagicMock

from app.services.question_engines import (
    ENGINES,
    get_engine,
    resolve_name,
    build_pool,
    compute_compatible_engines,
)
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import (
    pick_korean_distractors,
    pick_english_distractors,
    shuffle_choices,
)
from app.services.question_engines.sentence import make_sentence_blank, apply_sentence_overlay


# ── Fixtures ────────────────────────────────────────────────────────────────


def make_example(example_en: str, example_ko: str, order_index: int = 0):
    """Create a mock WordExample object for testing."""
    ex = MagicMock()
    ex.example_en = example_en
    ex.example_ko = example_ko
    ex.order_index = order_index
    return ex


def make_word(english: str, korean: str | None = None, example_en: str | None = None, examples: list | None = None):
    """Create a mock Word object for testing."""
    word = MagicMock()
    word.english = english
    word.korean = korean
    word.example_en = example_en
    word.examples = examples or []
    return word


@pytest.fixture
def sample_words():
    """Create a sample word list for distractor pool testing."""
    return [
        make_word("dog", "개"),
        make_word("cat", "고양이"),
        make_word("bird", "새"),
        make_word("fish", "물고기"),
        make_word("run", "달리다"),
        make_word("swim", "수영하다"),
        make_word("jump", "점프하다"),
        make_word("walk", "걷다"),
        make_word("apple", "사과"),
        make_word("banana", "바나나"),
    ]


@pytest.fixture
def sample_pool(sample_words):
    """Create a DistractorPool from sample words."""
    return build_pool(sample_words)


# ══════════════════════════════════════════════════════════════════════════
# TestEngineRegistry
# ══════════════════════════════════════════════════════════════════════════


class TestEngineRegistry:
    """Tests for engine registry, get_engine, resolve_name, compute_compatible_engines."""

    def test_all_10_registered(self):
        """ENGINES dict should contain exactly 10 engines."""
        assert len(ENGINES) == 10
        expected = {
            "en_to_ko",
            "ko_to_en",
            "emoji",
            "sentence",
            "listen_en",
            "listen_ko",
            "listen_type",
            "ko_type",
            "antonym_type",
            "antonym_choice",
        }
        assert set(ENGINES.keys()) == expected

    def test_get_engine_canonical(self):
        """get_engine should work with canonical names."""
        engine = get_engine("en_to_ko")
        assert engine is not None
        assert engine.question_type == "en_to_ko"

    def test_get_engine_legacy(self):
        """get_engine should work with legacy names via resolve_name."""
        engine = get_engine("word_meaning")  # legacy → en_to_ko
        assert engine is not None
        assert engine.question_type == "en_to_ko"

    def test_get_engine_unknown(self):
        """get_engine should raise KeyError for unknown engine names."""
        with pytest.raises(KeyError, match="Unknown question engine"):
            get_engine("bad_engine_name")

    def test_resolve_name(self):
        """resolve_name should map legacy names to canonical names."""
        # Legacy → canonical
        assert resolve_name("word_meaning") == "en_to_ko"
        assert resolve_name("meaning_word") == "ko_to_en"
        assert resolve_name("emoji_word") == "emoji"
        assert resolve_name("sentence_blank") == "sentence"
        assert resolve_name("listening") == "listen_en"
        assert resolve_name("word_to_meaning") == "en_to_ko"
        assert resolve_name("meaning_to_word") == "ko_to_en"
        assert resolve_name("listen_and_type") == "listen_type"
        assert resolve_name("listen_to_meaning") == "listen_ko"
        assert resolve_name("meaning_and_type") == "ko_type"
        assert resolve_name("antonym_and_type") == "antonym_type"
        assert resolve_name("antonym_and_choice") == "antonym_choice"

        # Canonical → canonical (passthrough)
        assert resolve_name("en_to_ko") == "en_to_ko"
        assert resolve_name("listen_ko") == "listen_ko"

    def test_compute_compatible_engines(self):
        """compute_compatible_engines should return list of compatible engine names."""
        # Word with korean + example_en → should support most engines
        word = make_word("dog", "개", "I have a dog.")
        compatible = compute_compatible_engines(word)
        assert isinstance(compatible, list)
        assert "en_to_ko" in compatible  # has korean
        assert "ko_to_en" in compatible  # has korean
        assert "emoji" in compatible  # dog has emoji
        assert "sentence" in compatible  # has example_en
        assert "listen_en" in compatible  # always compatible
        assert "listen_ko" in compatible  # has korean
        assert "listen_type" in compatible  # always compatible
        assert "ko_type" in compatible  # has korean

        # Word without korean → fewer engines
        word_no_korean = make_word("philosophy", None, None)
        compatible_no_korean = compute_compatible_engines(word_no_korean)
        assert "en_to_ko" not in compatible_no_korean
        assert "ko_to_en" not in compatible_no_korean
        assert "emoji" not in compatible_no_korean  # philosophy has no emoji
        assert "sentence" not in compatible_no_korean  # no example
        assert "listen_en" in compatible_no_korean  # always compatible
        assert "listen_type" in compatible_no_korean  # always compatible


# ══════════════════════════════════════════════════════════════════════════
# TestDistractors
# ══════════════════════════════════════════════════════════════════════════


class TestDistractors:
    """Tests for distractor generation utilities."""

    def test_pick_korean_3(self):
        """pick_korean_distractors should return exactly 3 distractors."""
        all_korean = ["개", "고양이", "새", "물고기", "달리다"]
        correct = "개"
        distractors = pick_korean_distractors(correct, all_korean, count=3)
        assert len(distractors) == 3
        assert all(d in all_korean for d in distractors)

    def test_pick_korean_excludes_correct(self):
        """pick_korean_distractors should not include the correct answer."""
        all_korean = ["개", "고양이", "새", "물고기", "달리다"]
        correct = "개"
        distractors = pick_korean_distractors(correct, all_korean, count=3)
        assert correct not in distractors

    def test_pick_english_3(self):
        """pick_english_distractors should return exactly 3 distractors."""
        all_english = ["dog", "cat", "bird", "fish", "run"]
        correct = "dog"
        distractors = pick_english_distractors(correct, all_english, count=3)
        assert len(distractors) == 3
        assert all(d in all_english for d in distractors)

    def test_shuffle_all_present(self):
        """shuffle_choices should contain correct + all distractors."""
        correct = "dog"
        distractors = ["cat", "bird", "fish"]
        choices = shuffle_choices(correct, distractors)
        assert len(choices) == 4
        assert correct in choices
        assert all(d in choices for d in distractors)

    def test_build_pool(self):
        """build_pool should create valid DistractorPool."""
        words = [
            make_word("dog", "개"),
            make_word("cat", "고양이"),
            make_word("bird", "새"),
        ]
        pool = build_pool(words)
        assert isinstance(pool, DistractorPool)
        assert "dog" in pool.all_english
        assert "cat" in pool.all_english
        assert "bird" in pool.all_english
        assert "개" in pool.all_korean
        assert "고양이" in pool.all_korean
        assert "새" in pool.all_korean
        assert len(pool.all_words) == 3


# ══════════════════════════════════════════════════════════════════════════
# TestEnToKo
# ══════════════════════════════════════════════════════════════════════════


class TestEnToKo:
    """Tests for en_to_ko (영한) engine."""

    def test_can_generate_true_with_korean(self):
        """can_generate should return True if word has korean."""
        engine = get_engine("en_to_ko")
        word = make_word("dog", "개")
        assert engine.can_generate(word) is True

    def test_can_generate_false_without_korean(self):
        """can_generate should return False if word has no korean."""
        engine = get_engine("en_to_ko")
        word = make_word("dog", None)
        assert engine.can_generate(word) is False

    def test_generate(self, sample_pool):
        """generate should return QuestionSpec with 4 choices, correct=korean."""
        engine = get_engine("en_to_ko")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "en_to_ko"
        assert spec.word is word
        assert spec.correct_answer == "개"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "개" in spec.choices
        assert spec.is_typing is False


# ══════════════════════════════════════════════════════════════════════════
# TestKoToEn
# ══════════════════════════════════════════════════════════════════════════


class TestKoToEn:
    """Tests for ko_to_en (한영) engine."""

    def test_can_generate_true_with_korean(self):
        """can_generate should return True if word has korean."""
        engine = get_engine("ko_to_en")
        word = make_word("dog", "개")
        assert engine.can_generate(word) is True

    def test_can_generate_false_without_korean(self):
        """can_generate should return False if word has no korean."""
        engine = get_engine("ko_to_en")
        word = make_word("dog", None)
        assert engine.can_generate(word) is False

    def test_generate(self, sample_pool):
        """generate should return QuestionSpec with 4 choices, correct=english."""
        engine = get_engine("ko_to_en")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "ko_to_en"
        assert spec.word is word
        assert spec.correct_answer == "dog"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "dog" in spec.choices
        assert spec.is_typing is False


# ══════════════════════════════════════════════════════════════════════════
# TestEmoji
# ══════════════════════════════════════════════════════════════════════════


class TestEmoji:
    """Tests for emoji engine."""

    def test_can_generate_mapped_word(self):
        """can_generate should return True for words with emoji mappings."""
        engine = get_engine("emoji")
        word = make_word("dog", "개")  # dog has emoji 🐕
        assert engine.can_generate(word) is True

    def test_can_generate_unmapped_word(self):
        """can_generate should return False for words without emoji mappings."""
        engine = get_engine("emoji")
        word = make_word("philosophy", "철학")  # no emoji
        assert engine.can_generate(word) is False

    def test_generate(self, sample_pool):
        """generate should return QuestionSpec with emoji and 4 choices."""
        engine = get_engine("emoji")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "emoji"
        assert spec.word is word
        assert spec.correct_answer == "dog"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "dog" in spec.choices
        assert spec.emoji == "🐕"
        assert spec.is_typing is False


# ══════════════════════════════════════════════════════════════════════════
# TestSentence
# ══════════════════════════════════════════════════════════════════════════


class TestSentence:
    """Tests for sentence engine."""

    def test_can_generate_with_example(self):
        """can_generate should return True if word has example_en and word is in sentence."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", "I have a dog.")
        assert engine.can_generate(word) is True

    def test_can_generate_without_example(self):
        """can_generate should return False if word has no example_en."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", None)
        assert engine.can_generate(word) is False

    def test_can_generate_word_not_in_sentence(self):
        """can_generate should return False if word is not found in sentence."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", "I have a cat.")  # dog not in sentence
        assert engine.can_generate(word) is False

    def test_make_sentence_blank(self):
        """make_sentence_blank should replace target word with ____."""
        sentence = "I have a dog."
        target = "dog"
        blank = make_sentence_blank(sentence, target)
        assert blank == "I have a ____."

    def test_make_sentence_blank_inflected(self):
        """make_sentence_blank should handle inflected forms (jumped, walked, etc)."""
        sentence = "He jumped over the fence."
        target = "jump"
        blank = make_sentence_blank(sentence, target)
        assert blank == "He ____ over the fence."

    def test_generate(self, sample_pool):
        """generate should return QuestionSpec with sentence_blank and 4 choices."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", "I have a dog.")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "sentence"
        assert spec.word is word
        assert spec.correct_answer == "dog"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "dog" in spec.choices
        assert spec.context_mode == "sentence"
        assert spec.sentence_blank == "I have a ____."
        assert spec.is_typing is False

    def test_apply_sentence_overlay(self):
        """apply_sentence_overlay should convert QuestionSpec to sentence mode."""
        # Create base spec (ko_to_en)
        word = make_word("dog", "개", "I have a dog.")
        base_spec = QuestionSpec(
            question_type="ko_to_en",
            word=word,
            correct_answer="dog",
            choices=["dog", "cat", "bird", "fish"],
        )

        # Apply overlay
        sentence_spec = apply_sentence_overlay(base_spec)

        assert sentence_spec is not None
        assert sentence_spec.question_type == "ko_to_en"  # type unchanged
        assert sentence_spec.context_mode == "sentence"
        assert sentence_spec.sentence_blank == "I have a ____."
        assert sentence_spec.choices == ["dog", "cat", "bird", "fish"]
        assert sentence_spec.correct_answer == "dog"

    def test_can_generate_with_examples_list(self):
        """can_generate should return True if word has examples list with usable sentence."""
        engine = get_engine("sentence")
        examples = [
            make_example("My dog is friendly.", "내 개는 친근하다.", 0),
            make_example("The dog barked loudly.", "그 개가 크게 짖었다.", 1),
        ]
        word = make_word("dog", "개", None, examples=examples)
        assert engine.can_generate(word) is True

    def test_can_generate_fallback_to_legacy(self):
        """can_generate should fallback to example_en when examples list is empty."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", "I have a dog.", examples=[])
        assert engine.can_generate(word) is True

    def test_can_generate_false_no_examples_anywhere(self):
        """can_generate should return False when no examples available at all."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", None, examples=[])
        assert engine.can_generate(word) is False

    def test_generate_picks_from_examples(self, sample_pool):
        """generate should use word.examples when available."""
        engine = get_engine("sentence")
        examples = [
            make_example("My dog is friendly.", "내 개는 친근하다.", 0),
            make_example("The dog barked loudly.", "그 개가 크게 짖었다.", 1),
        ]
        word = make_word("dog", "개", "I have a dog.", examples=examples)
        spec = engine.generate(word, sample_pool)

        assert spec.sentence_blank is not None
        assert "____" in spec.sentence_blank
        # sentence_en should be one of the examples
        valid_sentences = {"My dog is friendly.", "The dog barked loudly.", "I have a dog."}
        assert spec.sentence_en in valid_sentences

    def test_generate_fallback_legacy_columns(self, sample_pool):
        """generate should use legacy example_en/ko when examples list is empty."""
        engine = get_engine("sentence")
        word = make_word("dog", "개", "I have a dog.", examples=[])
        spec = engine.generate(word, sample_pool)

        assert spec.sentence_blank == "I have a ____."
        assert spec.sentence_en == "I have a dog."

    # ── New: phrasal verb / idiom matching ──────────────────────────────

    def test_blank_phrasal_verb(self):
        """Phrasal verb with ~ should blank the first content word."""
        assert make_sentence_blank(
            "She took part in the competition.", "take part in ~"
        ) == "She ____ part in the competition."

    def test_blank_be_pattern(self):
        """be-verb pattern should match inflected 'is/was/are'."""
        assert make_sentence_blank(
            "He is good at math.", "be good at ~"
        ) == "He ____ good at math."

    def test_blank_possessive(self):
        """one's should match possessive pronouns like her/his/my."""
        assert make_sentence_blank(
            "She held her breath.", "hold one's breath"
        ) == "She ____ her breath."

    def test_blank_reflexive(self):
        """oneself should match reflexive pronouns like himself."""
        assert make_sentence_blank(
            "He enjoyed himself at the party.", "enjoy oneself"
        ) == "He ____ himself at the party."

    def test_blank_abbreviation(self):
        """Abbreviations with dots should be matched."""
        assert make_sentence_blank(
            "The store opens at 9 a.m.", "a.m."
        ) == "The store opens at 9 ____."

    def test_blank_irregular_verb(self):
        """Irregular past tense should be blanked via _IRREGULAR table."""
        assert make_sentence_blank(
            "She went to school yesterday.", "go to ~"
        ) == "She ____ to school yesterday."

    def test_blank_preposition_tilde(self):
        """Preposition + ~ should match after cleaning."""
        assert make_sentence_blank(
            "The cat is below the table.", "below ~"
        ) == "The cat is ____ the table."

    def test_can_generate_phrasal_verb(self, sample_pool):
        """can_generate should work for phrasal verb entries."""
        engine = get_engine("sentence")
        word = make_word(
            "take part in ~", "참가하다",
            "She took part in the competition.",
        )
        assert engine.can_generate(word) is True


# ══════════════════════════════════════════════════════════════════════════
# TestListenEngines
# ══════════════════════════════════════════════════════════════════════════


class TestListenEngines:
    """Tests for listening engines (listen_en, listen_ko, listen_type, ko_type)."""

    def test_listen_en_generate(self, sample_pool):
        """listen_en should generate 4 English choices."""
        engine = get_engine("listen_en")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "listen_en"
        assert spec.word is word
        assert spec.correct_answer == "dog"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "dog" in spec.choices
        assert spec.is_typing is False

    def test_listen_ko_generate(self, sample_pool):
        """listen_ko should generate 4 Korean choices."""
        engine = get_engine("listen_ko")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "listen_ko"
        assert spec.word is word
        assert spec.correct_answer == "개"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "개" in spec.choices
        assert spec.is_typing is False

    def test_listen_type_generate(self, sample_pool):
        """listen_type should have is_typing=True and no choices."""
        engine = get_engine("listen_type")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "listen_type"
        assert spec.word is word
        assert spec.correct_answer == "dog"
        assert spec.choices is None
        assert spec.is_typing is True

    def test_ko_type_generate(self, sample_pool):
        """ko_type should have is_typing=True and no choices."""
        engine = get_engine("ko_type")
        word = make_word("dog", "개")
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "ko_type"
        assert spec.word is word
        assert spec.correct_answer == "dog"
        assert spec.choices is None
        assert spec.is_typing is True


# ══════════════════════════════════════════════════════════════════════════
# TestAntonymEngines
# ══════════════════════════════════════════════════════════════════════════


class TestAntonymEngines:
    """Tests for antonym_type and antonym_choice engines."""

    def test_antonym_type_can_generate_with_antonym(self):
        """antonym_type can_generate should return True if word has antonym."""
        engine = get_engine("antonym_type")
        word = make_word("hot", "뜨거운")
        word.antonym = "cold"
        assert engine.can_generate(word) is True

    def test_antonym_type_can_generate_without_antonym(self):
        """antonym_type can_generate should return False if word has no antonym."""
        engine = get_engine("antonym_type")
        word = make_word("dog", "개")
        word.antonym = None
        assert engine.can_generate(word) is False

    def test_antonym_type_generate(self, sample_pool):
        """antonym_type should have is_typing=True, correct_answer=antonym, hint."""
        engine = get_engine("antonym_type")
        word = make_word("hot", "뜨거운")
        word.antonym = "cold"
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "antonym_type"
        assert spec.word is word
        assert spec.correct_answer == "cold"
        assert spec.choices is None
        assert spec.is_typing is True
        assert spec.hint == "c___"

    def test_antonym_choice_can_generate_with_antonym(self):
        """antonym_choice can_generate should return True if word has antonym."""
        engine = get_engine("antonym_choice")
        word = make_word("hot", "뜨거운")
        word.antonym = "cold"
        assert engine.can_generate(word) is True

    def test_antonym_choice_can_generate_without_antonym(self):
        """antonym_choice can_generate should return False if word has no antonym."""
        engine = get_engine("antonym_choice")
        word = make_word("dog", "개")
        word.antonym = None
        assert engine.can_generate(word) is False

    def test_antonym_choice_generate(self, sample_pool):
        """antonym_choice should have 4 choices with correct_answer=antonym."""
        engine = get_engine("antonym_choice")
        word = make_word("hot", "뜨거운")
        word.antonym = "cold"
        spec = engine.generate(word, sample_pool)

        assert isinstance(spec, QuestionSpec)
        assert spec.question_type == "antonym_choice"
        assert spec.word is word
        assert spec.correct_answer == "cold"
        assert spec.choices is not None
        assert len(spec.choices) == 4
        assert "cold" in spec.choices
        assert spec.is_typing is False
