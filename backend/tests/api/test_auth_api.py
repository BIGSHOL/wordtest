"""Auth API tests."""
import pytest


class TestRegister:
    """POST /api/v1/auth/register"""

    async def test_register_success(self, client):
        """Register a new user successfully."""
        resp = await client.post(
            "/api/v1/auth/register",
            json={"username": "newuser01", "password": "pass1234", "name": "New User"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["username"] == "newuser01"
        assert data["name"] == "New User"
        assert "id" in data

    async def test_register_duplicate_username(self, client, teacher_user):
        """400 when username already exists."""
        resp = await client.post(
            "/api/v1/auth/register",
            json={"username": "teacher01", "password": "pass1234", "name": "Dup"},
        )
        assert resp.status_code == 400


class TestLogin:
    """POST /api/v1/auth/login/json"""

    async def test_login_success(self, client, teacher_user):
        """Login with correct credentials."""
        resp = await client.post(
            "/api/v1/auth/login/json",
            json={"username": "teacher01", "password": "pass1234"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["username"] == "teacher01"

    async def test_login_wrong_password(self, client, teacher_user):
        """401 for wrong password."""
        resp = await client.post(
            "/api/v1/auth/login/json",
            json={"username": "teacher01", "password": "wrong_pass"},
        )
        assert resp.status_code == 401

    async def test_login_nonexistent_user(self, client):
        """401 for non-existent user."""
        resp = await client.post(
            "/api/v1/auth/login/json",
            json={"username": "ghost_user", "password": "pass1234"},
        )
        assert resp.status_code == 401


class TestRefresh:
    """POST /api/v1/auth/refresh"""

    async def test_refresh_success(self, client, teacher_user):
        """Refresh token rotation works."""
        # First login to get a refresh token
        login_resp = await client.post(
            "/api/v1/auth/login/json",
            json={"username": "teacher01", "password": "pass1234"},
        )
        refresh_token = login_resp.json()["refresh_token"]

        # Use refresh token
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": refresh_token},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data

    async def test_refresh_invalid_token(self, client):
        """401 for invalid refresh token."""
        resp = await client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": "invalid-token"},
        )
        assert resp.status_code == 401


class TestPasswordChange:
    """POST /api/v1/auth/password/change"""

    async def test_change_success(self, client, teacher_user, teacher_headers):
        """Successfully change password."""
        resp = await client.post(
            "/api/v1/auth/password/change",
            json={"current_password": "pass1234", "new_password": "newpass5678"},
            headers=teacher_headers,
        )
        assert resp.status_code == 200

    async def test_change_wrong_current(self, client, teacher_user, teacher_headers):
        """400 when current password is wrong."""
        resp = await client.post(
            "/api/v1/auth/password/change",
            json={"current_password": "wrong_pass", "new_password": "newpass5678"},
            headers=teacher_headers,
        )
        assert resp.status_code == 400


class TestGetMe:
    """Verify authenticated access works."""

    async def test_unauthenticated_access(self, client):
        """401 when no auth header provided for protected endpoint."""
        # Use password/change as a proxy for any auth-required endpoint
        resp = await client.post(
            "/api/v1/auth/password/change",
            json={"current_password": "x", "new_password": "y"},
        )
        assert resp.status_code == 401
