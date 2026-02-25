"""Test configs API tests."""
import uuid


class TestListConfigs:
    """GET /api/v1/test-configs"""

    async def test_list_teacher_configs(self, client, teacher_headers, test_config):
        """Teacher sees their own active configs with assignment count."""
        resp = await client.get("/api/v1/test-configs", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Test Config"
        # assignment_count should be present
        assert "assignment_count" in data[0]
        # book_name_end and question_type_counts should be present
        assert "book_name_end" in data[0]
        assert "question_type_counts" in data[0]

    async def test_list_only_active(self, client, teacher_headers, db_session, teacher_user):
        """Only active configs are returned."""
        from app.models.test_config import TestConfig

        # Create an inactive config
        inactive = TestConfig(
            id=str(uuid.uuid4()),
            teacher_id=teacher_user.id,
            name="Inactive Config",
            test_type="legacy",
            question_count=10,
            time_limit_seconds=150,
            is_active=False,
            book_name="Test Book",
            level_range_min=1,
            level_range_max=5,
        )
        db_session.add(inactive)
        await db_session.commit()

        resp = await client.get("/api/v1/test-configs", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        names = [c["name"] for c in data]
        assert "Inactive Config" not in names


class TestCreateConfig:
    """POST /api/v1/test-configs"""

    async def test_create_success(self, client, teacher_headers, sample_words):
        """Teacher creates a config with auto-generated name."""
        resp = await client.post(
            "/api/v1/test-configs",
            json={
                "engine": "levelup",
                "question_count": 30,
                "per_question_time_seconds": 10,
                "question_types": ["en_to_ko", "ko_to_en"],
                "book_name": "POWER VOCA 5000-01",
                "lesson_range_start": "Lesson 1",
                "lesson_range_end": "Lesson 2",
            },
            headers=teacher_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["question_count"] == 30
        assert data["time_limit_seconds"] == 300  # 10 * 30
        assert data["test_type"] == "levelup"
        assert data["assignment_count"] == 0
        # Name should be auto-generated
        assert "POWER VOCA 5000-01" in data["name"]

    async def test_create_with_question_type_counts(self, client, teacher_headers, sample_words):
        """Config with question_type_counts is persisted correctly."""
        resp = await client.post(
            "/api/v1/test-configs",
            json={
                "engine": "legacy",
                "question_count": 20,
                "per_question_time_seconds": 15,
                "question_types": ["en_to_ko", "ko_to_en", "listen_en"],
                "question_type_counts": {"en_to_ko": 8, "ko_to_en": 7, "listen_en": 5},
                "book_name": "POWER VOCA 5000-01",
                "lesson_range_start": "Lesson 1",
                "lesson_range_end": "Lesson 2",
            },
            headers=teacher_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["question_type_counts"] is not None
        assert data["test_type"] == "legacy"

    async def test_create_forbidden_for_student(self, client, student_headers):
        """403 when student tries to create."""
        resp = await client.post(
            "/api/v1/test-configs",
            json={
                "engine": "levelup",
                "question_count": 20,
                "per_question_time_seconds": 15,
                "book_name": "Test Book",
                "lesson_range_start": "L1",
                "lesson_range_end": "L2",
            },
            headers=student_headers,
        )
        assert resp.status_code == 403


class TestAssignToConfig:
    """POST /api/v1/test-configs/{config_id}/assign"""

    async def test_assign_students(self, client, teacher_headers, test_config, student_user):
        """Assign students to an existing config."""
        resp = await client.post(
            f"/api/v1/test-configs/{test_config.id}/assign",
            json={"student_ids": [student_user.id]},
            headers=teacher_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert len(data) == 1
        assert data[0]["student_id"] == student_user.id
        assert data[0]["test_code"]  # should have a code
        assert data[0]["status"] == "pending"

    async def test_assign_not_found(self, client, teacher_headers, student_user):
        """404 when config doesn't exist."""
        resp = await client.post(
            "/api/v1/test-configs/nonexistent-id/assign",
            json={"student_ids": [student_user.id]},
            headers=teacher_headers,
        )
        assert resp.status_code == 404

    async def test_assign_duplicate_student(self, client, teacher_headers, test_config, student_user):
        """409 when student is already assigned."""
        # First assignment
        resp = await client.post(
            f"/api/v1/test-configs/{test_config.id}/assign",
            json={"student_ids": [student_user.id]},
            headers=teacher_headers,
        )
        assert resp.status_code == 201

        # Duplicate assignment
        resp = await client.post(
            f"/api/v1/test-configs/{test_config.id}/assign",
            json={"student_ids": [student_user.id]},
            headers=teacher_headers,
        )
        assert resp.status_code == 409


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
        """Teacher deletes own config with no assignments."""
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

    async def test_delete_blocked_with_assignments(
        self, client, teacher_headers, test_config, student_user
    ):
        """409 when config has assignments."""
        # First, assign a student
        await client.post(
            f"/api/v1/test-configs/{test_config.id}/assign",
            json={"student_ids": [student_user.id]},
            headers=teacher_headers,
        )

        # Try to delete - should be blocked
        resp = await client.delete(
            f"/api/v1/test-configs/{test_config.id}",
            headers=teacher_headers,
        )
        assert resp.status_code == 409
        assert "assignment" in resp.json()["detail"].lower()
