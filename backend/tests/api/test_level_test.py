"""Level test API tests."""
import pytest
import pytest_asyncio


@pytest.mark.asyncio
class TestStartTest:
    """POST /api/v1/tests/start - student starts a level test."""

    async def test_start_placement_test(
        self, client, student_headers, sample_words
    ):
        """Student can start a placement test."""
        response = await client.post(
            "/api/v1/tests/start",
            json={"test_type": "placement"},
            headers=student_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert "test_session" in data
        assert "questions" in data
        session = data["test_session"]
        assert session["test_type"] == "placement"
        assert session["total_questions"] > 0
        assert session["correct_count"] == 0
        assert session["completed_at"] is None
        # Questions should have choices
        questions = data["questions"]
        assert len(questions) > 0
        for q in questions:
            assert "word" in q
            assert "choices" in q
            assert len(q["choices"]) >= 4
            assert "question_order" in q

    async def test_start_test_unauthenticated(self, client):
        """Test start fails without authentication."""
        response = await client.post(
            "/api/v1/tests/start",
            json={"test_type": "placement"},
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestSubmitAnswer:
    """POST /api/v1/tests/:id/answer - student submits an answer."""

    async def test_submit_answer_success(
        self, client, student_headers, sample_words
    ):
        """Student can submit an answer to a test question."""
        # First start a test
        start_response = await client.post(
            "/api/v1/tests/start",
            json={"test_type": "placement"},
            headers=student_headers,
        )
        assert start_response.status_code == 201
        test_data = start_response.json()
        test_id = test_data["test_session"]["id"]
        question = test_data["questions"][0]

        # Submit an answer
        response = await client.post(
            f"/api/v1/tests/{test_id}/answer",
            json={
                "word_id": question["word"]["id"],
                "selected_answer": question["choices"][0],
                "question_order": question["question_order"],
            },
            headers=student_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "is_correct" in data
        assert "correct_answer" in data
        assert isinstance(data["is_correct"], bool)


@pytest.mark.asyncio
class TestGetTestResult:
    """GET /api/v1/tests/:id/result - get test result."""

    async def test_get_result_after_completion(
        self, client, student_headers, sample_words
    ):
        """Student can view test result after completing all questions."""
        # Start test
        start_response = await client.post(
            "/api/v1/tests/start",
            json={"test_type": "placement"},
            headers=student_headers,
        )
        assert start_response.status_code == 201
        test_data = start_response.json()
        test_id = test_data["test_session"]["id"]
        questions = test_data["questions"]

        # Answer all questions
        for q in questions:
            await client.post(
                f"/api/v1/tests/{test_id}/answer",
                json={
                    "word_id": q["word"]["id"],
                    "selected_answer": q["choices"][0],
                    "question_order": q["question_order"],
                },
                headers=student_headers,
            )

        # Get result
        response = await client.get(
            f"/api/v1/tests/{test_id}/result",
            headers=student_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "test_session" in data
        assert "answers" in data
        session = data["test_session"]
        assert session["completed_at"] is not None
        assert session["determined_level"] is not None
        assert isinstance(data["answers"], list)

    async def test_get_result_not_found(self, client, student_headers):
        """Getting result of nonexistent test returns 404."""
        response = await client.get(
            "/api/v1/tests/nonexistent-id/result",
            headers=student_headers,
        )
        assert response.status_code == 404


@pytest.mark.asyncio
class TestListTests:
    """GET /api/v1/tests - teacher views student test history."""

    async def test_list_tests_as_teacher(
        self, client, teacher_headers, student_user
    ):
        """Teacher can list test sessions for a student."""
        response = await client.get(
            f"/api/v1/tests?student_id={student_user.id}",
            headers=teacher_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert "tests" in data
        assert isinstance(data["tests"], list)
