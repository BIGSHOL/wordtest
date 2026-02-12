"""Student management service."""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models.user import User
from app.core.security import get_password_hash_async


async def get_student_by_username(db: AsyncSession, username: str) -> User | None:
    result = await db.execute(select(User).where(User.username == username))
    return result.scalar_one_or_none()


async def create_student(
    db: AsyncSession,
    username: str,
    password: str,
    name: str,
    teacher_id: str,
    phone_number: str | None = None,
) -> User:
    student = User(
        username=username,
        password_hash=await get_password_hash_async(password),
        name=name,
        role="student",
        teacher_id=teacher_id,
        phone_number=phone_number,
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
    db: AsyncSession,
    student: User,
    name: str | None = None,
    password: str | None = None,
    phone_number: str | None = None,
    school_name: str | None = None,
    grade: str | None = None,
) -> User:
    if name is not None:
        student.name = name
    if password is not None:
        student.password_hash = await get_password_hash_async(password)
    if phone_number is not None:
        student.phone_number = phone_number
    if school_name is not None:
        student.school_name = school_name
    if grade is not None:
        student.grade = grade
    await db.commit()
    await db.refresh(student)
    return student


async def delete_student(db: AsyncSession, student: User) -> None:
    await db.delete(student)
    await db.commit()
