"""Test configs API tests."""


class TestListConfigs:
    """GET /api/v1/test-configs"""

    async def test_list_teacher_configs(self, client, teacher_headers, test_config):
        """Teacher sees their own configs."""
        resp = await client.get("/api/v1/test-configs", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test Config"


class TestCreateConfig:
    """POST /api/v1/test-configs"""

    async def test_create_success(self, client, teacher_headers):
        """Teacher creates a new test config."""
        resp = await client.post(
            "/api/v1/test-configs",
            json={
                "name": "New Config",
                "test_type": "mastery",
                "question_count": 30,
                "time_limit_seconds": 600,
            },
            headers=teacher_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "New Config"
        assert data["question_count"] == 30

    async def test_create_forbidden_for_student(self, client, student_headers):
        """403 when student tries to create."""
        resp = await client.post(
            "/api/v1/test-configs",
            json={"name": "Hack", "test_type": "mastery"},
            headers=student_headers,
        )
        assert resp.status_code == 403


class TestUpdateConfig:
    """PATCH /api/v1/test-configs/{config_id}"""

    async def test_update_success(self, client, teacher_headers, test_config):
        """Teacher updates own config."""
        resp = await client.patch(
            f"/api/v1/test-configs/{test_config.id}",
            json={"name": "Updated Name"},
            headers=teacher_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Updated Name"


class TestDeleteConfig:
    """DELETE /api/v1/test-configs/{config_id}"""

    async def test_delete_success(self, client, teacher_headers, test_config):
        """Teacher deletes own config."""
        resp = await client.delete(
            f"/api/v1/test-configs/{test_config.id}",
            headers=teacher_headers,
        )
        assert resp.status_code == 204

    async def test_delete_not_found(self, client, teacher_headers):
        """404 for non-existent config."""
        resp = await client.delete(
            "/api/v1/test-configs/nonexistent-id",
            headers=teacher_headers,
        )
        assert resp.status_code == 404
