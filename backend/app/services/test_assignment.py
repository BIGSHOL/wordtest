"""Test assignment service."""
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig
from app.models.user import User
from app.schemas.test_assignment import AssignTestRequest, TestAssignmentResponse
from app.services.test_config import generate_test_code
from app.core.timezone import now_kst


async def assign_test(
    db: AsyncSession, teacher_id: str, data: AssignTestRequest
) -> list[TestAssignmentResponse]:
    """Create a TestConfig and assign it to multiple students."""
    test_code = await generate_test_code(db)
    question_types_str = ",".join(data.question_types)
    time_limit = data.per_question_time_seconds * data.question_count

    config = TestConfig(
        teacher_id=teacher_id,
        name=f"{data.book_name} {data.lesson_range_start}-{data.lesson_range_end}",
        test_code=test_code,
        test_type="periodic",
        question_count=data.question_count,
        time_limit_seconds=time_limit,
        is_active=True,
        book_name=data.book_name,
        per_question_time_seconds=data.per_question_time_seconds,
        question_types=question_types_str,
        lesson_range_start=data.lesson_range_start,
        lesson_range_end=data.lesson_range_end,
    )
    db.add(config)
    await db.flush()

    assignments = []
    for student_id in data.student_ids:
        assignment = TestAssignment(
            test_config_id=config.id,
            student_id=student_id,
            teacher_id=teacher_id,
        )
        db.add(assignment)
        assignments.append(assignment)

    await db.commit()

    # Refresh to get IDs
    for a in assignments:
        await db.refresh(a)

    # Build response with student info
    student_result = await db.execute(
        select(User).where(User.id.in_(data.student_ids))
    )
    students_map = {s.id: s for s in student_result.scalars().all()}

    lesson_range = f"{data.lesson_range_start}-{data.lesson_range_end}"

    responses = []
    for a in assignments:
        student = students_map.get(a.student_id)
        responses.append(
            TestAssignmentResponse(
                id=a.id,
                student_name=student.name if student else "",
                student_school=student.school_name if student else None,
                student_grade=student.grade if student else None,
                test_code=test_code,
                question_count=data.question_count,
                per_question_time_seconds=data.per_question_time_seconds,
                question_types=question_types_str,
                lesson_range=lesson_range,
                status=a.status,
                assigned_at=a.assigned_at,
                test_session_id=a.test_session_id,
            )
        )
    return responses


async def list_assignments_by_teacher(
    db: AsyncSession, teacher_id: str
) -> list[TestAssignmentResponse]:
    """List all assignments created by a teacher with enriched data."""
    result = await db.execute(
        select(TestAssignment, TestConfig, User)
        .join(TestConfig, TestAssignment.test_config_id == TestConfig.id)
        .join(User, TestAssignment.student_id == User.id)
        .where(TestAssignment.teacher_id == teacher_id)
        .order_by(TestAssignment.assigned_at.desc())
    )

    responses = []
    for assignment, config, student in result.all():
        lesson_range = None
        if config.lesson_range_start and config.lesson_range_end:
            lesson_range = f"{config.lesson_range_start}-{config.lesson_range_end}"

        responses.append(
            TestAssignmentResponse(
                id=assignment.id,
                student_name=student.name,
                student_school=student.school_name,
                student_grade=student.grade,
                test_code=config.test_code,
                question_count=config.question_count,
                per_question_time_seconds=config.per_question_time_seconds,
                question_types=config.question_types,
                lesson_range=lesson_range,
                status=assignment.status,
                assigned_at=assignment.assigned_at,
                test_session_id=assignment.test_session_id,
            )
        )
    return responses


async def delete_assignment(
    db: AsyncSession, assignment_id: str, teacher_id: str
) -> bool:
    """Delete a pending assignment. Returns True if deleted."""
    result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.id == assignment_id,
            TestAssignment.teacher_id == teacher_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False
    if assignment.status != "pending":
        return False

    await db.delete(assignment)
    await db.commit()
    return True
