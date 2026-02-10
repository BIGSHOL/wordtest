"""Authentication schemas."""
from pydantic import BaseModel


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(Token):
    user: "UserResponse"


from app.schemas.user import UserResponse  # noqa: E402

LoginResponse.model_rebuild()


class TokenPayload(BaseModel):
    sub: str | None = None


class LoginRequest(BaseModel):
    username: str
    password: str


class RegisterRequest(BaseModel):
    username: str
    password: str
    name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
