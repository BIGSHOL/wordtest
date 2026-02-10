"""Statistics API tests."""
import pytest
from datetime import datetime


@pytest.mark.asyncio
class TestDashboardStats:
    """GET /api/v1/stats/dashboard - get dashboard statistics."""

    async def test_dashboard_stats_success(
        self, client, teacher_headers, student_user, sample_words
    ):
        """Teacher can get dashboard stats."""
        response = await client.get(
            "/api/v1/stats/dashboard",
            headers=teacher_headers
        )
        assert response.status_code == 200
        data = response.json()

        # Check all required fields
        assert "total_students" in data
        assert "total_words" in data
        assert "total_tests" in data
        assert "avg_score" in data
        assert "avg_time_seconds" in data
        assert "level_distribution" in data
        assert "recent_tests" in data
        assert "weekly_test_count" in data
        assert "score_trend" in data

        # Verify data types
        assert isinstance(data["total_students"], int)
        assert isinstance(data["total_words"], int)
        assert isinstance(data["total_tests"], int)
        assert isinstance(data["avg_score"], (int, float))
        assert isinstance(data["level_distribution"], list)
        assert isinstance(data["recent_tests"], list)

    async def test_dashboard_stats_with_test_data(
        self, client, teacher_headers, student_user, sample_words, db_session
    ):
        """Dashboard stats include test session data."""
        from app.models.test_session import TestSession

        # Create a completed test session
        test_session = TestSession(
            student_id=student_user.id,
            test_type="placement",
            total_questions=20,
            correct_count=15,
            determined_level=3,
            score=75,
            completed_at=datetime.utcnow(),
        )
        db_session.add(test_session)
        await db_session.commit()

        response = await client.get(
            "/api/v1/stats/dashboard",
            headers=teacher_headers
        )
        assert response.status_code == 200
        data = response.json()

        assert data["total_tests"] >= 1
        assert data["avg_score"] > 0
        assert len(data["recent_tests"]) >= 1

        # Check recent test structure
        recent_test = data["recent_tests"][0]
        assert "id" in recent_test
        assert "student_name" in recent_test
        assert "score" in recent_test
        assert "determined_level" in recent_test

    async def test_dashboard_stats_student_forbidden(self, client, student_headers):
        """Students cannot access dashboard stats."""
        response = await client.get(
            "/api/v1/stats/dashboard",
            headers=student_headers
        )
        assert response.status_code == 403

    async def test_dashboard_stats_no_students(
        self, client, teacher_headers, sample_words
    ):
        """Dashboard works even with no students."""
        response = await client.get(
            "/api/v1/stats/dashboard",
            headers=teacher_headers
        )
        assert response.status_code == 200
        data = response.json()

        # Should have word count but no student/test data
        assert data["total_words"] >= 50
        # May or may not have students depending on fixture order

    async def test_dashboard_stats_unauthenticated(self, client):
        """Unauthenticated users cannot access stats."""
        response = await client.get("/api/v1/stats/dashboard")
        assert response.status_code == 401
