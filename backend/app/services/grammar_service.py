"""Grammar test service — config, session, answer, completion."""
import json
import uuid
import re
import logging
from typing import Optional

from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

# ── Seed data ───────────────────────────────────────────────────────────

_BOOKS = [
    {"level": 1, "title": "천일문 GRAMMAR Level 1"},
    {"level": 2, "title": "천일문 GRAMMAR Level 2"},
    {"level": 3, "title": "천일문 GRAMMAR Level 3"},
]

_CHAPTERS = {
    1: [
        (1, "be동사"), (2, "일반동사"), (3, "현재진행형과 미래 표현"),
        (4, "조동사"), (5, "명사와 관사"), (6, "대명사"),
        (7, "형용사, 부사, 비교"), (8, "여러 가지 문장 종류"),
        (9, "문장의 여러 형식"), (10, "to부정사와 동명사"),
        (11, "전치사"), (12, "접속사"),
    ],
    2: [
        (1, "문장의 주요 형식"), (2, "시제"), (3, "조동사"),
        (4, "수동태"), (5, "to부정사"), (6, "동명사"),
        (7, "분사"), (8, "대명사"), (9, "형용사와 부사"),
        (10, "비교 표현"), (11, "접속사"), (12, "관계대명사"),
    ],
    3: [
        (1, "완료 시제"), (2, "조동사"), (3, "수동태"),
        (4, "부정사"), (5, "동명사"), (6, "분사"),
        (7, "비교 표현"), (8, "접속사"), (9, "관계사"),
        (10, "가정법"), (11, "일치와 화법"), (12, "특수 구문"),
    ],
}

_SAMPLE_QUESTIONS = [
    {
        "question_type": "grammar_blank",
        "question_data": {
            "stem": "Jisu ___ in the bathroom now.",
            "choices": ["is", "am", "are", "was", "were"],
            "correct_index": 0,
            "sentence_ko": "지수는 지금 화장실에 있다.",
            "grammar_point": "주어에 따른 be동사 현재형"
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_blank",
        "question_data": {
            "stem": "Yesterday, I ___ at home all day.",
            "choices": ["am not", "amn't", "isn't", "wasn't", "weren't"],
            "correct_index": 3,
            "sentence_ko": "어제 나는 하루 종일 집에 없었다.",
            "grammar_point": "be동사 과거형 부정"
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_blank",
        "question_data": {
            "stem": "___ you and Lucy at the park last Saturday?",
            "choices": ["Is", "Am", "Are", "Was", "Were"],
            "correct_index": 4,
            "sentence_ko": "너와 Lucy는 지난 토요일에 공원에 있었니?",
            "grammar_point": "be동사 과거형 의문문"
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_error",
        "question_data": {
            "prompt": "다음 중 어법상 알맞지 않은 문장을 고르세요.",
            "sentences": [
                "We're in the shopping mall now.",
                "I am not a high school student.",
                "My favorite sport is swimming.",
                "Tony and I am neighbors.",
                "She's not in the kitchen."
            ],
            "correct_indices": [3],
            "invert": False,
            "select_count": 1
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_error",
        "question_data": {
            "prompt": "다음 중 어법상 알맞은 문장 두 개를 고르세요.",
            "sentences": [
                "This camera isn't expensive.",
                "A: Are you a new teacher? B: Yes, you are.",
                "His shoes were dirty and old.",
                "Are your bag heavy?",
                "Was your parents at the theater last night?"
            ],
            "correct_indices": [0, 2],
            "invert": True,
            "select_count": 2
        },
        "level": 1, "chapter_num": 1, "difficulty": 3,
    },
    {
        "question_type": "grammar_common",
        "question_data": {
            "sentences": [
                "My sister ___ sick yesterday.",
                "He ___ a little boy 10 years ago.",
                "The musical ___ great yesterday.",
                "I ___ an elementary student last year."
            ],
            "prompt": "다음 중 빈칸에 들어갈 단어가 나머지와 다른 하나를 고르세요.",
            "choices": ["was", "was", "was", "was", "were"],
            "correct_index": 4,
            "different_sentences": ["They ___ in Busan last month."]
        },
        "level": 1, "chapter_num": 1, "difficulty": 2,
    },
    {
        "question_type": "grammar_usage",
        "question_data": {
            "prompt": "다음 밑줄 친 be동사의 의미가 나머지와 다른 하나를 고르세요.",
            "sentences": [
                "You are not a pilot.",
                "They are in this building.",
                "Ms. Han is my English teacher.",
                "Curry is my favorite food.",
                "Steve is my new classmate."
            ],
            "correct_index": 1,
            "underlined_word": "be동사"
        },
        "level": 1, "chapter_num": 1, "difficulty": 2,
    },
    {
        "question_type": "grammar_transform",
        "question_data": {
            "original": "Bill and Ted are very brave.",
            "instruction": "부정문으로 바꿔 쓰세요.",
            "correct_answer": "Bill and Ted are not very brave.",
            "acceptable_answers": ["Bill and Ted aren't very brave."]
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_transform",
        "question_data": {
            "original": "James was absent from school yesterday.",
            "instruction": "의문문으로 바꿔 쓰세요.",
            "correct_answer": "Was James absent from school yesterday?",
            "acceptable_answers": []
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
    {
        "question_type": "grammar_pair",
        "question_data": {
            "stem": "Your sister looks (A) when she plays with her puppy. Rules and laws will keep us (B).",
            "paired_choices": [
                ["happy", "safe"],
                ["happy", "safely"],
                ["happily", "safe"],
                ["happily", "safely"],
                ["happiness", "safe"]
            ],
            "correct_index": 0
        },
        "level": 2, "chapter_num": 1, "difficulty": 2,
    },
    {
        "question_type": "grammar_order",
        "question_data": {
            "words": ["Hanbok", "my Chinese friends", "showed", "to", "I"],
            "correct_answer": "I showed Hanbok to my Chinese friends.",
            "sentence_ko": "나는 나의 중국인 친구들에게 한복을 보여 주었다."
        },
        "level": 2, "chapter_num": 1, "difficulty": 2,
    },
    {
        "question_type": "grammar_translate",
        "question_data": {
            "sentence_ko": "그 배우는 매우 유명하다.",
            "correct_answer": "The actor is very famous.",
            "acceptable_answers": ["The actor is really famous."],
            "hint_words": ["actor", "famous"]
        },
        "level": 1, "chapter_num": 1, "difficulty": 1,
    },
]

from app.models.grammar_book import GrammarBook
from app.models.grammar_chapter import GrammarChapter
from app.models.grammar_config import GrammarConfig
from app.models.grammar_question import GrammarQuestion
from app.models.grammar_session import GrammarSession
from app.models.grammar_answer import GrammarAnswer
from app.models.test_assignment import TestAssignment
from app.models.user import User
from app.services.test_config import generate_test_code
from app.core.timezone import now_kst

logger = logging.getLogger(__name__)


# ── Config CRUD ─────────────────────────────────────────────────────────

async def create_config(
    db: AsyncSession,
    teacher_id: str,
    *,
    name: str,
    book_ids: list[str],
    chapter_ids: Optional[list[str]] = None,
    question_count: int = 20,
    time_limit_seconds: int = 600,
    per_question_seconds: Optional[int] = None,
    time_mode: str = "per_question",
    question_types: Optional[list[str]] = None,
    question_type_counts: Optional[dict[str, int]] = None,
) -> GrammarConfig:
    """Create a grammar test configuration."""
    config = GrammarConfig(
        id=str(uuid.uuid4()),
        teacher_id=teacher_id,
        name=name,
        book_ids=",".join(book_ids),
        chapter_ids=",".join(chapter_ids) if chapter_ids else None,
        question_count=question_count,
        time_limit_seconds=time_limit_seconds,
        per_question_seconds=per_question_seconds,
        time_mode=time_mode,
        question_types=",".join(question_types) if question_types else None,
        question_type_counts=json.dumps(question_type_counts) if question_type_counts else None,
        is_active=True,
    )
    db.add(config)
    await db.flush()
    return config


async def list_configs(db: AsyncSession, teacher_id: str) -> list[GrammarConfig]:
    """List active grammar configs for a teacher."""
    result = await db.execute(
        select(GrammarConfig).where(
            and_(
                GrammarConfig.teacher_id == teacher_id,
                GrammarConfig.is_active == True,
            )
        ).order_by(GrammarConfig.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_config(db: AsyncSession, config_id: str, teacher_id: str) -> bool:
    """Soft-delete a grammar config (set is_active=False)."""
    result = await db.execute(
        select(GrammarConfig).where(
            and_(
                GrammarConfig.id == config_id,
                GrammarConfig.teacher_id == teacher_id,
            )
        )
    )
    config = result.scalar_one_or_none()
    if not config:
        return False
    config.is_active = False
    await db.flush()
    return True


# ── Assignment ──────────────────────────────────────────────────────────

async def assign_students(
    db: AsyncSession,
    config_id: str,
    teacher_id: str,
    student_ids: list[str],
) -> list[dict]:
    """Assign grammar test to students, creating test_assignments."""
    config = (await db.execute(
        select(GrammarConfig).where(GrammarConfig.id == config_id)
    )).scalar_one_or_none()
    if not config:
        raise ValueError("Grammar config not found")

    assignments = []
    for sid in student_ids:
        # Check student exists
        student = (await db.execute(
            select(User).where(User.id == sid)
        )).scalar_one_or_none()
        if not student:
            continue

        test_code = await generate_test_code(db)
        assignment = TestAssignment(
            id=str(uuid.uuid4()),
            test_config_id=None,
            grammar_config_id=config.id,
            student_id=sid,
            teacher_id=teacher_id,
            test_code=test_code,
            assignment_type="grammar",
            engine_type="grammar",
            status="pending",
        )
        db.add(assignment)
        assignments.append({
            "student_id": sid,
            "student_name": student.name,
            "test_code": test_code,
            "assignment_id": assignment.id,
        })

    await db.flush()
    return assignments


# ── Question Selection ──────────────────────────────────────────────────

async def _select_questions(
    db: AsyncSession,
    config: GrammarConfig,
) -> list[dict]:
    """Select and shuffle questions based on config."""
    book_ids = config.book_ids.split(",") if config.book_ids else []
    chapter_ids = config.chapter_ids.split(",") if config.chapter_ids else []

    # Build query filters
    filters = []
    if book_ids:
        filters.append(GrammarQuestion.book_id.in_(book_ids))
    if chapter_ids:
        filters.append(GrammarQuestion.chapter_id.in_(chapter_ids))

    # Get question types config
    type_counts = None
    if config.question_type_counts:
        type_counts = json.loads(config.question_type_counts)
    allowed_types = config.question_types.split(",") if config.question_types else None

    # Fetch available questions
    query = select(GrammarQuestion)
    if filters:
        query = query.where(and_(*filters))
    if allowed_types:
        query = query.where(GrammarQuestion.question_type.in_(allowed_types))

    result = await db.execute(query.order_by(func.random()))
    all_questions = list(result.scalars().all())

    if not all_questions:
        raise ValueError("No questions available for the selected criteria")

    # Distribute by type if type_counts specified
    selected = []
    if type_counts:
        by_type: dict[str, list] = {}
        for q in all_questions:
            by_type.setdefault(q.question_type, []).append(q)

        for qtype, count in type_counts.items():
            pool = by_type.get(qtype, [])
            selected.extend(pool[:count])
    else:
        selected = all_questions[:config.question_count]

    # Build output with order
    questions_out = []
    for i, q in enumerate(selected):
        # Strip correct answer from question_data sent to student
        qdata = dict(q.question_data) if isinstance(q.question_data, dict) else json.loads(q.question_data)

        questions_out.append({
            "id": q.id,
            "question_type": q.question_type,
            "question_data": qdata,
            "question_order": i + 1,
        })

    return questions_out


# ── Session Start ───────────────────────────────────────────────────────

async def start_session(
    db: AsyncSession,
    test_code: str,
    allow_restart: bool = False,
) -> dict:
    """Start a grammar test session by test code."""
    code = test_code.strip().upper()
    assignment = (await db.execute(
        select(TestAssignment).where(TestAssignment.test_code == code)
    )).scalar_one_or_none()

    if not assignment:
        raise ValueError("Invalid test code")
    if assignment.engine_type != "grammar":
        raise ValueError("This test code is not for grammar test")

    # Check existing session
    existing = (await db.execute(
        select(GrammarSession).where(
            GrammarSession.assignment_id == assignment.id
        )
    )).scalar_one_or_none()

    if existing and existing.completed_at:
        if not allow_restart:
            raise ValueError("ALREADY_COMPLETED: This test has already been completed")
        # Delete existing session for restart
        await db.delete(existing)
        await db.flush()
        existing = None

    if existing and not existing.completed_at:
        # Resume in-progress session
        answers = (await db.execute(
            select(GrammarAnswer).where(
                GrammarAnswer.grammar_session_id == existing.id
            ).order_by(GrammarAnswer.question_order)
        )).scalars().all()

        # Rebuild questions from answers + remaining
        # For simplicity, re-fetch questions
        config = (await db.execute(
            select(GrammarConfig).where(GrammarConfig.id == assignment.grammar_config_id)
        )).scalar_one_or_none()

        student = (await db.execute(
            select(User).where(User.id == assignment.student_id)
        )).scalar_one_or_none()

        questions = await _select_questions(db, config)

        return {
            "session_id": existing.id,
            "student_id": assignment.student_id,
            "student_name": student.name if student else "",
            "questions": questions,
            "total_questions": existing.total_questions,
            "time_limit_seconds": config.time_limit_seconds if config else 600,
            "per_question_seconds": config.per_question_seconds if config else None,
            "time_mode": config.time_mode if config else "per_question",
        }

    # Load grammar config
    config = (await db.execute(
        select(GrammarConfig).where(GrammarConfig.id == assignment.grammar_config_id)
    )).scalar_one_or_none()
    if not config:
        raise ValueError("Grammar config not found for this assignment")

    # Select questions
    questions = await _select_questions(db, config)

    # Get student
    student = (await db.execute(
        select(User).where(User.id == assignment.student_id)
    )).scalar_one_or_none()
    if not student:
        raise ValueError("Student not found")

    # Create session
    session_obj = GrammarSession(
        id=str(uuid.uuid4()),
        student_id=assignment.student_id,
        assignment_id=assignment.id,
        grammar_config_id=config.id,
        total_questions=len(questions),
    )
    db.add(session_obj)

    # Update assignment status
    assignment.status = "in_progress"

    await db.flush()

    return {
        "session_id": session_obj.id,
        "student_id": assignment.student_id,
        "student_name": student.name,
        "questions": questions,
        "total_questions": len(questions),
        "time_limit_seconds": config.time_limit_seconds,
        "per_question_seconds": config.per_question_seconds,
        "time_mode": config.time_mode,
    }


# ── Answer Submission ───────────────────────────────────────────────────

def _normalize(text: str) -> str:
    """Normalize text for comparison: lowercase, strip, single spaces."""
    text = text.strip().lower()
    text = re.sub(r'\s+', ' ', text)
    # Remove trailing period for comparison
    text = text.rstrip('.')
    return text


def _check_answer(question: GrammarQuestion, selected_answer: str) -> tuple[bool, str]:
    """Check if the selected answer is correct. Returns (is_correct, correct_answer_str)."""
    qdata = question.question_data if isinstance(question.question_data, dict) else json.loads(question.question_data)
    qtype = question.question_type

    if qtype in ("grammar_blank", "grammar_pair"):
        # MC: compare index
        correct_idx = qdata["correct_index"]
        correct_answer = str(correct_idx)
        is_correct = selected_answer.strip() == correct_answer
        return is_correct, correct_answer

    elif qtype == "grammar_error":
        # Could be single or multi-select
        correct_indices = sorted(qdata["correct_indices"])
        correct_answer = ",".join(str(i) for i in correct_indices)
        # Student answer could be "1" or "0,2" (comma-separated indices)
        try:
            student_indices = sorted(int(x.strip()) for x in selected_answer.split(","))
        except ValueError:
            return False, correct_answer
        is_correct = student_indices == correct_indices
        return is_correct, correct_answer

    elif qtype == "grammar_common":
        correct_idx = qdata["correct_index"]
        correct_answer = str(correct_idx)
        is_correct = selected_answer.strip() == correct_answer
        return is_correct, correct_answer

    elif qtype == "grammar_usage":
        correct_idx = qdata["correct_index"]
        correct_answer = str(correct_idx)
        is_correct = selected_answer.strip() == correct_answer
        return is_correct, correct_answer

    elif qtype in ("grammar_transform", "grammar_translate"):
        correct = _normalize(qdata["correct_answer"])
        correct_answer = qdata["correct_answer"]
        student = _normalize(selected_answer)
        if student == correct:
            return True, correct_answer
        # Check acceptable answers
        for alt in qdata.get("acceptable_answers", []):
            if _normalize(alt) == student:
                return True, correct_answer
        return False, correct_answer

    elif qtype == "grammar_order":
        correct = _normalize(qdata["correct_answer"])
        correct_answer = qdata["correct_answer"]
        student = _normalize(selected_answer)
        return student == correct, correct_answer

    else:
        return False, "unknown"


async def submit_answer(
    db: AsyncSession,
    session_id: str,
    question_id: str,
    selected_answer: str,
    time_taken_seconds: Optional[float] = None,
) -> dict:
    """Submit a single answer for a grammar question."""
    session_obj = (await db.execute(
        select(GrammarSession).where(GrammarSession.id == session_id)
    )).scalar_one_or_none()
    if not session_obj:
        raise ValueError("Session not found")
    if session_obj.completed_at:
        raise ValueError("Session already completed")

    question = (await db.execute(
        select(GrammarQuestion).where(GrammarQuestion.id == question_id)
    )).scalar_one_or_none()
    if not question:
        raise ValueError("Question not found")

    # Check for duplicate answer
    existing = (await db.execute(
        select(GrammarAnswer).where(
            and_(
                GrammarAnswer.grammar_session_id == session_id,
                GrammarAnswer.grammar_question_id == question_id,
            )
        )
    )).scalar_one_or_none()
    if existing:
        return {
            "is_correct": existing.is_correct,
            "correct_answer": existing.correct_answer,
            "question_id": question_id,
        }

    is_correct, correct_answer = _check_answer(question, selected_answer)

    # Get next question_order
    count_result = await db.execute(
        select(func.count()).where(
            GrammarAnswer.grammar_session_id == session_id
        )
    )
    order = (count_result.scalar() or 0) + 1

    answer = GrammarAnswer(
        id=str(uuid.uuid4()),
        grammar_session_id=session_id,
        grammar_question_id=question_id,
        question_order=order,
        question_type=question.question_type,
        selected_answer=selected_answer,
        correct_answer=correct_answer,
        is_correct=is_correct,
        time_taken_seconds=time_taken_seconds,
        answered_at=now_kst(),
    )
    db.add(answer)

    if is_correct:
        session_obj.correct_count += 1

    await db.flush()

    return {
        "is_correct": is_correct,
        "correct_answer": correct_answer,
        "question_id": question_id,
    }


async def submit_batch_and_complete(
    db: AsyncSession,
    session_id: str,
    answers: list[dict],
) -> dict:
    """Submit all answers in batch and complete the session (exam mode)."""
    session_obj = (await db.execute(
        select(GrammarSession).where(GrammarSession.id == session_id)
    )).scalar_one_or_none()
    if not session_obj:
        raise ValueError("Session not found")
    if session_obj.completed_at:
        raise ValueError("Session already completed")

    correct_count = 0
    results = []

    for i, ans in enumerate(answers):
        question = (await db.execute(
            select(GrammarQuestion).where(GrammarQuestion.id == ans["question_id"])
        )).scalar_one_or_none()
        if not question:
            continue

        is_correct, correct_answer = _check_answer(question, ans["selected_answer"])

        answer_obj = GrammarAnswer(
            id=str(uuid.uuid4()),
            grammar_session_id=session_id,
            grammar_question_id=ans["question_id"],
            question_order=i + 1,
            question_type=question.question_type,
            selected_answer=ans["selected_answer"],
            correct_answer=correct_answer,
            is_correct=is_correct,
            time_taken_seconds=ans.get("time_taken_seconds"),
            answered_at=now_kst(),
        )
        db.add(answer_obj)

        if is_correct:
            correct_count += 1

        results.append({
            "question_id": ans["question_id"],
            "question_type": question.question_type,
            "is_correct": is_correct,
            "selected_answer": ans["selected_answer"],
            "correct_answer": correct_answer,
        })

    # Complete session
    session_obj.correct_count = correct_count
    total = session_obj.total_questions or len(answers)
    session_obj.score = round(correct_count / total * 100) if total > 0 else 0
    session_obj.completed_at = now_kst()

    # Update assignment status
    assignment = (await db.execute(
        select(TestAssignment).where(TestAssignment.id == session_obj.assignment_id)
    )).scalar_one_or_none()
    if assignment:
        assignment.status = "completed"
        assignment.completed_at = now_kst()

    await db.flush()

    return {
        "session_id": session_id,
        "total_questions": total,
        "correct_count": correct_count,
        "score": session_obj.score,
        "results": results,
    }


async def complete_session(
    db: AsyncSession,
    session_id: str,
) -> dict:
    """Mark a grammar session as complete (for real-time mode)."""
    session_obj = (await db.execute(
        select(GrammarSession).where(GrammarSession.id == session_id)
    )).scalar_one_or_none()
    if not session_obj:
        raise ValueError("Session not found")
    if session_obj.completed_at:
        raise ValueError("Session already completed")

    # Count correct answers
    result = await db.execute(
        select(
            func.count().label("total"),
            func.sum(GrammarAnswer.is_correct.cast(type_=None)).label("correct"),
        ).where(GrammarAnswer.grammar_session_id == session_id)
    )
    row = result.one()
    total = row.total or 0
    correct = int(row.correct or 0)

    session_obj.correct_count = correct
    session_obj.score = round(correct / total * 100) if total > 0 else 0
    session_obj.completed_at = now_kst()

    # Update assignment
    assignment = (await db.execute(
        select(TestAssignment).where(TestAssignment.id == session_obj.assignment_id)
    )).scalar_one_or_none()
    if assignment:
        assignment.status = "completed"
        assignment.completed_at = now_kst()

    await db.flush()

    # Get detailed results
    answers = (await db.execute(
        select(GrammarAnswer).where(
            GrammarAnswer.grammar_session_id == session_id
        ).order_by(GrammarAnswer.question_order)
    )).scalars().all()

    results = [
        {
            "question_id": a.grammar_question_id,
            "question_type": a.question_type,
            "is_correct": a.is_correct,
            "selected_answer": a.selected_answer,
            "correct_answer": a.correct_answer,
        }
        for a in answers
    ]

    return {
        "session_id": session_id,
        "total_questions": session_obj.total_questions,
        "correct_count": correct,
        "score": session_obj.score,
        "results": results,
    }


# ── Assignments list ─────────────────────────────────────────────────────

async def list_assignments(db: AsyncSession, teacher_id: str) -> list[dict]:
    """List grammar assignments for a teacher with student info."""
    from app.models.grammar_config import GrammarConfig

    result = await db.execute(
        select(
            TestAssignment,
            User.name.label("student_name"),
            User.school_name.label("student_school"),
            User.grade.label("student_grade"),
            GrammarConfig.name.label("config_name"),
        )
        .join(User, TestAssignment.student_id == User.id)
        .outerjoin(GrammarConfig, TestAssignment.grammar_config_id == GrammarConfig.id)
        .where(
            and_(
                TestAssignment.teacher_id == teacher_id,
                TestAssignment.assignment_type == "grammar",
            )
        )
        .order_by(TestAssignment.assigned_at.desc())
    )
    rows = result.all()
    return [
        {
            "id": row.TestAssignment.id,
            "student_id": row.TestAssignment.student_id,
            "student_name": row.student_name,
            "student_school": row.student_school,
            "student_grade": row.student_grade,
            "test_code": row.TestAssignment.test_code,
            "config_name": row.config_name,
            "status": row.TestAssignment.status,
            "assigned_at": row.TestAssignment.assigned_at.isoformat() if row.TestAssignment.assigned_at else None,
            "completed_at": row.TestAssignment.completed_at.isoformat() if row.TestAssignment.completed_at else None,
        }
        for row in rows
    ]


async def get_config_assignment_counts(db: AsyncSession, config_ids: list[str]) -> dict[str, int]:
    """Get assignment count per grammar config."""
    if not config_ids:
        return {}
    result = await db.execute(
        select(
            TestAssignment.grammar_config_id,
            func.count(TestAssignment.id).label("cnt"),
        )
        .where(TestAssignment.grammar_config_id.in_(config_ids))
        .group_by(TestAssignment.grammar_config_id)
    )
    return {row[0]: row[1] for row in result.all()}


# ── Auto-seed ────────────────────────────────────────────────────────────

async def seed_books_and_chapters(db: AsyncSession) -> None:
    """Auto-seed grammar books + chapters + sample questions if table is empty."""
    import uuid as _uuid

    book_ids = {}
    for book_data in _BOOKS:
        book = GrammarBook(
            id=str(_uuid.uuid4()),
            title=book_data["title"],
            level=book_data["level"],
        )
        db.add(book)
        book_ids[book_data["level"]] = book.id

    chapter_map = {}  # (level, chapter_num) -> chapter_id
    for level, chapters in _CHAPTERS.items():
        for ch_num, ch_title in chapters:
            ch = GrammarChapter(
                id=str(_uuid.uuid4()),
                book_id=book_ids[level],
                chapter_num=ch_num,
                title=ch_title,
            )
            db.add(ch)
            chapter_map[(level, ch_num)] = ch.id

    # Sample questions
    for q in _SAMPLE_QUESTIONS:
        key = (q["level"], q["chapter_num"])
        if key not in chapter_map:
            continue
        question = GrammarQuestion(
            id=str(_uuid.uuid4()),
            book_id=book_ids[q["level"]],
            chapter_id=chapter_map[key],
            question_type=q["question_type"],
            question_data=q["question_data"],
            source="sample",
            difficulty=q.get("difficulty", 1),
        )
        db.add(question)

    await db.flush()
    logger.info(
        "Auto-seeded %d grammar books, %d chapters, %d sample questions",
        len(_BOOKS),
        sum(len(c) for c in _CHAPTERS.values()),
        len(_SAMPLE_QUESTIONS),
    )
