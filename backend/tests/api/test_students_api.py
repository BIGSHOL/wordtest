"""Students API tests."""
import pytest


class TestCreateStudent:
    """POST /api/v1/students"""

    async def test_create_success(self, client, teacher_headers):
        """Teacher creates a student successfully."""
        resp = await client.post(
            "/api/v1/students",
            json={"username": "newstudent01", "password": "pass1234", "name": "New Student"},
            headers=teacher_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newstudent01"
        assert data["role"] == "student"

    async def test_create_duplicate_username(self, client, teacher_headers, student_user):
        """400 when username already taken."""
        resp = await client.post(
            "/api/v1/students",
            json={"username": "student01", "password": "pass1234", "name": "Dup"},
            headers=teacher_headers,
        )
        assert resp.status_code == 400

    async def test_create_forbidden_for_student(self, client, student_headers):
        """403 when a student tries to create a student."""
        resp = await client.post(
            "/api/v1/students",
            json={"username": "hack", "password": "pass", "name": "Hack"},
            headers=student_headers,
        )
        assert resp.status_code == 403


class TestListStudents:
    """GET /api/v1/students"""

    async def test_list_empty(self, client, teacher_headers):
        """Empty list when no students exist."""
        resp = await client.get("/api/v1/students", headers=teacher_headers)
        assert resp.status_code == 200
        assert resp.json() == []

    async def test_list_with_students(self, client, teacher_headers, student_user):
        """List returns the teacher's students."""
        resp = await client.get("/api/v1/students", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["username"] == "student01"


class TestUpdateStudent:
    """PATCH /api/v1/students/{student_id}"""

    async def test_update_name(self, client, teacher_headers, student_user):
        """Teacher updates student name."""
        resp = await client.patch(
            f"/api/v1/students/{student_user.id}",
            json={"name": "Updated Name"},
            headers=teacher_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"


class TestDeleteStudent:
    """DELETE /api/v1/students/{student_id}"""

    async def test_delete_success(self, client, teacher_headers, student_user):
        """Teacher deletes a student."""
        resp = await client.delete(
            f"/api/v1/students/{student_user.id}",
            headers=teacher_headers,
        )
        assert resp.status_code == 204

    async def test_delete_not_found(self, client, teacher_headers):
        """404 for non-existent student."""
        resp = await client.delete(
            "/api/v1/students/nonexistent-id",
            headers=teacher_headers,
        )
        assert resp.status_code == 404
