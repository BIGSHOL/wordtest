"""Student management API tests (RED - expected to fail until implementation)."""
import pytest
import pytest_asyncio


@pytest.mark.asyncio
class TestCreateStudent:
    """POST /api/v1/students - teacher creates student account."""

    async def test_create_student_success(self, client, teacher_headers):
        """Teacher can create a student account."""
        response = await client.post(
            "/api/v1/students",
            json={
                "username": "newstudent01",
                "password": "studentpass123",
                "name": "New Student",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newstudent01"
        assert data["name"] == "New Student"
        assert data["role"] == "student"
        assert "password_hash" not in data

    async def test_create_student_duplicate_username(
        self, client, teacher_headers, student_user
    ):
        """Creating student with duplicate username fails."""
        response = await client.post(
            "/api/v1/students",
            json={
                "username": "test01",
                "password": "studentpass123",
                "name": "Duplicate Student",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 400

    async def test_create_student_unauthenticated(self, client):
        """Student creation fails without authentication."""
        response = await client.post(
            "/api/v1/students",
            json={
                "username": "newstudent",
                "password": "studentpass123",
                "name": "Unauth Student",
            },
        )
        assert response.status_code == 401

    async def test_create_student_by_student_forbidden(
        self, client, student_headers
    ):
        """Students cannot create other student accounts."""
        response = await client.post(
            "/api/v1/students",
            json={
                "username": "anotherstudent",
                "password": "studentpass123",
                "name": "Another Student",
            },
            headers=student_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestListStudents:
    """GET /api/v1/students - teacher lists students."""

    async def test_list_students_success(
        self, client, teacher_headers, student_user
    ):
        """Teacher can list their students."""
        response = await client.get("/api/v1/students", headers=teacher_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["role"] == "student"

    async def test_list_students_by_student_forbidden(
        self, client, student_headers
    ):
        """Students cannot list other students."""
        response = await client.get("/api/v1/students", headers=student_headers)
        assert response.status_code == 403


@pytest.mark.asyncio
class TestUpdateStudent:
    """PATCH /api/v1/students/:id - teacher updates student."""

    async def test_update_student_name(
        self, client, teacher_headers, student_user
    ):
        """Teacher can update a student's name."""
        response = await client.patch(
            f"/api/v1/students/{student_user.id}",
            json={"name": "Updated Name"},
            headers=teacher_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"

    async def test_update_student_password(
        self, client, teacher_headers, student_user
    ):
        """Teacher can reset a student's password."""
        response = await client.patch(
            f"/api/v1/students/{student_user.id}",
            json={"password": "newstudentpass"},
            headers=teacher_headers,
        )
        assert response.status_code == 200


@pytest.mark.asyncio
class TestDeleteStudent:
    """DELETE /api/v1/students/:id - teacher deletes student."""

    async def test_delete_student_success(
        self, client, teacher_headers, student_user
    ):
        """Teacher can delete a student account."""
        response = await client.delete(
            f"/api/v1/students/{student_user.id}",
            headers=teacher_headers,
        )
        assert response.status_code == 204
