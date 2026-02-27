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
    school_name: str | None = None,
    grade: str | None = None,
) -> User:
    student = User(
        username=username,
        password_hash=await get_password_hash_async(password),
        name=name,
        role="student",
        teacher_id=teacher_id,
        phone_number=phone_number,
        school_name=school_name,
        grade=grade,
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


async def list_all_students(db: AsyncSession) -> list[User]:
    """Return all students regardless of teacher."""
    result = await db.execute(
        select(User).where(User.role == "student").order_by(User.name)
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
    username: str | None = None,
    name: str | None = None,
    password: str | None = None,
    phone_number: str | None = None,
    school_name: str | None = None,
    grade: str | None = None,
) -> User:
    if username is not None:
        student.username = username
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


async def delete_students_batch(
    db: AsyncSession, student_ids: list[str]
) -> int:
    """Delete multiple students at once. Returns the number deleted."""
    result = await db.execute(
        select(User).where(User.id.in_(student_ids), User.role == "student")
    )
    students = list(result.scalars().all())
    for student in students:
        await db.delete(student)
    await db.commit()
    return len(students)
