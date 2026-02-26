"""Teacher management service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.user import User
from app.core.security import get_password_hash_async


async def create_teacher(
    db: AsyncSession,
    username: str,
    password: str,
    name: str,
    phone_number: str | None = None,
    school_name: str | None = None,
) -> User:
    teacher = User(
        username=username,
        password_hash=await get_password_hash_async(password),
        name=name,
        role="teacher",
        phone_number=phone_number,
        school_name=school_name,
    )
    db.add(teacher)
    await db.commit()
    await db.refresh(teacher)
    return teacher


async def list_all_teachers(db: AsyncSession) -> list[User]:
    """Return all teachers (excluding master)."""
    result = await db.execute(
        select(User).where(User.role == "teacher").order_by(User.name)
    )
    return list(result.scalars().all())


async def get_teacher_by_id(db: AsyncSession, teacher_id: str) -> User | None:
    result = await db.execute(
        select(User).where(User.id == teacher_id, User.role == "teacher")
    )
    return result.scalar_one_or_none()


async def update_teacher(
    db: AsyncSession,
    teacher: User,
    name: str | None = None,
    password: str | None = None,
    phone_number: str | None = None,
    school_name: str | None = None,
) -> User:
    if name is not None:
        teacher.name = name
    if password is not None:
        teacher.password_hash = await get_password_hash_async(password)
    if phone_number is not None:
        teacher.phone_number = phone_number
    if school_name is not None:
        teacher.school_name = school_name
    await db.commit()
    await db.refresh(teacher)
    return teacher


async def delete_teacher(db: AsyncSession, teacher: User) -> None:
    await db.delete(teacher)
    await db.commit()


async def get_student_count_by_teacher(db: AsyncSession, teacher_id: str) -> int:
    result = await db.execute(
        select(func.count()).select_from(User).where(
            User.teacher_id == teacher_id, User.role == "student"
        )
    )
    return result.scalar() or 0
