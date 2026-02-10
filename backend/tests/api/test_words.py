"""Word management API tests."""
import pytest


@pytest.mark.asyncio
class TestListWords:
    """GET /api/v1/words - list words with filters."""

    async def test_list_words_success(self, client, teacher_headers, sample_words):
        """Teacher can list words."""
        response = await client.get("/api/v1/words", headers=teacher_headers)
        assert response.status_code == 200
        data = response.json()
        assert "words" in data
        assert "total" in data
        assert data["total"] >= 50  # 5 levels × 10 words

    async def test_list_words_filter_by_level(self, client, teacher_headers, sample_words):
        """Can filter words by level."""
        response = await client.get(
            "/api/v1/words?level=1",
            headers=teacher_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 10
        for word in data["words"]:
            assert word["level"] == 1

    async def test_list_words_search(self, client, teacher_headers, sample_words):
        """Can search words by english or korean."""
        response = await client.get(
            "/api/v1/words?search=word_1_",
            headers=teacher_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert data["total"] == 10  # word_1_0 through word_1_9

    async def test_list_words_pagination(self, client, teacher_headers, sample_words):
        """Can paginate word list."""
        response = await client.get(
            "/api/v1/words?skip=10&limit=5",
            headers=teacher_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert len(data["words"]) == 5

    async def test_list_words_student_can_access(self, client, student_headers, sample_words):
        """Students can also list words."""
        response = await client.get("/api/v1/words", headers=student_headers)
        assert response.status_code == 200


@pytest.mark.asyncio
class TestCreateWord:
    """POST /api/v1/words - create word."""

    async def test_create_word_success(self, client, teacher_headers):
        """Teacher can create a word."""
        response = await client.post(
            "/api/v1/words",
            json={
                "english": "apple",
                "korean": "사과",
                "level": 1,
                "category": "noun",
                "book_name": "Book 1",
                "lesson": "Lesson 1",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["english"] == "apple"
        assert data["korean"] == "사과"
        assert data["level"] == 1
        assert "id" in data

    async def test_create_word_minimal_fields(self, client, teacher_headers):
        """Can create word with only required fields."""
        response = await client.post(
            "/api/v1/words",
            json={
                "english": "banana",
                "korean": "바나나",
                "level": 2,
            },
            headers=teacher_headers,
        )
        assert response.status_code == 201
        data = response.json()
        assert data["english"] == "banana"

    async def test_create_word_student_forbidden(self, client, student_headers):
        """Students cannot create words."""
        response = await client.post(
            "/api/v1/words",
            json={
                "english": "test",
                "korean": "테스트",
                "level": 1,
            },
            headers=student_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestUpdateWord:
    """PATCH /api/v1/words/:id - update word."""

    async def test_update_word_success(self, client, teacher_headers, sample_words):
        """Teacher can update a word."""
        word_id = sample_words[0].id
        response = await client.patch(
            f"/api/v1/words/{word_id}",
            json={"korean": "수정된단어"},
            headers=teacher_headers,
        )
        assert response.status_code == 200
        data = response.json()
        assert data["korean"] == "수정된단어"

    async def test_update_word_not_found(self, client, teacher_headers):
        """Returns 404 for non-existent word."""
        response = await client.patch(
            "/api/v1/words/nonexistent",
            json={"korean": "test"},
            headers=teacher_headers,
        )
        assert response.status_code == 404

    async def test_update_word_student_forbidden(self, client, student_headers, sample_words):
        """Students cannot update words."""
        word_id = sample_words[0].id
        response = await client.patch(
            f"/api/v1/words/{word_id}",
            json={"korean": "test"},
            headers=student_headers,
        )
        assert response.status_code == 403


@pytest.mark.asyncio
class TestDeleteWord:
    """DELETE /api/v1/words/:id - delete word."""

    async def test_delete_word_success(self, client, teacher_headers, sample_words):
        """Teacher can delete a word."""
        word_id = sample_words[0].id
        response = await client.delete(
            f"/api/v1/words/{word_id}",
            headers=teacher_headers,
        )
        assert response.status_code == 204

    async def test_delete_word_not_found(self, client, teacher_headers):
        """Returns 404 for non-existent word."""
        response = await client.delete(
            "/api/v1/words/nonexistent",
            headers=teacher_headers,
        )
        assert response.status_code == 404

    async def test_delete_word_student_forbidden(self, client, student_headers, sample_words):
        """Students cannot delete words."""
        word_id = sample_words[0].id
        response = await client.delete(
            f"/api/v1/words/{word_id}",
            headers=student_headers,
        )
        assert response.status_code == 403
