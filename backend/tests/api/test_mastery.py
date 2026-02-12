"""Mastery learning API tests."""
import pytest
import pytest_asyncio
from sqlalchemy import select
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.learning_session import LearningSession
from app.models.word_mastery import WordMastery  # noqa: F401


@pytest_asyncio.fixture
async def mastery_config(db_session, teacher_user):
    """Create a mastery test config."""
    config = TestConfig(
        name="Mastery Test",
        test_type="mastery",
        teacher_id=teacher_user.id,
        level_range_min=1,
        level_range_max=3,
        per_question_time_seconds=10,
    )
    db_session.add(config)
    await db_session.commit()
    await db_session.refresh(config)
    return config


@pytest_asyncio.fixture
async def mastery_assignment(db_session, student_user, teacher_user, mastery_config):
    """Create a mastery test assignment."""
    assignment = TestAssignment(
        test_config_id=mastery_config.id,
        student_id=student_user.id,
        teacher_id=teacher_user.id,
        test_code="MAST001",
        status="pending",
    )
    db_session.add(assignment)
    await db_session.commit()
    await db_session.refresh(assignment)
    return assignment


@pytest.mark.asyncio
class TestStartMasteryByCode:
    """POST /api/v1/mastery/start-by-code."""

    async def test_start_mastery_success(
        self, client, mastery_assignment, sample_words
    ):
        """Can start a mastery session with valid test code."""
        response = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        assert response.status_code == 201
        data = response.json()
        assert "session" in data
        assert "questions" in data
        assert "access_token" in data
        assert data["assignment_type"] == "mastery"
        assert data["session"]["assignment_id"] == str(mastery_assignment.id)
        assert len(data["questions"]) > 0
        # Questions should have required fields
        q = data["questions"][0]
        assert "word" in q
        assert "stage" in q
        assert "choices" in q or "question_type" in q

    async def test_start_mastery_invalid_code(self, client):
        """Returns 404 for invalid test code."""
        response = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "INVALID"},
        )
        assert response.status_code == 404

    async def test_start_mastery_empty_code(self, client):
        """Returns 400 for empty test code."""
        response = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": ""},
        )
        assert response.status_code == 400

    async def test_start_mastery_already_completed(
        self, client, db_session, mastery_assignment, sample_words
    ):
        """Returns 409 if assignment already completed."""
        # First, start and complete a session
        response1 = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        assert response1.status_code == 201
        session_id = response1.json()["session"]["id"]

        # Mark session as completed
        result = await db_session.execute(
            select(LearningSession).where(LearningSession.id == session_id)
        )
        session = result.scalar_one()
        from app.core.timezone import now_kst
        session.completed_at = now_kst()
        await db_session.commit()

        # Try starting again without allow_restart
        response2 = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        assert response2.status_code == 409
        assert "ALREADY_COMPLETED" in response2.json()["detail"]["code"]


@pytest.mark.asyncio
class TestGetBatch:
    """POST /api/v1/mastery/batch."""

    async def test_get_batch_success(
        self, client, db_session, student_headers, mastery_assignment, sample_words
    ):
        """Can fetch batch of questions at specific level."""
        # Start session first
        start_resp = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        session_id = start_resp.json()["session"]["id"]

        # Request batch
        response = await client.post(
            "/api/v1/mastery/batch",
            json={"session_id": session_id, "level": 2, "batch_size": 10},
            headers=student_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "questions" in data
        assert "stage_summary" in data
        assert "current_level" in data

    async def test_get_batch_session_not_found(
        self, client, student_headers
    ):
        """Returns 404 for invalid session_id."""
        response = await client.post(
            "/api/v1/mastery/batch",
            json={"session_id": "invalid-uuid", "level": 2, "batch_size": 10},
            headers=student_headers,
        )
        assert response.status_code == 404

    async def test_get_batch_unauthenticated(self, client):
        """Returns 401 without authentication."""
        response = await client.post(
            "/api/v1/mastery/batch",
            json={"session_id": "some-id", "level": 2},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestCompleteBatch:
    """POST /api/v1/mastery/complete-batch."""

    async def test_complete_batch_success(
        self, client, db_session, mastery_assignment, sample_words
    ):
        """Can complete batch and save final level."""
        # Start session
        start_resp = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        session_id = start_resp.json()["session"]["id"]

        # Complete batch
        response = await client.post(
            "/api/v1/mastery/complete-batch",
            json={"session_id": session_id, "final_level": 3, "best_combo": 5},
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_level" in data

        # Verify session updated
        result = await db_session.execute(
            select(LearningSession).where(LearningSession.id == session_id)
        )
        session = result.scalar_one()
        assert session.current_level == 3
        assert session.best_combo == 5
        assert session.completed_at is not None

    async def test_complete_batch_invalid_session(self, client):
        """Returns 400 for invalid session."""
        response = await client.post(
            "/api/v1/mastery/complete-batch",
            json={"session_id": "invalid", "final_level": 3},
        )
        assert response.status_code == 400


@pytest.mark.asyncio
class TestSubmitMasteryAnswer:
    """POST /api/v1/mastery/{session_id}/answer."""

    async def test_submit_answer_success(
        self, client, db_session, student_headers, mastery_assignment, sample_words
    ):
        """Can submit answer and get result."""
        # Start session (this also creates WordMastery records via _ensure_mastery_records)
        start_resp = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        session_id = start_resp.json()["session"]["id"]
        questions = start_resp.json()["questions"]

        # Use existing word_mastery_id from the started session
        word_mastery_id = questions[0]["word_mastery_id"]

        # Submit answer
        response = await client.post(
            f"/api/v1/mastery/{session_id}/answer",
            json={
                "word_mastery_id": word_mastery_id,
                "selected_answer": "correct",
                "stage": 1,
                "time_taken_seconds": 3.5,
                "question_type": "choice",
                "context_mode": "word",
            },
            headers=student_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_correct" in data
        assert "new_stage" in data

    async def test_submit_answer_unauthenticated(self, client):
        """Returns 401 without authentication."""
        response = await client.post(
            "/api/v1/mastery/session-id/answer",
            json={
                "word_mastery_id": "some-id",
                "selected_answer": "test",
                "stage": 1,
            },
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestMasteryProgress:
    """GET /api/v1/mastery/progress/{assignment_id}."""

    async def test_get_progress_success(
        self, client, student_headers, mastery_assignment, sample_words
    ):
        """Can get mastery progress for assignment."""
        response = await client.get(
            f"/api/v1/mastery/progress/{mastery_assignment.id}",
            headers=student_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_words" in data
        assert "stage_summary" in data

    async def test_get_progress_invalid_assignment(
        self, client, student_headers
    ):
        """Returns 404 for invalid assignment."""
        response = await client.get(
            "/api/v1/mastery/progress/invalid-id",
            headers=student_headers,
        )
        assert response.status_code == 404

    async def test_get_progress_unauthenticated(self, client):
        """Returns 401 without authentication."""
        response = await client.get(
            "/api/v1/mastery/progress/some-id",
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestSessionSummary:
    """GET /api/v1/mastery/session/{session_id}/summary."""

    async def test_get_summary_success(
        self, client, mastery_assignment, sample_words
    ):
        """Can get session summary (no auth required)."""
        # Start session
        start_resp = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        session_id = start_resp.json()["session"]["id"]

        # Get summary
        response = await client.get(
            f"/api/v1/mastery/session/{session_id}/summary",
        )
        assert response.status_code == 200
        data = response.json()
        assert "session_id" in data
        assert "student_name" in data
        assert "current_level" in data
        assert "total_questions" in data
        assert "accuracy" in data

    async def test_get_summary_not_found(self, client):
        """Returns 404 for invalid session."""
        response = await client.get(
            "/api/v1/mastery/session/invalid-id/summary",
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestSessionReport:
    """GET /api/v1/mastery/session/{session_id}/report."""

    async def test_get_report_success(
        self, client, db_session, mastery_assignment, sample_words
    ):
        """Can get full mastery report (no auth required)."""
        # Start session
        start_resp = await client.post(
            "/api/v1/mastery/start-by-code",
            json={"test_code": "MAST001"},
        )
        session_id = start_resp.json()["session"]["id"]

        # Complete session
        result = await db_session.execute(
            select(LearningSession).where(LearningSession.id == session_id)
        )
        session = result.scalar_one()
        from app.core.timezone import now_kst
        session.completed_at = now_kst()
        session.current_level = 3
        await db_session.commit()

        # Get report
        response = await client.get(
            f"/api/v1/mastery/session/{session_id}/report",
        )
        assert response.status_code == 200
        data = response.json()
        assert "session" in data
        assert "radar_metrics" in data
        assert "metric_details" in data
        assert "word_summaries" in data
        assert "grade_level" in data
        assert "recommended_book" in data

    async def test_get_report_not_found(self, client):
        """Returns 404 for invalid session."""
        response = await client.get(
            "/api/v1/mastery/session/invalid-id/report",
        )
        assert response.status_code == 404
