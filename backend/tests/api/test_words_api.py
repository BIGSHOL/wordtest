"""Words API tests."""
import pytest


class TestListWords:
    """GET /api/v1/words"""

    async def test_list_all(self, client, teacher_headers, sample_words):
        """List words with default pagination (limit=50)."""
        resp = await client.get("/api/v1/words", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "words" in data
        assert "total" in data
        assert data["total"] == 50
        assert len(data["words"]) == 50

    async def test_list_by_level(self, client, teacher_headers, sample_words):
        """Filter by level."""
        resp = await client.get("/api/v1/words?level=1", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 10
        for w in data["words"]:
            assert w["level"] == 1

    async def test_list_search(self, client, teacher_headers, sample_words):
        """Search by english word."""
        resp = await client.get("/api/v1/words?search=dog", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1

    async def test_list_unauthorized(self, client, sample_words):
        """Unauthorized access should fail."""
        resp = await client.get("/api/v1/words")
        assert resp.status_code == 401


class TestBooks:
    """GET /api/v1/words/books and /lessons"""

    async def test_books_list(self, client, teacher_headers, sample_words):
        """Get distinct book names."""
        resp = await client.get("/api/v1/words/books", headers=teacher_headers)
        assert resp.status_code == 200
        data = resp.json()
        assert "POWER VOCA 5000-01" in data

    async def test_lessons_list(self, client, teacher_headers, sample_words):
        """Get lessons for a book."""
        resp = await client.get(
            "/api/v1/words/lessons?book_name=POWER VOCA 5000-01",
            headers=teacher_headers,
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) > 0
        assert "lesson" in data[0]
        assert "word_count" in data[0]

    async def test_lessons_unauthorized(self, client, sample_words):
        """Unauthorized access should fail."""
        resp = await client.get("/api/v1/words/lessons?book_name=POWER VOCA 5000-01")
        assert resp.status_code == 401


class TestWordCRUD:
    """POST/PATCH/DELETE /api/v1/words"""

    async def test_create_word(self, client, teacher_headers):
        """Teacher creates a word."""
        resp = await client.post(
            "/api/v1/words",
            json={
                "english": "galaxy",
                "korean": "은하",
                "level": 3,
                "book_name": "TestBook",
                "lesson": "Lesson 1",
            },
            headers=teacher_headers,
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["english"] == "galaxy"
        assert data["korean"] == "은하"

    async def test_update_word(self, client, teacher_headers, sample_words):
        """Teacher updates a word."""
        word_id = sample_words[0].id
        resp = await client.patch(
            f"/api/v1/words/{word_id}",
            json={"korean": "강아지"},
            headers=teacher_headers,
        )
        assert resp.status_code == 200
        assert resp.json()["korean"] == "강아지"

    async def test_delete_word(self, client, teacher_headers, sample_words):
        """Teacher deletes a word."""
        word_id = sample_words[0].id
        resp = await client.delete(
            f"/api/v1/words/{word_id}",
            headers=teacher_headers,
        )
        assert resp.status_code == 204

    async def test_student_cannot_create(self, client, student_headers):
        """Student cannot create words."""
        resp = await client.post(
            "/api/v1/words",
            json={
                "english": "test",
                "korean": "테스트",
                "level": 1,
                "book_name": "Book",
                "lesson": "Lesson 1",
            },
            headers=student_headers,
        )
        assert resp.status_code == 403

    async def test_student_cannot_update(self, client, student_headers, sample_words):
        """Student cannot update words."""
        word_id = sample_words[0].id
        resp = await client.patch(
            f"/api/v1/words/{word_id}",
            json={"korean": "수정"},
            headers=student_headers,
        )
        assert resp.status_code == 403

    async def test_student_cannot_delete(self, client, student_headers, sample_words):
        """Student cannot delete words."""
        word_id = sample_words[0].id
        resp = await client.delete(
            f"/api/v1/words/{word_id}",
            headers=student_headers,
        )
        assert resp.status_code == 403
