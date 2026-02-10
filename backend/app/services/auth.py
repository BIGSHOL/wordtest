"""Authentication service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.schemas.auth import RegisterRequest
from app.core.security import get_password_hash, verify_password


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalar_one_or_none()


async def get_user_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def authenticate_user(db: AsyncSession, email: str, password: str) -> User | None:
    """Authenticate by email or username."""
    user = await get_user_by_email(db, email)
    if not user:
        user = await get_user_by_username(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


async def create_user(db: AsyncSession, user_in: RegisterRequest) -> User:
    user = User(
        email=user_in.email,
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
