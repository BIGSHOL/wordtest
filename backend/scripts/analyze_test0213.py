"""Analyze TEST0213 mastery session - simulate 100 questions and identify issues."""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    from app.core.config import settings
    engine = create_async_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args={"statement_cache_size": 0},
    )
    return async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def main():
    from app.models.test_assignment import TestAssignment
    from app.models.test_config import TestConfig
    from app.models.learning_session import LearningSession
    from app.models.learning_answer import LearningAnswer
    from app.models.word_mastery import WordMastery
    from app.models.word import Word

    print("\n" + "=" * 70)
    print("TEST0213 분석: 100문제 시뮬레이션")
    print("=" * 70 + "\n")

    SessionLocal = get_session_factory()
    async with SessionLocal() as db:
        # Get TEST0213 assignment
        result = await db.execute(
            select(TestAssignment).where(TestAssignment.test_code == "TEST0213")
        )
        assignment = result.scalar_one_or_none()

        if not assignment:
            print("[ERROR] TEST0213 assignment not found")
            return

        # Get config
        config_result = await db.execute(
            select(TestConfig).where(TestConfig.id == assignment.test_config_id)
        )
        config = config_result.scalar_one_or_none()

        # Get session
        session_result = await db.execute(
            select(LearningSession).where(LearningSession.assignment_id == assignment.id)
        )
        session = session_result.scalar_one_or_none()

        print(f"[시험 설정]")
        print(f"   이름: {config.name}")
        print(f"   유형: {config.test_type} / {assignment.assignment_type}")
        print(f"   문항수: {config.question_count}문제")
        print(f"   레벨범위: Lv.{config.level_range_min}-{config.level_range_max}")
        print(f"   상태: {assignment.status}")
        print()

        if not session:
            print("[INFO] 세션이 아직 시작되지 않았습니다.")
            return

        # Get all answers
        answers_result = await db.execute(
            select(LearningAnswer)
            .where(LearningAnswer.session_id == session.id)
            .order_by(LearningAnswer.answered_at)
        )
        answers = list(answers_result.scalars().all())

        # Get word mastery records
        mastery_result = await db.execute(
            select(WordMastery)
            .where(WordMastery.assignment_id == assignment.id)
        )
        masteries = list(mastery_result.scalars().all())

        print(f"[현재 진행 상황]")
        print(f"   현재 레벨: Lv.{session.current_level}")
        print(f"   현재 스테이지: Stage {session.current_stage}")
        print(f"   푼 문제 수: {len(answers)}문제")
        print(f"   정답: {sum(1 for a in answers if a.is_correct)}문제")
        print(f"   정답률: {sum(1 for a in answers if a.is_correct) / len(answers) * 100:.1f}%" if answers else "   정답률: -")
        print(f"   최고 콤보: {session.best_combo}연속")
        print(f"   학습한 단어: {len(masteries)}개 (고유)")
        print()

        if len(answers) == 0:
            print("[INFO] 아직 답안이 없습니다.")
            return

        # Analyze by level
        print(f"📈 레벨별 분석")
        level_stats = {}
        for answer in answers:
            word_result = await db.execute(
                select(Word).where(Word.id == answer.word_id)
            )
            word = word_result.scalar_one_or_none()
            if not word:
                continue

            level = word.level
            if level not in level_stats:
                level_stats[level] = {"total": 0, "correct": 0, "times": []}

            level_stats[level]["total"] += 1
            if answer.is_correct:
                level_stats[level]["correct"] += 1
            if answer.time_taken_sec:
                level_stats[level]["times"].append(answer.time_taken_sec)

        for level in sorted(level_stats.keys()):
            stats = level_stats[level]
            acc = stats["correct"] / stats["total"] * 100
            avg_time = sum(stats["times"]) / len(stats["times"]) if stats["times"] else 0
            print(f"   Lv.{level:2d}: {stats['total']:3d}문제, 정답률 {acc:5.1f}%, 평균 {avg_time:.1f}초")

        print()

        # Analyze stage distribution
        print(f"📊 스테이지별 분포")
        stage_counts = {}
        for answer in answers:
            stage = answer.stage
            stage_counts[stage] = stage_counts.get(stage, 0) + 1

        for stage in sorted(stage_counts.keys()):
            print(f"   Stage {stage}: {stage_counts[stage]}문제")

        print()

        # Time analysis
        if answers:
            times = [a.time_taken_sec for a in answers if a.time_taken_sec]
            if times:
                avg_time = sum(times) / len(times)
                min_time = min(times)
                max_time = max(times)
                total_time = sum(times)

                print(f"⏱️  소요 시간 분석")
                print(f"   평균: {avg_time:.1f}초/문제")
                print(f"   최단: {min_time:.1f}초")
                print(f"   최장: {max_time:.1f}초")
                print(f"   총 시간: {total_time:.0f}초 ({total_time/60:.1f}분)")
                print()

        # Projection to 100 questions
        print(f"🎯 100문제 예상 시나리오")
        if len(answers) > 0:
            current_acc = sum(1 for a in answers if a.is_correct) / len(answers)
            avg_time = sum(a.time_taken_sec for a in answers if a.time_taken_sec) / len([a for a in answers if a.time_taken_sec]) if any(a.time_taken_sec for a in answers) else 5.0

            projected_time = avg_time * 100
            projected_correct = int(100 * current_acc)

            print(f"   현재 진행률: {len(answers)}/100 ({len(answers)}%)")
            print(f"   현재 정답률: {current_acc*100:.1f}%")
            print(f"   예상 정답: {projected_correct}/100 문제")
            print(f"   예상 총 시간: {projected_time/60:.1f}분")
            print()

        # Identify potential issues
        print(f"⚠️  잠재적 문제점")
        issues = []

        if len(answers) < config.question_count:
            remaining = config.question_count - len(answers)
            issues.append(f"아직 {remaining}문제가 남아있음 - 세션이 완료되지 않았거나 중단됨")

        if len(set(a.word_id for a in answers)) < len(answers) * 0.8:
            issues.append(f"단어 중복률이 높음 - 고유 단어 {len(set(a.word_id for a in answers))}개 / 전체 {len(answers)}문제")

        if session.current_level > 10:
            issues.append(f"현재 레벨 Lv.{session.current_level}로 높음 - 적절한 난이도 조절 필요")

        if len(level_stats) > 0:
            max_level_questions = max(s["total"] for s in level_stats.values())
            if max_level_questions > 30:
                issues.append(f"특정 레벨에 문제가 집중됨 - 최대 {max_level_questions}문제")

        if len(answers) > 0:
            recent_20 = answers[-20:] if len(answers) >= 20 else answers
            recent_acc = sum(1 for a in recent_20 if a.is_correct) / len(recent_20)
            if recent_acc < 0.3:
                issues.append(f"최근 정답률 {recent_acc*100:.1f}% - 너무 어려움")
            elif recent_acc > 0.9:
                issues.append(f"최근 정답률 {recent_acc*100:.1f}% - 너무 쉬움")

        if issues:
            for i, issue in enumerate(issues, 1):
                print(f"   {i}. {issue}")
        else:
            print(f"   [없음] 정상적으로 진행 중입니다.")

        print()
        print("=" * 70)
        print()


if __name__ == "__main__":
    asyncio.run(main())