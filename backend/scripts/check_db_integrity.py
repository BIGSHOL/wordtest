"""
DB 데이터 무결성 및 합리성 점검 스크립트
- 학생 데이터
- 테스트 설정 및 출제 데이터
- 테스트 세션 및 리포트
- 마스터리 세션
"""
import asyncio
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.models.test_config import TestConfig
from app.models.test_assignment import TestAssignment
from app.models.test_session import TestSession
from app.models.test_answer import TestAnswer
from app.models.learning_session import LearningSession
from app.models.word import Word


async def check_users(db: AsyncSession):
    """학생/교사 데이터 점검"""
    print("\n" + "="*60)
    print("1. 사용자 데이터 점검")
    print("="*60)

    # 전체 사용자 수
    total_result = await db.execute(select(func.count(User.id)))
    total_users = total_result.scalar()

    # 역할별 사용자 수
    role_result = await db.execute(
        select(User.role, func.count(User.id))
        .group_by(User.role)
    )

    print(f"\n총 사용자: {total_users}명")
    for role, count in role_result.all():
        print(f"  - {role}: {count}명")

    # 학생 데이터 샘플
    student_result = await db.execute(
        select(User)
        .where(User.role == "student")
        .limit(5)
    )
    students = student_result.scalars().all()

    print(f"\n학생 샘플 (최대 5명):")
    for s in students:
        print(f"  - {s.name} ({s.email}) | 학교: {s.school_name} | 학년: {s.grade}")


async def check_test_configs(db: AsyncSession):
    """테스트 설정 점검"""
    print("\n" + "="*60)
    print("2. 테스트 설정 (TestConfig) 점검")
    print("="*60)

    # 전체 설정 수
    total_result = await db.execute(select(func.count(TestConfig.id)))
    total_configs = total_result.scalar()
    print(f"\n총 테스트 설정: {total_configs}개")

    # 활성/비활성 분포
    active_result = await db.execute(
        select(TestConfig.is_active, func.count(TestConfig.id))
        .group_by(TestConfig.is_active)
    )
    for is_active, count in active_result.all():
        status = "활성" if is_active else "비활성"
        print(f"  - {status}: {count}개")

    # 테스트 유형별 분포
    type_result = await db.execute(
        select(TestConfig.test_type, func.count(TestConfig.id))
        .group_by(TestConfig.test_type)
    )
    print("\n테스트 유형별 분포:")
    for test_type, count in type_result.all():
        print(f"  - {test_type}: {count}개")

    # 교재 범위 설정 샘플
    config_result = await db.execute(
        select(TestConfig)
        .where(TestConfig.book_name.isnot(None))
        .limit(5)
    )
    configs = config_result.scalars().all()

    print(f"\n교재 설정 샘플 (최대 5개):")
    for c in configs:
        book_range = f"{c.book_name}"
        if c.book_name_end and c.book_name_end != c.book_name:
            book_range = f"{c.book_name} ~ {c.book_name_end}"
        lesson_range = f"{c.lesson_range_start}-{c.lesson_range_end}" if c.lesson_range_start else "전체"
        print(f"  - {c.name}")
        print(f"    교재: {book_range} | 레슨: {lesson_range}")
        print(f"    문제수: {c.question_count} | 시간: {c.per_question_time_seconds}초/문제")


async def check_test_assignments(db: AsyncSession):
    """테스트 출제 데이터 점검"""
    print("\n" + "="*60)
    print("3. 테스트 출제 (TestAssignment) 점검")
    print("="*60)

    # 전체 출제 수
    total_result = await db.execute(select(func.count(TestAssignment.id)))
    total_assignments = total_result.scalar()
    print(f"\n총 출제: {total_assignments}개")

    # 상태별 분포
    status_result = await db.execute(
        select(TestAssignment.status, func.count(TestAssignment.id))
        .group_by(TestAssignment.status)
    )
    print("\n상태별 분포:")
    for status, count in status_result.all():
        print(f"  - {status}: {count}개")

    # 출제 유형별 분포
    type_result = await db.execute(
        select(TestAssignment.assignment_type, func.count(TestAssignment.id))
        .group_by(TestAssignment.assignment_type)
    )
    print("\n출제 유형별 분포:")
    for atype, count in type_result.all():
        print(f"  - {atype}: {count}개")

    # 테스트 코드 중복 검사
    duplicate_result = await db.execute(
        select(TestAssignment.test_code, func.count(TestAssignment.id))
        .group_by(TestAssignment.test_code)
        .having(func.count(TestAssignment.id) > 1)
    )
    duplicates = duplicate_result.all()
    if duplicates:
        print(f"\n[WARNING] 중복된 테스트 코드 발견: {len(duplicates)}개")
        for code, count in duplicates[:5]:
            print(f"  - {code}: {count}개")
    else:
        print("\n[OK] 테스트 코드 중복 없음")


async def check_test_sessions(db: AsyncSession):
    """테스트 세션 점검"""
    print("\n" + "="*60)
    print("4. 테스트 세션 (TestSession) 점검")
    print("="*60)

    # 전체 세션 수
    total_result = await db.execute(select(func.count(TestSession.id)))
    total_sessions = total_result.scalar()
    print(f"\n총 테스트 세션: {total_sessions}개")

    # 완료/미완료 분포
    completed_result = await db.execute(
        select(func.count(TestSession.id))
        .where(TestSession.completed_at.isnot(None))
    )
    completed = completed_result.scalar()
    print(f"  - 완료: {completed}개")
    print(f"  - 미완료: {total_sessions - completed}개")

    # 테스트 유형별 분포
    type_result = await db.execute(
        select(TestSession.test_type, func.count(TestSession.id))
        .group_by(TestSession.test_type)
    )
    print("\n테스트 유형별 분포:")
    for test_type, count in type_result.all():
        print(f"  - {test_type}: {count}개")

    # 평균 점수 (완료된 세션만)
    avg_score_result = await db.execute(
        select(func.avg(TestSession.score))
        .where(TestSession.completed_at.isnot(None))
    )
    avg_score = avg_score_result.scalar()
    if avg_score:
        print(f"\n평균 점수: {avg_score:.2f}점")

    # 답변 데이터 존재 여부
    answer_result = await db.execute(select(func.count(TestAnswer.id)))
    total_answers = answer_result.scalar()
    print(f"\n총 답변 기록: {total_answers}개")

    # 답변 없는 세션 체크
    sessions_result = await db.execute(
        select(TestSession.id, func.count(TestAnswer.id))
        .outerjoin(TestAnswer, TestSession.id == TestAnswer.test_session_id)
        .where(TestSession.completed_at.isnot(None))
        .group_by(TestSession.id)
        .having(func.count(TestAnswer.id) == 0)
    )
    sessions_without_answers = sessions_result.all()
    if sessions_without_answers:
        print(f"\n[WARNING] 답변 기록 없는 완료 세션: {len(sessions_without_answers)}개")
    else:
        print("\n[OK] 모든 완료 세션에 답변 기록 존재")


async def check_learning_sessions(db: AsyncSession):
    """마스터리 학습 세션 점검"""
    print("\n" + "="*60)
    print("5. 마스터리 학습 세션 (LearningSession) 점검")
    print("="*60)

    # 전체 세션 수
    total_result = await db.execute(select(func.count(LearningSession.id)))
    total_sessions = total_result.scalar()
    print(f"\n총 마스터리 세션: {total_sessions}개")

    # 완료/미완료 분포
    completed_result = await db.execute(
        select(func.count(LearningSession.id))
        .where(LearningSession.completed_at.isnot(None))
    )
    completed = completed_result.scalar()
    print(f"  - 완료: {completed}개")
    print(f"  - 진행중: {total_sessions - completed}개")

    # 평균 연습 단어 수 (완료된 세션)
    avg_words = await db.execute(
        select(func.avg(LearningSession.words_practiced))
        .where(LearningSession.completed_at.isnot(None))
    )
    avg_w = avg_words.scalar()
    if avg_w:
        print(f"\n평균 연습 단어 수: {avg_w:.1f}개")

    # 평균 상승/하락 단어 수
    avg_advanced = await db.execute(
        select(func.avg(LearningSession.words_advanced))
        .where(LearningSession.completed_at.isnot(None))
    )
    avg_adv = avg_advanced.scalar()
    avg_demoted = await db.execute(
        select(func.avg(LearningSession.words_demoted))
        .where(LearningSession.completed_at.isnot(None))
    )
    avg_dem = avg_demoted.scalar()
    if avg_adv and avg_dem:
        print(f"평균 상승/하락: {avg_adv:.1f}개 / {avg_dem:.1f}개")

    # TestAssignment과 연결된 세션 수
    linked_result = await db.execute(
        select(func.count(LearningSession.id))
        .where(LearningSession.assignment_id.isnot(None))
    )
    linked = linked_result.scalar()
    print(f"\nTestAssignment 연결: {linked}개")


async def check_word_data(db: AsyncSession):
    """단어 데이터 점검"""
    print("\n" + "="*60)
    print("6. 단어 데이터 (Word) 점검")
    print("="*60)

    # 전체 단어 수
    total_result = await db.execute(select(func.count(Word.id)))
    total_words = total_result.scalar()
    print(f"\n총 단어: {total_words}개")

    # 교재별 분포
    book_result = await db.execute(
        select(Word.book_name, func.count(Word.id))
        .group_by(Word.book_name)
        .order_by(Word.book_name)
    )
    print("\n교재별 단어 수:")
    for book, count in book_result.all():
        print(f"  - {book}: {count}개")

    # 레벨별 분포
    level_result = await db.execute(
        select(Word.level, func.count(Word.id))
        .group_by(Word.level)
        .order_by(Word.level)
    )
    print("\n레벨별 단어 수:")
    for level, count in level_result.all():
        print(f"  - Level {level}: {count}개")

    # 예문 데이터 존재 여부
    example_result = await db.execute(
        select(func.count(Word.id))
        .where(Word.example_en.isnot(None))
    )
    with_example = example_result.scalar()
    print(f"\n예문 있는 단어: {with_example}개 ({with_example/total_words*100:.1f}%)")


async def check_data_consistency():
    """데이터 일관성 종합 점검"""
    print("\n" + "="*60)
    print("7. 데이터 일관성 점검")
    print("="*60)

    async for db in get_db():
        # TestAssignment의 TestConfig 참조 무결성
        orphan_assignment = await db.execute(
            select(func.count(TestAssignment.id))
            .outerjoin(TestConfig, TestAssignment.test_config_id == TestConfig.id)
            .where(TestConfig.id.is_(None))
        )
        orphan_count = orphan_assignment.scalar()
        if orphan_count > 0:
            print(f"\n[WARNING] TestConfig 없는 TestAssignment: {orphan_count}개")
        else:
            print("\n[OK] TestAssignment → TestConfig 참조 무결성 OK")

        # TestSession의 TestConfig 참조 무결성
        orphan_session = await db.execute(
            select(func.count(TestSession.id))
            .where(TestSession.test_config_id.isnot(None))
            .outerjoin(TestConfig, TestSession.test_config_id == TestConfig.id)
            .where(TestConfig.id.is_(None))
        )
        orphan_session_count = orphan_session.scalar()
        if orphan_session_count > 0:
            print(f"\n[WARNING] TestConfig 없는 TestSession: {orphan_session_count}개")
        else:
            print("\n[OK] TestSession → TestConfig 참조 무결성 OK")

        # completed_at 있는데 score가 없는 세션
        completed_no_score = await db.execute(
            select(func.count(TestSession.id))
            .where(
                TestSession.completed_at.isnot(None),
                TestSession.score.is_(None)
            )
        )
        no_score_count = completed_no_score.scalar()
        if no_score_count > 0:
            print(f"\n[WARNING] 완료됐지만 점수 없는 세션: {no_score_count}개")
        else:
            print("\n[OK] 완료 세션 점수 데이터 OK")

        # LearningSession의 Assignment 참조
        orphan_learning = await db.execute(
            select(func.count(LearningSession.id))
            .where(LearningSession.assignment_id.isnot(None))
            .outerjoin(TestAssignment, LearningSession.assignment_id == TestAssignment.id)
            .where(TestAssignment.id.is_(None))
        )
        orphan_learning_count = orphan_learning.scalar()
        if orphan_learning_count > 0:
            print(f"\n[WARNING] TestAssignment 없는 LearningSession: {orphan_learning_count}개")
        else:
            print("\n[OK] LearningSession → TestAssignment 참조 무결성 OK")


async def main():
    """메인 점검 루틴"""
    print("\n" + "="*60)
    print("DB 데이터 무결성 및 합리성 점검 시작")
    print("="*60)

    async for db in get_db():
        await check_users(db)
        await check_test_configs(db)
        await check_test_assignments(db)
        await check_test_sessions(db)
        await check_learning_sessions(db)
        await check_word_data(db)

    await check_data_consistency()

    print("\n" + "="*60)
    print("점검 완료")
    print("="*60 + "\n")


if __name__ == "__main__":
    asyncio.run(main())
