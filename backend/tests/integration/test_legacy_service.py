"""Integration tests for legacy_service.py with real DB.

Tests the full legacy test engine flow: start session, submit answers, complete session.
"""
import pytest

from app.services import legacy_service


# ── TestStartSession ──────────────────────────────────────────────────────────

class TestStartSession:
    """Test starting a legacy test session."""

    @pytest.mark.asyncio
    async def test_start_success(self, db_session, legacy_assignment, sample_words):
        """Start session returns dict with session_id, questions (all upfront), engine_type='legacy'."""
        result = await legacy_service.start_session(db_session, "LG0001")

        assert result["session_id"]
        assert result["assignment_id"] == legacy_assignment.id
        assert result["engine_type"] == "legacy"
        assert isinstance(result["questions"], list)
        assert len(result["questions"]) > 0

        # All questions should have required fields
        for q in result["questions"]:
            assert q["word_mastery_id"]
            assert q["word"]["id"]
            assert q["question_type"]
            assert q["correct_answer"]
            assert "choices" in q
            assert "timer_seconds" in q

    @pytest.mark.asyncio
    async def test_start_invalid_code(self, db_session):
        """Starting with invalid code raises ValueError."""
        with pytest.raises(ValueError, match="Invalid or inactive test code"):
            await legacy_service.start_session(db_session, "INVALID")

    @pytest.mark.asyncio
    async def test_start_question_count(self, db_session, legacy_assignment, sample_words):
        """Questions length respects config's question_count (10)."""
        result = await legacy_service.start_session(db_session, "LG0001")

        # legacy_assignment config has question_count=10
        assert len(result["questions"]) == 10
        assert result["question_count"] == 10


# ── TestSubmitAnswer ──────────────────────────────────────────────────────────

class TestSubmitAnswer:
    """Test submitting answers for legacy test questions."""

    @pytest.mark.asyncio
    async def test_submit_correct(self, db_session, legacy_assignment, sample_words):
        """Submit correct answer returns is_correct=True."""
        result = await legacy_service.start_session(db_session, "LG0001")
        q = result["questions"][0]

        answer_result = await legacy_service.submit_answer(
            db_session,
            result["session_id"],
            q["word_mastery_id"],
            q["correct_answer"],
            time_taken_seconds=5.0,
            question_type=q["question_type"],
        )

        assert answer_result["is_correct"] is True
        assert answer_result["correct_answer"] == q["correct_answer"]
        assert answer_result["almost_correct"] is False

    @pytest.mark.asyncio
    async def test_submit_wrong(self, db_session, legacy_assignment, sample_words):
        """Submit wrong answer returns is_correct=False."""
        result = await legacy_service.start_session(db_session, "LG0001")
        q = result["questions"][0]

        # Submit an obviously wrong answer
        wrong_answer = "WRONG_ANSWER_123"
        answer_result = await legacy_service.submit_answer(
            db_session,
            result["session_id"],
            q["word_mastery_id"],
            wrong_answer,
            time_taken_seconds=3.0,
            question_type=q["question_type"],
        )

        assert answer_result["is_correct"] is False
        assert answer_result["correct_answer"] == q["correct_answer"]


# ── TestCompleteSession ───────────────────────────────────────────────────────

class TestCompleteSession:
    """Test completing a legacy test session."""

    @pytest.mark.asyncio
    async def test_complete_success(self, db_session, legacy_assignment, sample_words):
        """Complete session returns accuracy dict."""
        # Start session
        result = await legacy_service.start_session(db_session, "LG0001")
        session_id = result["session_id"]

        # Submit all answers (mix of correct/incorrect)
        for i, q in enumerate(result["questions"]):
            # Answer correctly for first half, incorrectly for second half
            if i < len(result["questions"]) // 2:
                answer = q["correct_answer"]
            else:
                answer = "WRONG"

            await legacy_service.submit_answer(
                db_session,
                session_id,
                q["word_mastery_id"],
                answer,
                question_type=q["question_type"],
            )

        # Complete session
        complete_result = await legacy_service.complete_session(db_session, session_id)

        assert "accuracy" in complete_result
        assert "total_answered" in complete_result
        assert "correct_count" in complete_result
        assert complete_result["total_answered"] == 10
        assert complete_result["correct_count"] == 5
        assert complete_result["accuracy"] == 50.0

    @pytest.mark.asyncio
    async def test_complete_not_found(self, db_session):
        """Complete with bad session_id raises ValueError."""
        with pytest.raises(ValueError, match="Session not found"):
            await legacy_service.complete_session(db_session, "bad-session-id")


# ── TestDistributedSelection ──────────────────────────────────────────────────

class TestDistributedSelection:
    """Test distributed word selection algorithm."""

    @pytest.mark.asyncio
    async def test_distributed_words(self, db_session, sample_words):
        """_select_distributed_words returns words spread across the range."""
        # sample_words has 50 words (5 levels x 10 words)
        selected = legacy_service._select_distributed_words(sample_words, 10)

        assert len(selected) == 10

        # Should be evenly distributed across the range
        # With 50 words and count=10, step = 5, so indices 0, 5, 10, 15, 20, 25, 30, 35, 40, 45
        # Check that we have words from different levels
        levels = {w.level for w in selected}
        assert len(levels) >= 3  # Should span at least 3 different levels

        # Verify order is maintained (easy → hard)
        for i in range(len(selected) - 1):
            curr = selected[i]
            next_word = selected[i + 1]
            # Level should be non-decreasing
            assert curr.level <= next_word.level
