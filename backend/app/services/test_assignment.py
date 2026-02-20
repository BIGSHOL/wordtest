"""Test assignment service."""
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.test_assignment import TestAssignment
from app.models.test_config import TestConfig
from app.models.user import User
from app.models.word import Word
from app.models.learning_session import LearningSession
from app.schemas.test_assignment import AssignTestRequest, TestAssignmentResponse
from app.services.test_config import generate_test_code
from app.core.timezone import now_kst


async def _get_book_level(db: AsyncSession, book_name: str) -> int:
    """Get the word level for a given book name."""
    result = await db.execute(
        select(func.min(Word.level)).where(Word.book_name == book_name)
    )
    return result.scalar() or 1


def _resolve_engine(test_type: str, mode: str) -> tuple[str, str]:
    """Resolve engine_type and assignment_type from test_type + question mode."""
    is_xp = test_type == "placement"
    engine_type = f"xp_{mode}" if is_xp else f"legacy_{mode}"
    if is_xp:
        assignment_type = "mastery"
    elif mode == "word":
        assignment_type = "legacy"
    else:
        assignment_type = "stage_test"
    return engine_type, assignment_type


def _mode_to_question_types(mode: str) -> str:
    """Map engine mode to legacy question_types string for TestConfig."""
    mapping = {
        "word": "word_meaning,meaning_word",
        "stage": "word_meaning,meaning_word,sentence_blank",
        "listen": "word_meaning",
    }
    return mapping.get(mode, "word_meaning")


def _build_lesson_range(
    book_name: str | None, book_end: str | None,
    lesson_start: str | None, lesson_end: str | None,
    is_cross_book: bool, level_min: int, level_max: int,
) -> str | None:
    """Build human-readable lesson range string."""
    if is_cross_book and lesson_start and lesson_end:
        return f"{book_name} {lesson_start} ~ {book_end} {lesson_end}"
    elif lesson_start and lesson_end:
        return f"{lesson_start}-{lesson_end}"
    elif level_min and level_max:
        if level_min == level_max:
            return f"Lv{level_min}"
        return f"Lv{level_min}-{level_max}"
    return None


async def assign_test(
    db: AsyncSession, teacher_id: str, data: AssignTestRequest
) -> list[TestAssignmentResponse]:
    """Create a TestConfig and assign it to multiple students with individual codes."""
    # Determine engine mode from question_types[0]
    mode = data.question_types[0] if data.question_types else "word"
    # Support legacy values: map old question type names to mode
    if mode in ("word_meaning", "meaning_word", "sentence_blank"):
        mode = "word"

    engine_type, assignment_type = _resolve_engine(data.test_type, mode)
    question_types_str = _mode_to_question_types(mode)

    time_limit = data.per_question_time_seconds * data.question_count
    is_placement = data.test_type == "placement"

    book_end = data.book_name_end or data.book_name
    is_cross_book = book_end != data.book_name

    # Derive level range from book names
    level_min = await _get_book_level(db, data.book_name) if data.book_name else 1
    level_max = await _get_book_level(db, book_end) if book_end else 15

    type_label = "적응형" if is_placement else "정기형"
    if is_cross_book:
        config_name = f"{data.book_name} {data.lesson_range_start} ~ {book_end} {data.lesson_range_end} ({type_label})"
    else:
        config_name = f"{data.book_name} {data.lesson_range_start}-{data.lesson_range_end} ({type_label})"

    config = TestConfig(
        teacher_id=teacher_id,
        name=config_name,
        test_code=None,
        test_type=data.test_type,
        question_count=data.question_count,
        time_limit_seconds=time_limit,
        is_active=True,
        book_name=data.book_name,
        book_name_end=book_end,
        level_range_min=level_min,
        level_range_max=level_max,
        per_question_time_seconds=data.per_question_time_seconds,
        question_types=question_types_str,
        lesson_range_start=data.lesson_range_start,
        lesson_range_end=data.lesson_range_end,
    )
    db.add(config)
    await db.flush()

    assignments = []
    for student_id in data.student_ids:
        individual_code = await generate_test_code(db)
        # Map test_type to assignment_type
        if data.test_type == "listening":
            a_type = "listening"
        elif data.test_type == "periodic":
            a_type = "mastery"
        else:
            a_type = "mastery"
        assignment = TestAssignment(
            test_config_id=config.id,
            student_id=student_id,
            teacher_id=teacher_id,
            test_code=individual_code,
            assignment_type=a_type,
            engine_type=engine_type,
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

    lesson_range = _build_lesson_range(
        data.book_name, book_end, data.lesson_range_start, data.lesson_range_end,
        is_cross_book, level_min, level_max,
    )

    responses = []
    for a in assignments:
        student = students_map.get(a.student_id)
        responses.append(
            TestAssignmentResponse(
                id=a.id,
                student_id=a.student_id,
                student_name=student.name if student else "",
                student_school=student.school_name if student else None,
                student_grade=student.grade if student else None,
                test_code=a.test_code,
                test_type=data.test_type,
                question_count=data.question_count,
                per_question_time_seconds=data.per_question_time_seconds,
                question_types=question_types_str,
                lesson_range=lesson_range,
                assignment_type=a.assignment_type,
                engine_type=a.engine_type,
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

    rows = result.all()

    # Batch-fetch learning_session_ids for mastery assignments
    assignment_ids = [a.id for a, _, _ in rows]
    ls_result = await db.execute(
        select(LearningSession.assignment_id, LearningSession.id)
        .where(
            LearningSession.assignment_id.in_(assignment_ids),
            LearningSession.completed_at != None,
        )
        .order_by(LearningSession.completed_at.desc())
    )
    # Take the latest completed session per assignment
    ls_map: dict[str, str] = {}
    for ls_assignment_id, ls_id in ls_result.all():
        if ls_assignment_id not in ls_map:
            ls_map[ls_assignment_id] = ls_id

    responses = []
    for assignment, config, student in rows:
        is_cross = config.book_name_end and config.book_name_end != config.book_name
        lesson_range = _build_lesson_range(
            config.book_name, config.book_name_end,
            config.lesson_range_start, config.lesson_range_end,
            is_cross, config.level_range_min, config.level_range_max,
        )

        responses.append(
            TestAssignmentResponse(
                id=assignment.id,
                student_id=assignment.student_id,
                student_name=student.name,
                student_school=student.school_name,
                student_grade=student.grade,
                test_code=assignment.test_code,
                test_type=config.test_type,
                question_count=config.question_count,
                per_question_time_seconds=config.per_question_time_seconds,
                question_types=config.question_types,
                lesson_range=lesson_range,
                assignment_type=assignment.assignment_type,
                engine_type=assignment.engine_type,
                status=assignment.status,
                assigned_at=assignment.assigned_at,
                test_session_id=assignment.test_session_id,
                learning_session_id=ls_map.get(assignment.id),
            )
        )
    return responses


async def reset_assignment(
    db: AsyncSession, assignment_id: str, teacher_id: str
) -> bool:
    """Reset a completed/in_progress assignment back to pending (keep test code)."""
    result = await db.execute(
        select(TestAssignment).where(
            TestAssignment.id == assignment_id,
            TestAssignment.teacher_id == teacher_id,
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False
    if assignment.status == "pending":
        return False

    assignment.status = "pending"
    assignment.test_session_id = None
    assignment.completed_at = None
    # Keep original test_code (no re-generation)
    await db.commit()
    return True


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
