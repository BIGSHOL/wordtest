"""
마스터(관리자) 계정 생성 스크립트

Usage:
    python scripts/create_master_account.py

기본 계정:
    - ID: master@wordtest.com
    - PW: Master1234!
    - 이름: 마스터 관리자
    - 역할: teacher (모든 학생 조회 가능)
"""
import asyncio
from sqlalchemy import select
from app.db.session import get_db
from app.models.user import User
from app.core.security import get_password_hash


async def create_master_account():
    """마스터 계정 생성"""
    master_email = "master@wordtest.com"
    master_password = "Master1234!"
    master_name = "마스터 관리자"

    async for db in get_db():
        # 기존 계정 확인
        result = await db.execute(
            select(User).where(User.email == master_email)
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"[INFO] 마스터 계정이 이미 존재합니다: {master_email}")
            print(f"  - ID: {existing.id}")
            print(f"  - 이름: {existing.name}")
            print(f"  - 역할: {existing.role}")

            # 비밀번호 업데이트 여부 확인
            update = input("\n비밀번호를 재설정하시겠습니까? (y/N): ").strip().lower()
            if update == 'y':
                existing.password_hash = get_password_hash(master_password)
                await db.commit()
                print(f"\n[OK] 비밀번호가 '{master_password}'로 재설정되었습니다.")
            else:
                print("\n[SKIP] 변경사항 없음")
            return

        # 새 마스터 계정 생성
        master_user = User(
            email=master_email,
            username=master_email,
            password_hash=get_password_hash(master_password),
            name=master_name,
            role="teacher",  # 모든 학생을 관리할 수 있는 교사 역할
            teacher_id=None,
            school_name="Word Test 시스템",
            grade=None,
            phone_number=None,
        )

        db.add(master_user)
        await db.commit()
        await db.refresh(master_user)

        print("\n" + "="*60)
        print("마스터 계정 생성 완료")
        print("="*60)
        print(f"계정 ID: {master_user.id}")
        print(f"이메일: {master_email}")
        print(f"비밀번호: {master_password}")
        print(f"이름: {master_name}")
        print(f"역할: {master_user.role}")
        print("="*60)
        print("\n[주의] 보안을 위해 초기 비밀번호를 변경하세요!")


async def show_teacher_student_count():
    """각 교사별 학생 수 표시"""
    print("\n" + "="*60)
    print("교사별 학생 수")
    print("="*60)

    async for db in get_db():
        # 교사 목록
        teachers = await db.execute(
            select(User).where(User.role == "teacher").order_by(User.name)
        )
        teachers = teachers.scalars().all()

        for teacher in teachers:
            # 해당 교사의 학생 수
            student_count = await db.execute(
                select(User).where(User.teacher_id == teacher.id, User.role == "student")
            )
            count = len(list(student_count.scalars().all()))

            print(f"\n{teacher.name} ({teacher.email or teacher.id[:8]})")
            print(f"  - 담당 학생: {count}명")

            if count > 0:
                students = await db.execute(
                    select(User.name, User.school_name, User.grade)
                    .where(User.teacher_id == teacher.id, User.role == "student")
                    .limit(5)
                )
                print("  - 학생 샘플:")
                for name, school, grade in students.all():
                    print(f"    * {name} ({school or '학교 미등록'} {grade or ''})")


async def main():
    """메인 실행"""
    await create_master_account()
    await show_teacher_student_count()


if __name__ == "__main__":
    asyncio.run(main())
