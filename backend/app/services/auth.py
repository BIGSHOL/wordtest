"""Authentication service."""
from app.core.timezone import now_kst
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.models.user import User
from app.models.auth_token import AuthToken
from app.schemas.auth import RegisterRequest
from app.core.security import get_password_hash, verify_password_async, create_refresh_token
from app.core.config import settings
from jose import jwt, JWTError


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, login_id: str, password: str) -> User | None:
    """Authenticate by email or username in a single query."""
    from sqlalchemy import or_
    result = await db.execute(
        select(User).where(
            or_(User.email == login_id, User.username == login_id)
        )
    )
    user = result.scalar_one_or_none()
    if not user:
        return None
    if not await verify_password_async(password, user.password_hash):
        return None
    return user


async def create_user(db: AsyncSession, user_in: RegisterRequest) -> User:
    user = User(
        username=user_in.username,
        password_hash=get_password_hash(user_in.password),
        name=user_in.name,
        role="teacher",
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


async def update_password(db: AsyncSession, user: User, new_password: str) -> User:
    user.password_hash = get_password_hash(new_password)
    await db.commit()
    await db.refresh(user)
    return user


async def create_auth_token(db: AsyncSession, user_id: str) -> str:
    """Create and store a refresh token in the database."""
    from datetime import timedelta
    token = create_refresh_token(subject=user_id)
    expires_at = now_kst() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    auth_token = AuthToken(
        user_id=user_id,
        refresh_token=token,
        expires_at=expires_at,
    )
    db.add(auth_token)
    await db.commit()
    return token


async def validate_refresh_token(db: AsyncSession, token: str) -> str | None:
    """Validate refresh token against DB and JWT. Returns user_id if valid."""
    from app.core.security import ALGORITHM
    # Check JWT validity
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "refresh":
            return None
        user_id = payload.get("sub")
        if not user_id:
            return None
    except JWTError:
        return None

    # Check token exists in DB
    result = await db.execute(
        select(AuthToken).where(AuthToken.refresh_token == token)
    )
    db_token = result.scalar_one_or_none()
    if not db_token:
        return None
    if db_token.expires_at < now_kst():
        await db.delete(db_token)
        await db.commit()
        return None

    return user_id


async def revoke_refresh_token(db: AsyncSession, token: str) -> bool:
    """Delete a specific refresh token from the database."""
    result = await db.execute(
        select(AuthToken).where(AuthToken.refresh_token == token)
    )
    db_token = result.scalar_one_or_none()
    if db_token:
        await db.delete(db_token)
        await db.commit()
        return True
    return False


