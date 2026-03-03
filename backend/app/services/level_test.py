"""Level Test service -- atomic config + assignment creation.

Each student's registered grade determines their test range.
Students with the same grade share a TestConfig.
"""

from collections import defaultdict

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.learning_session import LearningSession
from app.core.level_test_presets import (
    normalize_grade,
    get_level_range_for_grade,
    get_book_range_for_grade,
    LEVEL_TEST_QUESTION_COUNT,
    LEVEL_TEST_ENGINE,
    LEVEL_TEST_PER_QUESTION_TIME,
    LEVEL_TEST_QUESTION_TYPES,
    LEVEL_TEST_QUESTION_TYPE_COUNTS,
)
from app.schemas.test_assignment import TestAssignmentResponse
from app.services.test_assignment import (
    build_test_config,
    create_assignments_for_config,
    _build_lesson_range,
)


async def create_level_test(
    db: AsyncSession,
    teacher_id: str,
    student_ids: list[str],
) -> list[dict]:
    """Atomic level test creation from existing students.

    Reads each student's grade, groups by normalized grade, creates
    per-grade TestConfigs with appropriate book ranges, and assigns codes.
    """
    # 1. Load students
    result = await db.execute(
        select(User).where(User.id.in_(student_ids), User.role == "student")
    )
    students = list(result.scalars().all())

    if not students:
        raise ValueError("선택된 학생을 찾을 수 없습니다.")

    # Validate & normalize grades
    missing: list[str] = []
    for s in students:
        if not s.grade or normalize_grade(s.grade) is None:
            missing.append(s.name)
    if missing:
        raise ValueError(
            f"학년 정보가 없는 학생: {', '.join(missing)}. "
            f"학생 관리에서 학년을 먼저 설정해주세요."
        )

    # 2. Group by normalized grade
    grade_groups: dict[str, list[User]] = defaultdict(list)
    for s in students:
        key = normalize_grade(s.grade) or s.grade
        grade_groups[key].append(s)

    # 3. Per-grade: create TestConfig + assignments
    all_results: list[dict] = []

    for grade, group in grade_groups.items():
        level_min, level_max = get_level_range_for_grade(grade)
        book_start, book_end = get_book_range_for_grade(grade)

        config = await build_test_config(
            db,
            teacher_id,
            engine=LEVEL_TEST_ENGINE,
            question_count=LEVEL_TEST_QUESTION_COUNT,
            per_question_time_seconds=LEVEL_TEST_PER_QUESTION_TIME,
            question_types=LEVEL_TEST_QUESTION_TYPES,
            book_name=book_start,
            book_name_end=book_end,
            lesson_range_start=None,
            lesson_range_end=None,
            total_time_override_seconds=None,
            question_type_counts=LEVEL_TEST_QUESTION_TYPE_COUNTS,
            is_active=True,
            name=f"레벨테스트 ({grade})",
        )

        ids = [str(s.id) for s in group]
        assignments = await create_assignments_for_config(
            db, teacher_id, config, ids, LEVEL_TEST_ENGINE,
        )

        student_map = {str(s.id): s for s in group}
        for a in assignments:
            student = student_map[str(a.student_id)]
            all_results.append({
                "student_name": student.name,
                "student_id": str(a.student_id),
                "test_code": a.test_code,
                "assignment_id": str(a.id),
                "grade": grade,
                "level_range": f"Lv{level_min}-{level_max}",
            })

    await db.commit()
    return all_results


async def list_level_test_assignments(
    db: AsyncSession,
    teacher_id: str,
) -> list[TestAssignmentResponse]:
    """List all level test assignments (visible to any teacher)."""
    result = await db.execute(
        select(TestAssignment, TestConfig, User)
        .join(TestConfig, TestAssignment.test_config_id == TestConfig.id)
        .join(User, TestAssignment.student_id == User.id)
        .where(
            TestConfig.name.like("레벨테스트%"),
        )
        .order_by(TestAssignment.assigned_at.desc())
    )
    rows = result.all()

    # Batch-fetch learning_session_ids for completed assignments
    assignment_ids = [a.id for a, _, _ in rows]
    ls_result = await db.execute(
        select(LearningSession.assignment_id, LearningSession.id)
        .where(
            LearningSession.assignment_id.in_(assignment_ids),
            LearningSession.completed_at != None,
        )
        .order_by(LearningSession.completed_at.desc())
    )
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
                test_config_id=assignment.test_config_id,
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
                total_time_override_seconds=config.total_time_override_seconds,
                question_type_counts=config.question_type_counts,
                test_session_id=assignment.test_session_id,
                learning_session_id=ls_map.get(assignment.id),
            )
        )
    return responses


async def delete_level_test_assignment(
    db: AsyncSession, assignment_id: str
) -> bool:
    """Delete a level-test assignment regardless of owning teacher."""
    result = await db.execute(
        select(TestAssignment)
        .join(TestConfig, TestAssignment.test_config_id == TestConfig.id)
        .where(
            TestAssignment.id == assignment_id,
            TestConfig.name.like("레벨테스트%"),
        )
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        return False

    await db.delete(assignment)
    await db.commit()
    return True
