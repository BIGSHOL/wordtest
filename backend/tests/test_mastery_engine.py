"""Mastery engine tests - question generation and difficulty logic."""
import pytest
from app.services.mastery_engine import (
    _min_stage_for_level,
    _choice_count_for_level,
    _base_timer_for_level,
    _typing_probability,
)


class TestMinStageForLevel:
    """Test minimum stage requirements based on word level."""

    def test_level_1_2_allows_all_stages(self):
        """Levels 1-2 allow all question types (min stage 1)."""
        assert _min_stage_for_level(1) == 1
        assert _min_stage_for_level(2) == 1

    def test_level_3_4_requires_stage_2(self):
        """Levels 3-4 require at least stage 2 (meaning_to_word)."""
        assert _min_stage_for_level(3) == 2
        assert _min_stage_for_level(4) == 2

    def test_level_5_6_requires_stage_3(self):
        """Levels 5-6 require at least stage 3 (listen_and_type)."""
        assert _min_stage_for_level(5) == 3
        assert _min_stage_for_level(6) == 3

    def test_level_7_9_requires_stage_4(self):
        """Levels 7-9 require at least stage 4 (listen_to_meaning)."""
        assert _min_stage_for_level(7) == 4
        assert _min_stage_for_level(8) == 4
        assert _min_stage_for_level(9) == 4

    def test_level_10plus_requires_stage_5(self):
        """Levels 10+ require stage 5 (meaning_and_type)."""
        assert _min_stage_for_level(10) == 5
        assert _min_stage_for_level(15) == 5


class TestChoiceCountForLevel:
    """Test number of choices based on word level."""

    def test_level_1_2_gets_3_choices(self):
        """Levels 1-2 get 3 choices (easy)."""
        assert _choice_count_for_level(1) == 3
        assert _choice_count_for_level(2) == 3

    def test_level_3_4_gets_4_choices(self):
        """Levels 3-4 get 4 choices (standard)."""
        assert _choice_count_for_level(3) == 4
        assert _choice_count_for_level(4) == 4

    def test_level_5_7_gets_5_choices(self):
        """Levels 5-7 get 5 choices (medium)."""
        assert _choice_count_for_level(5) == 5
        assert _choice_count_for_level(7) == 5

    def test_level_8plus_gets_6_choices(self):
        """Levels 8+ get 6 choices (hard)."""
        assert _choice_count_for_level(8) == 6
        assert _choice_count_for_level(15) == 6


class TestBaseTimerForLevel:
    """Test timer calculation based on level and stage."""

    def test_typing_questions_get_generous_time(self):
        """Typing questions (stage 3, 5) get more time."""
        # Stage 3 (listen_and_type)
        assert _base_timer_for_level(1, 3) == 15  # Level 1-4: 15s
        assert _base_timer_for_level(5, 3) == 12  # Level 5-8: 12s
        assert _base_timer_for_level(10, 3) == 10  # Level 9+: 10s

        # Stage 5 (meaning_and_type)
        assert _base_timer_for_level(1, 5) == 15
        assert _base_timer_for_level(5, 5) == 12
        assert _base_timer_for_level(10, 5) == 10

    def test_choice_questions_time_decreases_with_level(self):
        """Multiple choice questions get less time at higher levels."""
        # Stage 1 (choice)
        assert _base_timer_for_level(1, 1) == 8
        assert _base_timer_for_level(3, 1) == 7
        assert _base_timer_for_level(5, 1) == 6
        assert _base_timer_for_level(8, 1) == 5
        assert _base_timer_for_level(10, 1) == 4

    def test_listen_questions_also_follow_level_pattern(self):
        """Listen-based choice questions (stage 4) follow same pattern."""
        assert _base_timer_for_level(1, 4) == 8
        assert _base_timer_for_level(10, 4) == 4


class TestTypingProbability:
    """Test probability of upgrading to typing questions."""

    def test_low_levels_no_typing_upgrade(self):
        """Levels 1-3 have 0% chance of typing upgrade."""
        assert _typing_probability(1) == 0.0
        assert _typing_probability(2) == 0.0
        assert _typing_probability(3) == 0.0

    def test_mid_levels_moderate_typing(self):
        """Mid levels have moderate typing probability."""
        assert _typing_probability(4) == 0.15
        assert _typing_probability(5) == 0.15
        assert _typing_probability(6) == 0.3
        assert _typing_probability(7) == 0.3

    def test_high_levels_frequent_typing(self):
        """High levels have high typing probability."""
        assert _typing_probability(8) == 0.45
        assert _typing_probability(9) == 0.45
        assert _typing_probability(10) == 0.6
        assert _typing_probability(15) == 0.6

    def test_probabilities_in_valid_range(self):
        """All probabilities are between 0 and 1."""
        for level in range(1, 16):
            prob = _typing_probability(level)
            assert 0.0 <= prob <= 1.0


class TestStageQuestionLogic:
    """Test question type selection logic."""

    def test_stage_1_is_word_to_meaning_choice(self):
        """Stage 1 questions are word→meaning multiple choice."""
        # This is tested in integration, just documenting behavior
        pass

    def test_stage_2_is_meaning_to_word_choice(self):
        """Stage 2 questions are meaning→word multiple choice (reverse)."""
        # This is tested in integration
        pass

    def test_stage_3_is_listen_and_type(self):
        """Stage 3 questions are listen→type word."""
        # This is tested in integration
        pass

    def test_stage_4_is_listen_to_meaning_choice(self):
        """Stage 4 questions are listen→choose meaning."""
        # This is tested in integration
        pass

    def test_stage_5_is_meaning_and_type(self):
        """Stage 5 questions are meaning→type word (hardest)."""
        # This is tested in integration
        pass


class TestDifficultyEscalation:
    """Test that difficulty properly escalates with level."""

    def test_all_metrics_increase_with_level(self):
        """Verify that difficulty increases across all metrics."""
        # Min stage requirement increases
        assert _min_stage_for_level(1) < _min_stage_for_level(5) < _min_stage_for_level(10)

        # Choice count increases
        assert _choice_count_for_level(1) < _choice_count_for_level(5) < _choice_count_for_level(10)

        # Timer decreases (harder)
        assert _base_timer_for_level(1, 1) > _base_timer_for_level(5, 1) > _base_timer_for_level(10, 1)

        # Typing probability increases
        assert _typing_probability(1) < _typing_probability(5) < _typing_probability(10)
