"""Integration tests for Level-Up Test Engine service with real DB.

Tests the full adaptive difficulty test flow with SQLite in-memory DB.
"""
import pytest
from app.services import levelup_service


class TestStartSession:
    """Test start_session function with various scenarios."""

    @pytest.mark.asyncio
    async def test_start_success(self, db_session, levelup_assignment, sample_words):
        """Should successfully start a level-up session and return initial questions."""
        result = await levelup_service.start_session(db_session, "LU0001")

        assert result["session_id"] is not None
        assert result["assignment_id"] == levelup_assignment.id
        assert result["engine_type"] == "levelup"
        assert result["current_level"] == 1  # Start at lowest level
        assert len(result["questions"]) > 0
        assert result["total_words"] > 0
        assert "level_info" in result
        assert "available_levels" in result
        assert result["per_question_time"] == 10

        # Verify question structure
        first_q = result["questions"][0]
        assert "word_mastery_id" in first_q
        assert "word" in first_q
        assert "question_type" in first_q
        assert "timer_seconds" in first_q
        assert "correct_answer" in first_q
        # Either choices (multiple choice) or is typing question
        assert "choices" in first_q or first_q.get("question_type") in [
            "en_typing",
            "ko_typing",
        ]

    @pytest.mark.asyncio
    async def test_start_invalid_code(self, db_session):
        """Should raise ValueError for non-existent test code."""
        with pytest.raises(ValueError, match="Invalid or inactive test code"):
            await levelup_service.start_session(db_session, "INVALID")

    @pytest.mark.asyncio
    async def test_start_wrong_engine_type(self, db_session, legacy_assignment):
        """Should raise ValueError when test code is for a different engine type."""
        with pytest.raises(ValueError, match="not for a level-up test"):
            await levelup_service.start_session(db_session, "LG0001")

    @pytest.mark.asyncio
    async def test_start_already_completed(
        self, db_session, levelup_assignment, sample_words
    ):
        """Should raise ValueError when trying to restart without allow_restart flag."""
        # Start and complete the session
        result = await levelup_service.start_session(db_session, "LU0001")
        session_id = result["session_id"]

        # Complete the session
        await levelup_service.complete_session(
            db_session, session_id, final_level=3
        )

        # Try to start again without allow_restart
        with pytest.raises(ValueError, match="ALREADY_COMPLETED"):
            await levelup_service.start_session(
                db_session, "LU0001", allow_restart=False
            )


class TestSubmitAnswer:
    """Test submit_answer function with correct and incorrect answers."""

    @pytest.mark.asyncio
    async def test_submit_correct(self, db_session, levelup_assignment, sample_words):
        """Should correctly validate a correct answer."""
        # Start session
        result = await levelup_service.start_session(db_session, "LU0001")
        session_id = result["session_id"]
        questions = result["questions"]
        assert len(questions) > 0

        # Get first question and use its correct_answer directly
        first_q = questions[0]
        word_mastery_id = first_q["word_mastery_id"]
        question_type = first_q.get("question_type", "en_to_ko")
        correct_answer = first_q["correct_answer"]

        # Submit correct answer
        submit_result = await levelup_service.submit_answer(
            db_session,
            session_id=session_id,
            word_mastery_id=word_mastery_id,
            selected_answer=correct_answer,
            time_taken_seconds=5.0,
            question_type=question_type,
        )

        assert submit_result["is_correct"] is True
        assert submit_result["correct_answer"] == correct_answer
        assert "word_level" in submit_result
        assert "example_en" in submit_result
        assert "example_ko" in submit_result

    @pytest.mark.asyncio
    async def test_submit_wrong(self, db_session, levelup_assignment, sample_words):
        """Should correctly validate an incorrect answer."""
        # Start session
        result = await levelup_service.start_session(db_session, "LU0001")
        session_id = result["session_id"]
        questions = result["questions"]
        assert len(questions) > 0

        # Get first question
        first_q = questions[0]
        word_mastery_id = first_q["word_mastery_id"]
        question_type = first_q.get("question_type", "en_to_ko")

        # Submit a clearly wrong answer
        wrong_answer = "DEFINITELY_WRONG_ANSWER_XYZ"

        submit_result = await levelup_service.submit_answer(
            db_session,
            session_id=session_id,
            word_mastery_id=word_mastery_id,
            selected_answer=wrong_answer,
            time_taken_seconds=5.0,
            question_type=question_type,
        )

        assert submit_result["is_correct"] is False
        assert submit_result["correct_answer"] != wrong_answer
        assert "word_level" in submit_result


class TestCompleteSession:
    """Test complete_session function."""

    @pytest.mark.asyncio
    async def test_complete_success(
        self, db_session, levelup_assignment, sample_words
    ):
        """Should successfully complete a session and return accuracy metrics."""
        # Start session
        result = await levelup_service.start_session(db_session, "LU0001")
        session_id = result["session_id"]
        questions = result["questions"]

        # Submit a few answers (alternate correct/wrong)
        for i, question in enumerate(questions[:3]):
            word_mastery_id = question["word_mastery_id"]
            question_type = question.get("question_type", "en_to_ko")
            correct_answer = question["correct_answer"]

            # Submit answer (alternate correct/wrong)
            if i % 2 == 0:
                await levelup_service.submit_answer(
                    db_session,
                    session_id=session_id,
                    word_mastery_id=word_mastery_id,
                    selected_answer=correct_answer,
                    time_taken_seconds=5.0,
                    question_type=question_type,
                )
            else:
                await levelup_service.submit_answer(
                    db_session,
                    session_id=session_id,
                    word_mastery_id=word_mastery_id,
                    selected_answer="WRONG",
                    time_taken_seconds=5.0,
                    question_type=question_type,
                )

        # Complete session
        complete_result = await levelup_service.complete_session(
            db_session, session_id, final_level=3, best_combo=5
        )

        assert complete_result["final_level"] == 3
        assert 0.0 <= complete_result["accuracy"] <= 100.0
        assert complete_result["total_answered"] == 3
        assert complete_result["best_combo"] == 5
        assert "correct_count" in complete_result

    @pytest.mark.asyncio
    async def test_complete_not_found(self, db_session):
        """Should raise ValueError for non-existent session."""
        with pytest.raises(ValueError, match="Session not found"):
            await levelup_service.complete_session(
                db_session, "INVALID_SESSION_ID", final_level=1
            )
