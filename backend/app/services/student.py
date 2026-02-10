"""Student management service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.security import get_password_hash


async def get_student_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_student(
    db: AsyncSession, username: str, password: str, name: str, teacher_id: str
) -> User:
    student = User(
        username=username,
        password_hash=get_password_hash(password),
        name=name,
        role="student",
        teacher_id=teacher_id,
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)
    return student


async def list_students_by_teacher(db: AsyncSession, teacher_id: str) -> list[User]:
    result = await db.execute(
        select(User).where(User.teacher_id == teacher_id, User.role == "student")
    )
    return list(result.scalars().all())


async def get_student_by_id(db: AsyncSession, student_id: str) -> User | None:
    result = await db.execute(
        select(User).where(User.id == student_id, User.role == "student")
    )
    return result.scalar_one_or_none()


async def update_student(
    db: AsyncSession, student: User, name: str | None = None, password: str | None = None
) -> User:
    if name is not None:
        student.name = name
    if password is not None:
        student.password_hash = get_password_hash(password)
    await db.commit()
    await db.refresh(student)
    return student


async def delete_student(db: AsyncSession, student: User) -> None:
    await db.delete(student)
    await db.commit()
