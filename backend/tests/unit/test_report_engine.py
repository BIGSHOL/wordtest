"""Unit tests for pure calculation functions in report_engine.py.

Tests all non-async calculation utilities that don't require database access.
"""
import pytest
from app.services.report_engine import (
    calculate_speed_score,
    calculate_accuracy_score,
    calculate_per_engine_stats,
    diagnose_strengths_weaknesses,
    calculate_time_breakdown,
    infer_question_type,
    get_vocab_description,
    get_metric_descriptions,
    RANK_TO_GRADE,
    RANK_TO_BOOK,
    ENGINE_LABELS,
)


# ---------------------------------------------------------------------------
# TestSpeedScore - calculate_speed_score logic
# ---------------------------------------------------------------------------


class TestSpeedScore:
    """Test speed score calculation from answer time data."""

    def test_fast(self):
        """Fast average (2s) should yield high speed score (~9.3)."""
        answers = [
            {"is_correct": True, "time_taken_seconds": 2.0},
            {"is_correct": True, "time_taken_seconds": 2.0},
            {"is_correct": True, "time_taken_seconds": 2.0},
        ]
        score, avg_time = calculate_speed_score(answers)
        assert score == pytest.approx(9.3, abs=0.1)
        assert avg_time == pytest.approx(2.0, abs=0.1)

    def test_slow(self):
        """Slow average (20s) should yield low speed score (~3.3)."""
        answers = [
            {"is_correct": True, "time_taken_seconds": 20.0},
            {"is_correct": True, "time_taken_seconds": 20.0},
        ]
        score, avg_time = calculate_speed_score(answers)
        assert score == pytest.approx(3.3, abs=0.1)
        assert avg_time == pytest.approx(20.0, abs=0.1)

    def test_no_correct(self):
        """No correct answers should return default (5.0, None)."""
        answers = [
            {"is_correct": False, "time_taken_seconds": 5.0},
            {"is_correct": False, "time_taken_seconds": 10.0},
        ]
        score, avg_time = calculate_speed_score(answers)
        assert score == 5.0
        assert avg_time is None


# ---------------------------------------------------------------------------
# TestAccuracyScore - calculate_accuracy_score normalization
# ---------------------------------------------------------------------------


class TestAccuracyScore:
    """Test accuracy score normalization to 0-10 scale."""

    def test_perfect(self):
        """Perfect accuracy (10/10) should yield 10.0."""
        score = calculate_accuracy_score(10, 10)
        assert score == 10.0

    def test_half(self):
        """Half accuracy (5/10) should yield 5.0."""
        score = calculate_accuracy_score(5, 10)
        assert score == 5.0

    def test_zero_total(self):
        """Zero total questions should return 0.0."""
        score = calculate_accuracy_score(0, 0)
        assert score == 0.0


# ---------------------------------------------------------------------------
# TestPerEngineStats - per-engine grouping and sorting
# ---------------------------------------------------------------------------


class TestPerEngineStats:
    """Test per-engine statistics grouping and calculation."""

    def test_multi_engine(self):
        """Multiple engines should be grouped correctly."""
        answers = [
            {"question_type": "en_to_ko", "is_correct": True, "time_taken_seconds": 2.0},
            {"question_type": "en_to_ko", "is_correct": False, "time_taken_seconds": 3.0},
            {"question_type": "ko_to_en", "is_correct": True, "time_taken_seconds": 5.0},
        ]
        stats = calculate_per_engine_stats(answers)

        # Find stats by engine name
        en_ko = next(s for s in stats if s["engine"] == "en_to_ko")
        ko_en = next(s for s in stats if s["engine"] == "ko_to_en")

        assert en_ko["total"] == 2
        assert en_ko["correct"] == 1
        assert en_ko["accuracy_pct"] == 50.0
        assert en_ko["avg_time_sec"] == 2.0  # only correct answer's time

        assert ko_en["total"] == 1
        assert ko_en["correct"] == 1
        assert ko_en["accuracy_pct"] == 100.0
        assert ko_en["avg_time_sec"] == 5.0

    def test_empty(self):
        """Empty answer list should return empty stats."""
        stats = calculate_per_engine_stats([])
        assert stats == []

    def test_sorted_by_accuracy(self):
        """Results should be sorted by accuracy ascending (weakest first)."""
        answers = [
            {"question_type": "en_to_ko", "is_correct": True, "time_taken_seconds": 2.0},
            {"question_type": "en_to_ko", "is_correct": True, "time_taken_seconds": 2.0},
            {"question_type": "ko_to_en", "is_correct": False, "time_taken_seconds": 5.0},
            {"question_type": "ko_to_en", "is_correct": False, "time_taken_seconds": 5.0},
        ]
        stats = calculate_per_engine_stats(answers)

        # Should be sorted: ko_to_en (0%) before en_to_ko (100%)
        assert len(stats) == 2
        assert stats[0]["engine"] == "ko_to_en"
        assert stats[0]["accuracy_pct"] == 0.0
        assert stats[1]["engine"] == "en_to_ko"
        assert stats[1]["accuracy_pct"] == 100.0

    def test_infer_from_stage(self):
        """infer_question_type should use STAGE_ENGINE_MAP when no question_type."""
        # Test with stage fallback
        answer_with_stage = {"stage": 1, "is_correct": True, "time_taken_seconds": 3.0}
        qt = infer_question_type(answer_with_stage)
        assert qt == "en_to_ko"

        # Test with explicit question_type (takes priority)
        answer_explicit = {"question_type": "ko_to_en", "stage": 1, "is_correct": True}
        qt_explicit = infer_question_type(answer_explicit)
        assert qt_explicit == "ko_to_en"


# ---------------------------------------------------------------------------
# TestDiagnosis - strength/weakness detection
# ---------------------------------------------------------------------------


class TestDiagnosis:
    """Test strength/weakness diagnosis based on engine performance."""

    def test_weakness(self):
        """Engine with <60% accuracy and >=2 questions should be a weakness."""
        engine_stats = [
            {"engine": "en_to_ko", "label": "영한", "total": 5, "correct": 2, "accuracy_pct": 40.0},
            {"engine": "ko_to_en", "label": "한영", "total": 3, "correct": 3, "accuracy_pct": 100.0},
        ]
        diagnosis = diagnose_strengths_weaknesses(engine_stats)

        assert len(diagnosis["weaknesses"]) == 1
        assert diagnosis["weaknesses"][0]["engine"] == "en_to_ko"
        assert diagnosis["weaknesses"][0]["accuracy_pct"] == 40.0

    def test_strength(self):
        """Engine with >=80% accuracy and >=2 questions should be a strength."""
        engine_stats = [
            {"engine": "en_to_ko", "label": "영한", "total": 5, "correct": 5, "accuracy_pct": 100.0},
            {"engine": "ko_to_en", "label": "한영", "total": 3, "correct": 1, "accuracy_pct": 33.3},
        ]
        diagnosis = diagnose_strengths_weaknesses(engine_stats)

        assert len(diagnosis["strengths"]) == 1
        assert diagnosis["strengths"][0]["engine"] == "en_to_ko"
        assert diagnosis["strengths"][0]["accuracy_pct"] == 100.0

    def test_skip_low_count(self):
        """Engines with only 1 question should be excluded from diagnosis."""
        engine_stats = [
            {"engine": "en_to_ko", "label": "영한", "total": 1, "correct": 0, "accuracy_pct": 0.0},
            {"engine": "ko_to_en", "label": "한영", "total": 1, "correct": 1, "accuracy_pct": 100.0},
        ]
        diagnosis = diagnose_strengths_weaknesses(engine_stats)

        # Both engines have only 1 question, so both should be excluded
        assert len(diagnosis["weaknesses"]) == 0
        assert len(diagnosis["strengths"]) == 0


# ---------------------------------------------------------------------------
# TestTimeBreakdown - time grouping by category
# ---------------------------------------------------------------------------


class TestTimeBreakdown:
    """Test time breakdown calculation by engine category."""

    def test_categories(self):
        """Time should be grouped by _ENGINE_CATEGORY mapping."""
        answers = [
            {"question_type": "en_to_ko", "time_taken_seconds": 5.0},
            {"question_type": "ko_to_en", "time_taken_seconds": 3.0},
            {"question_type": "listen_en", "time_taken_seconds": 10.0},
            {"question_type": "listen_ko", "time_taken_seconds": 8.0},
        ]
        total, categories = calculate_time_breakdown(answers)

        assert total == 26  # 5+3+10+8=26
        assert categories["단어"] == 8  # en_to_ko (5) + ko_to_en (3)
        assert categories["리스닝"] == 18  # listen_en (10) + listen_ko (8)

    def test_no_times(self):
        """Answers with all None times should return (None, {})."""
        answers = [
            {"question_type": "en_to_ko", "time_taken_seconds": None},
            {"question_type": "ko_to_en", "time_taken_seconds": None},
        ]
        total, categories = calculate_time_breakdown(answers)

        assert total is None
        assert categories == {}


# ---------------------------------------------------------------------------
# TestStaticMappings - verify static mapping tables
# ---------------------------------------------------------------------------


class TestStaticMappings:
    """Test static mapping tables and description generators."""

    def test_rank_to_grade_15(self):
        """RANK_TO_GRADE should have at least 15 entries."""
        assert len(RANK_TO_GRADE) >= 15
        assert 1 in RANK_TO_GRADE
        assert 15 in RANK_TO_GRADE

    def test_rank_to_book_15(self):
        """RANK_TO_BOOK should have at least 15 entries."""
        assert len(RANK_TO_BOOK) >= 15
        assert 1 in RANK_TO_BOOK
        assert 15 in RANK_TO_BOOK

    def test_engine_labels_8(self):
        """ENGINE_LABELS should have at least 8 engine types."""
        assert len(ENGINE_LABELS) >= 8
        assert "en_to_ko" in ENGINE_LABELS
        assert "ko_to_en" in ENGINE_LABELS
        assert "listen_en" in ENGINE_LABELS
        assert "listen_ko" in ENGINE_LABELS

    def test_vocab_description(self):
        """get_vocab_description should format rank + accuracy correctly."""
        desc = get_vocab_description(1, 80)
        assert "80%" in desc
        # Should contain some vocab label
        assert len(desc) > 5

    def test_metric_descriptions_4axes(self):
        """get_metric_descriptions should return 4 metric detail dicts."""
        metrics = {
            "vocabulary_level": 5.0,
            "accuracy": 7.0,
            "speed": 8.0,
            "vocabulary_size": 6.0,
        }
        details = get_metric_descriptions(rank=5, metrics=metrics)

        assert len(details) == 4
        keys = {d["key"] for d in details}
        assert keys == {"vocabulary_level", "accuracy", "speed", "vocabulary_size"}

        # Each detail should have required fields
        for d in details:
            assert "key" in d
            assert "name" in d
            assert "my_score" in d
            assert "description" in d
            assert d["my_score"] == metrics[d["key"]]
