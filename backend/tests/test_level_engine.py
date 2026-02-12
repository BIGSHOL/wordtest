"""Level engine unit tests — pure functions, no DB required."""
import pytest
from app.services.level_engine import (
    word_level_to_rank,
    format_rank_label,
    determine_level,
    calculate_score,
    RANK_NAMES,
)


class TestWordLevelToRank:
    def test_level_1_maps_to_rank_1(self):
        assert word_level_to_rank(1) == 1

    def test_level_10_maps_to_rank_10(self):
        assert word_level_to_rank(10) == 10

    def test_level_15_maps_to_rank_15(self):
        assert word_level_to_rank(15) == 15


class TestFormatRankLabel:
    def test_iron_sublevel_5(self):
        assert format_rank_label(1, 5) == "Iron 1-5"

    def test_challenger_max(self):
        assert format_rank_label(10, 25, 25) == "Challenger 10-MAX"

    def test_silver_sublevel_1(self):
        assert format_rank_label(3, 1) == "Silver 3-1"


class TestDetermineLevel:
    def test_empty_returns_1_1(self):
        assert determine_level([]) == (1, 1)

    def test_all_correct_returns_highest_rank(self):
        # All correct across ranks 1-5, 2 questions each
        answers = []
        for level in range(1, 6):
            answers.append((level, "Lesson 01", True))
            answers.append((level, "Lesson 25", True))
        rank, sublevel = determine_level(answers)
        assert rank == 5
        assert sublevel == 25  # All correct → MAX

    def test_all_wrong_returns_1_1(self):
        answers = [
            (1, "Lesson 01", False),
            (1, "Lesson 25", False),
            (2, "Lesson 01", False),
            (2, "Lesson 25", False),
        ]
        rank, sublevel = determine_level(answers)
        assert rank == 1
        assert sublevel == 1

    def test_pass_rank_1_to_3_fail_4_and_5(self):
        answers = []
        for level in range(1, 4):
            answers.append((level, "Lesson 01", True))
            answers.append((level, "Lesson 10", True))
        for level in range(4, 6):
            answers.append((level, "Lesson 01", False))
            answers.append((level, "Lesson 10", False))
        rank, sublevel = determine_level(answers)
        assert rank == 3
        assert sublevel == 25  # all correct in rank 3

    def test_two_consecutive_fails_stops_early(self):
        # Pass rank 1, fail rank 2 and 3 → stops, rank should be 1
        answers = [
            (1, "Lesson 01", True),
            (1, "Lesson 25", True),
            (2, "Lesson 01", False),
            (2, "Lesson 25", False),
            (3, "Lesson 01", False),
            (3, "Lesson 25", False),
            (4, "Lesson 01", True),  # should not matter
            (4, "Lesson 25", True),
        ]
        rank, sublevel = determine_level(answers)
        assert rank == 1

    def test_sublevel_early_lesson_only(self):
        # Only early lesson correct → sublevel = 1 (index 0 + 1)
        answers = [
            (1, "Lesson 01", True),
            (1, "Lesson 25", False),
        ]
        rank, sublevel = determine_level(answers)
        assert rank == 1
        assert sublevel == 1  # only Lesson 01 correct → index 0 + 1

    def test_sublevel_late_lesson_correct(self):
        # Late lesson correct → sublevel = 2 (index 1 + 1)
        answers = [
            (1, "Lesson 01", False),
            (1, "Lesson 25", True),
        ]
        rank, sublevel = determine_level(answers)
        assert rank == 1
        assert sublevel == 2  # Lesson 25 correct → index 1 + 1

    def test_word_level_11_to_15_maps_to_rank_10(self):
        answers = []
        for level in range(11, 16):
            answers.append((level, "Lesson 01", True))
        rank, sublevel = determine_level(answers)
        assert rank == 10


class TestCalculateScore:
    def test_zero_questions_returns_zero(self):
        assert calculate_score(0, 0) == 0

    def test_15_of_20_returns_75(self):
        assert calculate_score(15, 20) == 75

    def test_perfect_score(self):
        assert calculate_score(20, 20) == 100

    def test_zero_correct(self):
        assert calculate_score(0, 20) == 0
