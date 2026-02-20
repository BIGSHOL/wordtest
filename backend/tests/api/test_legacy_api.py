"""Legacy test engine API tests."""
import pytest


class TestStartByCode:
    """POST /api/v1/legacy/start-by-code"""

    async def test_start_success(self, client, legacy_assignment, sample_words):
        """Successfully starts a legacy session with all questions at once."""
        resp = await client.post(
            "/api/v1/legacy/start-by-code",
            json={"test_code": "LG0001"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert "session_id" in data
        assert "access_token" in data
        assert "questions" in data
        assert len(data["questions"]) > 0
        assert data["student_id"] == legacy_assignment.student_id

    async def test_start_invalid_code(self, client):
        """400 for non-existent test code."""
        resp = await client.post(
            "/api/v1/legacy/start-by-code",
            json={"test_code": "INVALID"},
        )
        assert resp.status_code == 400


class TestAnswerAndComplete:
    """Full legacy test flow."""

    async def test_answer_correct(self, client, legacy_assignment, sample_words):
        """Submit a correct answer."""
        # Start session first
        start_resp = await client.post(
            "/api/v1/legacy/start-by-code",
            json={"test_code": "LG0001"},
        )
        assert start_resp.status_code == 201
        data = start_resp.json()
        session_id = data["session_id"]
        questions = data["questions"]
        assert len(questions) > 0

        # Answer first question correctly
        q = questions[0]
        answer_resp = await client.post(
            f"/api/v1/legacy/{session_id}/answer",
            json={
                "word_mastery_id": q["word_mastery_id"],
                "selected_answer": q["correct_answer"],
                "time_taken_seconds": 2.5,
                "question_type": q.get("question_type", "en_to_ko"),
            },
        )
        assert answer_resp.status_code == 200
        result = answer_resp.json()
        assert "is_correct" in result

    async def test_answer_wrong(self, client, legacy_assignment, sample_words):
        """Submit a wrong answer."""
        start_resp = await client.post(
            "/api/v1/legacy/start-by-code",
            json={"test_code": "LG0001"},
        )
        data = start_resp.json()
        session_id = data["session_id"]
        q = data["questions"][0]

        answer_resp = await client.post(
            f"/api/v1/legacy/{session_id}/answer",
            json={
                "word_mastery_id": q["word_mastery_id"],
                "selected_answer": "completely_wrong_answer_xyz",
                "time_taken_seconds": 5.0,
                "question_type": q.get("question_type", "en_to_ko"),
            },
        )
        assert answer_resp.status_code == 200
        result = answer_resp.json()
        assert "is_correct" in result

    async def test_complete_success(self, client, legacy_assignment, sample_words):
        """Complete a legacy session."""
        start_resp = await client.post(
            "/api/v1/legacy/start-by-code",
            json={"test_code": "LG0001"},
        )
        session_id = start_resp.json()["session_id"]

        complete_resp = await client.post(
            "/api/v1/legacy/complete",
            json={"session_id": session_id},
        )
        assert complete_resp.status_code == 200
        assert "accuracy" in complete_resp.json()

    async def test_complete_not_found(self, client):
        """400 for non-existent session."""
        resp = await client.post(
            "/api/v1/legacy/complete",
            json={"session_id": "nonexistent-id"},
        )
        assert resp.status_code == 400
