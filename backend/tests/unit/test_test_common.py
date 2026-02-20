"""Unit tests for pure functions in app/services/test_common.py."""
import pytest
from unittest.mock import MagicMock

from app.services.test_common import (
    format_rank_label,
    RANK_NAMES,
    is_likely_loanword,
    filter_loanwords,
    check_typing_answer,
    first_korean_meaning,
    dedup_words,
    determine_correct_answer,
    is_typing_question,
    edit_distance,
)


# ── Test Rank System ─────────────────────────────────────────────────────────


class TestRankSystem:
    """Test rank formatting and naming system."""

    def test_format_rank_label_basic(self):
        """Test basic rank label formatting."""
        result = format_rank_label(1, 3)
        assert result == "Iron 1-3"

    def test_format_rank_label_max(self):
        """Test rank label with MAX indicator."""
        result = format_rank_label(1, 5, 5)
        assert result == "Iron 1-MAX"

    def test_rank_names_complete(self):
        """Test that all 15 ranks have entries in RANK_NAMES."""
        for rank in range(1, 16):
            assert rank in RANK_NAMES, f"Rank {rank} missing from RANK_NAMES"
            assert isinstance(RANK_NAMES[rank], str)
            assert len(RANK_NAMES[rank]) > 0


# ── Test Loanword Detection ──────────────────────────────────────────────────


class TestLoanwordDetection:
    """Test loanword detection using consonant skeleton matching."""

    def test_loanword_camera(self):
        """Test that 'camera/카메라' is detected as loanword."""
        assert is_likely_loanword("camera", "카메라") is True

    def test_not_loanword_happy(self):
        """Test that 'happy/행복한' is not detected as loanword."""
        assert is_likely_loanword("happy", "행복한") is False

    def test_not_loanword_hada_suffix(self):
        """Test that words ending in 하다 are not detected as loanword."""
        assert is_likely_loanword("study", "공부하다") is False

    def test_not_loanword_short(self):
        """Test that single syllable Korean words are not detected as loanword."""
        assert is_likely_loanword("go", "가") is False

    def test_not_loanword_empty(self):
        """Test that empty strings are not detected as loanword."""
        assert is_likely_loanword("", "") is False
        assert is_likely_loanword("test", "") is False
        assert is_likely_loanword("", "테스트") is False

    def test_filter_loanwords(self):
        """Test that filter_loanwords removes loanword pairs from list."""
        word_loanword = MagicMock()
        word_loanword.english = "camera"
        word_loanword.korean = "카메라"

        word_native = MagicMock()
        word_native.english = "happy"
        word_native.korean = "행복한"

        words = [word_loanword, word_native]
        result = filter_loanwords(words)

        assert len(result) == 1
        assert result[0] == word_native


# ── Test Typing Answer Check ─────────────────────────────────────────────────


class TestTypingAnswerCheck:
    """Test typing answer validation with edit distance."""

    def test_exact_match(self):
        """Test exact match returns (True, False)."""
        is_correct, is_almost = check_typing_answer("hello", "hello")
        assert is_correct is True
        assert is_almost is False

    def test_case_insensitive(self):
        """Test case insensitive matching."""
        is_correct, is_almost = check_typing_answer("Hello", "hello")
        assert is_correct is True
        assert is_almost is False

    def test_almost_correct(self):
        """Test that single character error for word >= 3 chars returns (False, True)."""
        is_correct, is_almost = check_typing_answer("helo", "hello")
        assert is_correct is False
        assert is_almost is True

    def test_wrong(self):
        """Test that completely different answer returns (False, False)."""
        is_correct, is_almost = check_typing_answer("world", "hello")
        assert is_correct is False
        assert is_almost is False

    def test_short_no_almost(self):
        """Test that short words (< 3 chars) with 1 char error don't get 'almost'."""
        is_correct, is_almost = check_typing_answer("ab", "ac")
        assert is_correct is False
        assert is_almost is False


# ── Test Deduplication ───────────────────────────────────────────────────────


class TestDeduplication:
    """Test word deduplication by Korean meaning and English."""

    def test_first_korean_meaning(self):
        """Test extraction of first Korean meaning."""
        result = first_korean_meaning("사과, 과일")
        assert result == "사과"

    def test_first_korean_meaning_with_parentheses(self):
        """Test that parentheses are removed."""
        result = first_korean_meaning("사과(과일)")
        assert result == "사과"

    def test_first_korean_meaning_with_tilde(self):
        """Test that tildes are removed."""
        result = first_korean_meaning("~사과")
        assert result == "사과"

    def test_dedup_english(self):
        """Test that words with same English are deduplicated."""
        word1 = MagicMock()
        word1.english = "apple"
        word1.korean = "사과"

        word2 = MagicMock()
        word2.english = "Apple"  # Different case
        word2.korean = "과일"

        words = [word1, word2]
        result = dedup_words(words)

        # Only first occurrence should remain
        assert len(result) == 1
        assert result[0] == word1

    def test_dedup_korean(self):
        """Test that words with same first Korean meaning are deduplicated."""
        word1 = MagicMock()
        word1.english = "apple"
        word1.korean = "사과"

        word2 = MagicMock()
        word2.english = "apology"
        word2.korean = "사과, 사죄"  # Same first meaning

        words = [word1, word2]
        result = dedup_words(words)

        # Only first occurrence should remain
        assert len(result) == 1
        assert result[0] == word1


# ── Test Question Type Helpers ───────────────────────────────────────────────


class TestQuestionTypeHelpers:
    """Test helper functions for question type handling."""

    def test_correct_answer_en_to_ko(self):
        """Test that determine_correct_answer returns Korean for en_to_ko."""
        word = MagicMock()
        word.english = "hello"
        word.korean = "안녕"

        result = determine_correct_answer(word, "en_to_ko")
        assert result == "안녕"

    def test_correct_answer_ko_to_en(self):
        """Test that determine_correct_answer returns English for ko_to_en."""
        word = MagicMock()
        word.english = "hello"
        word.korean = "안녕"

        result = determine_correct_answer(word, "ko_to_en")
        assert result == "hello"

    def test_correct_answer_listen_ko(self):
        """Test that determine_correct_answer returns Korean for listen_ko."""
        word = MagicMock()
        word.english = "hello"
        word.korean = "안녕"

        result = determine_correct_answer(word, "listen_ko")
        assert result == "안녕"

    def test_correct_answer_default(self):
        """Test that determine_correct_answer returns English for None/unknown types."""
        word = MagicMock()
        word.english = "hello"
        word.korean = "안녕"

        result = determine_correct_answer(word, None)
        assert result == "hello"

        result_unknown = determine_correct_answer(word, "unknown_type")
        assert result_unknown == "hello"

    def test_is_typing_listen_type(self):
        """Test that is_typing_question returns True for listen_type."""
        assert is_typing_question("listen_type") is True

    def test_is_typing_ko_type(self):
        """Test that is_typing_question returns True for ko_type."""
        assert is_typing_question("ko_type") is True

    def test_is_typing_en_to_ko(self):
        """Test that is_typing_question returns False for en_to_ko (multiple choice)."""
        assert is_typing_question("en_to_ko") is False

    def test_is_typing_none(self):
        """Test that is_typing_question returns False for None."""
        assert is_typing_question(None) is False


# ── Test Edit Distance ───────────────────────────────────────────────────────


class TestEditDistance:
    """Test Levenshtein edit distance calculation."""

    def test_edit_distance_identical(self):
        """Test that identical strings have distance 0."""
        assert edit_distance("hello", "hello") == 0

    def test_edit_distance_one_substitution(self):
        """Test single character substitution."""
        assert edit_distance("hello", "hallo") == 1

    def test_edit_distance_one_insertion(self):
        """Test single character insertion."""
        assert edit_distance("hello", "helo") == 1

    def test_edit_distance_one_deletion(self):
        """Test single character deletion."""
        assert edit_distance("helo", "hello") == 1

    def test_edit_distance_empty_strings(self):
        """Test distance with empty strings."""
        assert edit_distance("", "hello") == 5
        assert edit_distance("hello", "") == 5
        assert edit_distance("", "") == 0

    def test_edit_distance_completely_different(self):
        """Test distance between completely different strings."""
        result = edit_distance("abc", "xyz")
        assert result == 3
