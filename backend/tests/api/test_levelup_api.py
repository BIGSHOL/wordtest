"""Levelup engine API tests."""
import pytest


class TestCheckCode:
    """POST /api/v1/levelup/check-code"""

    async def test_check_levelup_code(self, client, levelup_assignment):
        """Returns engine_type=levelup for a levelup assignment."""
        resp = await client.post(
            "/api/v1/levelup/check-code",
            json={"test_code": "LU0001"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["engine_type"] == "levelup"
        assert data["status"] == "pending"
        assert data["assignment_id"] == levelup_assignment.id

    async def test_check_legacy_code(self, client, legacy_assignment):
        """Returns engine_type=legacy for a legacy assignment."""
        resp = await client.post(
            "/api/v1/levelup/check-code",
            json={"test_code": "LG0001"},
        )
        assert resp.status_code == 200
        assert resp.json()["engine_type"] == "legacy"

    async def test_check_invalid_code(self, client):
        """Returns 404 for non-existent code."""
        resp = await client.post(
            "/api/v1/levelup/check-code",
            json={"test_code": "INVALID"},
        )
        assert resp.status_code == 404


class TestStartByCode:
    """POST /api/v1/levelup/start-by-code"""

    async def test_start_success(self, client, levelup_assignment, sample_words):
        """Successfully starts a levelup session."""
        resp = await client.post(
            "/api/v1/levelup/start-by-code",
            json={"test_code": "LU0001"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "session_id" in data
        assert "access_token" in data
        assert "questions" in data
        assert data["student_id"] == levelup_assignment.student_id

    async def test_start_invalid_code(self, client):
        """400 for non-existent test code."""
        resp = await client.post(
            "/api/v1/levelup/start-by-code",
            json={"test_code": "NOPE99"},
        )
        assert resp.status_code == 400


class TestAnswerAndComplete:
    """POST /api/v1/levelup/{session_id}/answer and POST /api/v1/levelup/complete"""

    async def test_answer_and_complete_flow(self, client, levelup_assignment, sample_words):
        """Full flow: start → answer one question → complete."""
        # Start
        start_resp = await client.post(
            "/api/v1/levelup/start-by-code",
            json={"test_code": "LU0001"},
        )
        assert start_resp.status_code == 201
        data = start_resp.json()
        session_id = data["session_id"]
        questions = data["questions"]
        assert len(questions) > 0

        # Answer first question
        q = questions[0]
        answer_resp = await client.post(
            f"/api/v1/levelup/{session_id}/answer",
            json={
                "word_mastery_id": q["word_mastery_id"],
                "selected_answer": q["correct_answer"],
                "time_taken_seconds": 3.0,
                "question_type": q.get("question_type", "en_to_ko"),
            },
        )
        assert answer_resp.status_code == 200
        answer_data = answer_resp.json()
        assert "is_correct" in answer_data

        # Complete
        complete_resp = await client.post(
            "/api/v1/levelup/complete",
            json={
                "session_id": session_id,
                "final_level": 1,
                "best_combo": 1,
            },
        )
        assert complete_resp.status_code == 200
        assert "accuracy" in complete_resp.json()

    async def test_answer_invalid_session(self, client):
        """400 for non-existent session."""
        resp = await client.post(
            "/api/v1/levelup/nonexistent-session/answer",
            json={
                "word_mastery_id": "fake-id",
                "selected_answer": "test",
            },
        )
        assert resp.status_code == 400
