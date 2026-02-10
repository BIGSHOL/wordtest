"""Authentication API tests."""
import pytest
import pytest_asyncio


@pytest.mark.asyncio
class TestRegister:
    """POST /api/v1/auth/register - teacher registration."""

    async def test_register_success(self, client):
        """Teacher can register with username, password, name."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "newteacher01",
            "password": "securepass123",
            "name": "New Teacher",
        })
        assert response.status_code == 201
        data = response.json()
        assert data["username"] == "newteacher01"
        assert data["name"] == "New Teacher"
        assert data["role"] == "teacher"
        assert "id" in data
        assert "password_hash" not in data

    async def test_register_duplicate_username(self, client, teacher_user):
        """Registration fails with duplicate username."""
        response = await client.post("/api/v1/auth/register", json={
            "username": "st2000423",
            "password": "securepass123",
            "name": "Another Teacher",
        })
        assert response.status_code == 400


@pytest.mark.asyncio
class TestLogin:
    """POST /api/v1/auth/login/json - JSON login."""

    async def test_login_success(self, client, teacher_user):
        """Teacher can login with correct credentials."""
        response = await client.post("/api/v1/auth/login/json", json={
            "username": "st2000423",
            "password": "password123",
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    async def test_login_wrong_password(self, client, teacher_user):
        """Login fails with wrong password."""
        response = await client.post("/api/v1/auth/login/json", json={
            "username": "st2000423",
            "password": "wrongpassword",
        })
        assert response.status_code == 401

    async def test_login_nonexistent_user(self, client):
        """Login fails for nonexistent user."""
        response = await client.post("/api/v1/auth/login/json", json={
            "username": "nobody",
            "password": "password123",
        })
        assert response.status_code == 401


@pytest.mark.asyncio
class TestRefreshToken:
    """POST /api/v1/auth/refresh - token refresh."""

    async def test_refresh_token_success(self, client, teacher_user, teacher_refresh_token):
        """Valid refresh token returns new access + refresh token (rotation)."""
        response = await client.post("/api/v1/auth/refresh", json={
            "refresh_token": teacher_refresh_token,
        })
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["refresh_token"] != teacher_refresh_token  # rotated
        assert data["token_type"] == "bearer"


@pytest.mark.asyncio
class TestPasswordChange:
    """POST /api/v1/auth/password/change."""

    async def test_change_password_success(self, client, teacher_headers):
        """Authenticated user can change password."""
        response = await client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "password123",
                "new_password": "newpassword456",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 200

    async def test_change_password_wrong_current(self, client, teacher_headers):
        """Password change fails with wrong current password."""
        response = await client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "wrongpassword",
                "new_password": "newpassword456",
            },
            headers=teacher_headers,
        )
        assert response.status_code == 400

    async def test_change_password_unauthenticated(self, client):
        """Password change fails without authentication."""
        response = await client.post(
            "/api/v1/auth/password/change",
            json={
                "current_password": "password123",
                "new_password": "newpassword456",
            },
        )
        assert response.status_code == 401


@pytest.mark.asyncio
class TestGetMe:
    """GET /api/v1/users/me."""

    async def test_get_me_success(self, client, teacher_user, teacher_headers):
        """Authenticated user can get own profile."""
        response = await client.get("/api/v1/users/me", headers=teacher_headers)
        assert response.status_code == 200
        data = response.json()
        assert data["username"] == "st2000423"
        assert data["name"] == "PSS"
        assert data["role"] == "teacher"

    async def test_get_me_unauthenticated(self, client):
        """Profile access fails without authentication."""
        response = await client.get("/api/v1/users/me")
        assert response.status_code == 401
