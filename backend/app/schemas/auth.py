"""Authentication schemas."""
from pydantic import BaseModel, EmailStr


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenPayload(BaseModel):
    sub: str | None = None


class LoginRequest(BaseModel):
    email: str  # Accepts email or username
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str


class RefreshRequest(BaseModel):
    refresh_token: str


class PasswordChangeRequest(BaseModel):
    current_password: str
    new_password: str
