"""Stats API tests."""
import pytest


class TestDashboard:
    """GET /api/v1/stats/dashboard"""

    async def test_dashboard_empty(self, client, teacher_headers):
        """Dashboard with no students returns zero stats."""
        resp = await client.get("/api/v1/stats/dashboard", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_students"] == 0
        assert data["total_tests"] == 0

    async def test_dashboard_with_student(self, client, teacher_headers, student_user, sample_words):
        """Dashboard counts at least one student."""
        resp = await client.get("/api/v1/stats/dashboard", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_students"] >= 1
        assert data["total_words"] >= 1

    async def test_dashboard_forbidden_for_student(self, client, student_headers):
        """403 when student accesses dashboard."""
        resp = await client.get("/api/v1/stats/dashboard", headers=student_headers)
        assert resp.status_code == 403


class TestHistory:
    """GET /api/v1/stats/student/{student_id}/history"""

    async def test_student_own_history(self, client, student_headers, student_user):
        """Student accesses own history (empty but allowed)."""
        resp = await client.get(
            f"/api/v1/stats/student/{student_user.id}/history",
            headers=student_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "history" in data

    async def test_teacher_views_student_history(self, client, teacher_headers, student_user):
        """Teacher views their student's history."""
        resp = await client.get(
            f"/api/v1/stats/student/{student_user.id}/history",
            headers=teacher_headers,
        )
        assert resp.status_code == 200


class TestReport:
    """GET /api/v1/stats/student/{student_id}/report/{test_id}"""

    async def test_report_not_found(self, client, teacher_headers, student_user):
        """404 when test_id doesn't exist."""
        resp = await client.get(
            f"/api/v1/stats/student/{student_user.id}/report/nonexistent-id",
            headers=teacher_headers,
        )
        assert resp.status_code == 404
