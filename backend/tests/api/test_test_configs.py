"""Test configuration API tests."""
import pytest


@pytest.mark.asyncio
class TestListTestConfigs:
    """GET /api/v1/test-configs - list test configs."""

    async def test_list_test_configs_empty(self, client, teacher_headers):
        """Teacher can list test configs (empty initially)."""
        response = await client.get("/api/v1/test-configs", headers=teacher_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)

    async def test_list_test_configs_student_forbidden(self, client, student_headers):
        """Students cannot list test configs."""
        response = await client.get("/api/v1/test-configs", headers=student_headers)
        assert response.status_code == 403


@pytest.mark.asyncio
class TestCreateTestConfig:
    """POST /api/v1/test-configs - create test config."""

    async def test_create_test_config_success(self, client, teacher_headers):
        """Teacher can create a test config."""
        response = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "Placement Test",
                "test_type": "placement",
                "question_count": 20,
                "time_limit_seconds": 300,
                "level_range_min": 1,
                "level_range_max": 15,
            },
            headers=teacher_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Placement Test"
        assert data["test_type"] == "placement"
        assert data["question_count"] == 20
        assert "id" in data
        assert "teacher_id" in data

    async def test_create_test_config_with_defaults(self, client, teacher_headers):
        """Can create test config with minimal fields."""
        response = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "Quick Test",
                "test_type": "periodic",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["name"] == "Quick Test"
        assert data["question_count"] == 20  # default
        assert data["time_limit_seconds"] == 300  # default
        assert data["is_active"] is True  # default

    async def test_create_test_config_with_book_filter(self, client, teacher_headers):
        """Can create test config with book filter."""
        response = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "Book 1 Test",
                "test_type": "periodic",
                "book_name": "Book 1",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["book_name"] == "Book 1"

    async def test_create_test_config_student_forbidden(self, client, student_headers):
        """Students cannot create test configs."""
        response = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "Test",
                "test_type": "placement",
            },
            headers=student_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestUpdateTestConfig:
    """PATCH /api/v1/test-configs/:id - update test config."""

    async def test_update_test_config_success(self, client, teacher_headers):
        """Teacher can update their own test config."""
        # Create a config first
        create_response = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "Original Name",
                "test_type": "placement",
            },
            headers=teacher_headers,
        )
        config_id = create_response.json()["id"]

        # Update it
        response = await client.patch(
            f"/api/v1/test-configs/{config_id}",
            json={"name": "Updated Name", "question_count": 30},
            headers=teacher_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "Updated Name"
        assert data["question_count"] == 30

    async def test_update_test_config_not_found(self, client, teacher_headers):
        """Returns 404 for non-existent config."""
        response = await client.patch(
            "/api/v1/test-configs/nonexistent",
            json={"name": "test"},
            headers=teacher_headers,
        )
        assert response.status_code == 404

    async def test_update_test_config_student_forbidden(self, client, student_headers):
        """Students cannot update test configs."""
        response = await client.patch(
            "/api/v1/test-configs/anyid",
            json={"name": "test"},
            headers=student_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestDeleteTestConfig:
    """DELETE /api/v1/test-configs/:id - delete test config."""

    async def test_delete_test_config_success(self, client, teacher_headers):
        """Teacher can delete their own test config."""
        # Create a config first
        create_response = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "To Delete",
                "test_type": "placement",
            },
            headers=teacher_headers,
        )
        config_id = create_response.json()["id"]

        # Delete it
        response = await client.delete(
            f"/api/v1/test-configs/{config_id}",
            headers=teacher_headers,
        )
        assert response.status_code == 204

        # Verify it's gone
        list_response = await client.get("/api/v1/test-configs", headers=teacher_headers)
        configs = list_response.json()
        config_ids = [c["id"] for c in configs]
        assert config_id not in config_ids

    async def test_delete_test_config_not_found(self, client, teacher_headers):
        """Returns 404 for non-existent config."""
        response = await client.delete(
            "/api/v1/test-configs/nonexistent",
            headers=teacher_headers,
        )
        assert response.status_code == 404

    async def test_delete_test_config_student_forbidden(self, client, student_headers):
        """Students cannot delete test configs."""
        response = await client.delete(
            "/api/v1/test-configs/anyid",
            headers=student_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestTestConfigOwnership:
    """Test that teachers can only manage their own configs."""

    async def test_teacher_cannot_see_other_teacher_configs(
        self, client, teacher_headers, db_session
    ):
        """Teachers only see their own configs."""
        from app.models.user import User
        from app.models.test_config import TestConfig
        from app.core.security import get_password_hash, create_access_token

        # Create another teacher
        other_teacher = User(
            username="teacher02",
            password_hash=get_password_hash("password123"),
            name="Other Teacher",
            role="teacher",
        )
        db_session.add(other_teacher)
        await db_session.commit()
        await db_session.refresh(other_teacher)

        # Create a config for the other teacher
        other_config = TestConfig(
            teacher_id=other_teacher.id,
            name="Other Teacher Config",
            test_type="placement",
            test_code="OTH001",
        )
        db_session.add(other_config)
        await db_session.commit()

        # First teacher should not see the other teacher's config
        response = await client.get("/api/v1/test-configs", headers=teacher_headers)
        configs = response.json()
        config_names = [c["name"] for c in configs]
        assert "Other Teacher Config" not in config_names
