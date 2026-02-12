"""Simulate TEST0213 completion to 100 questions with realistic answers."""
import asyncio
import sys
import random
from pathlib import Path
from datetime import datetime, timedelta, timezone

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
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
    import uuid

    print("\n" + "=" * 70)
    print("TEST0213 시뮬레이션: 100문제 완료까지 자동 진행")
    print("=" * 70 + "\n")

    SessionLocal = get_session_factory()
    async with SessionLocal() as db:
        # Get TEST0213 assignment
        result = await db.execute(
            select(TestAssignment).where(TestAssignment.test_code == "TEST0213")
        )
        assignment = result.scalar_one_or_none()

        if not assignment:
            print("[ERROR] TEST0213 not found")
            return

        # Get config
        config_result = await db.execute(
            select(TestConfig).where(TestConfig.id == assignment.test_config_id)
        )
        config = config_result.scalar_one_or_none()

        # Get or create session
        session_result = await db.execute(
            select(LearningSession).where(LearningSession.assignment_id == assignment.id)
        )
        session = session_result.scalar_one_or_none()

        if not session:
            print("[ERROR] No session found")
            return

        # Get current answers
        answers_result = await db.execute(
            select(LearningAnswer)
            .where(LearningAnswer.session_id == session.id)
            .order_by(LearningAnswer.answered_at)
        )
        existing_answers = list(answers_result.scalars().all())

        current_count = len(existing_answers)
        target_count = config.question_count
        remaining = target_count - current_count

        print(f"현재 진행: {current_count}/{target_count} 문제")
        print(f"남은 문제: {remaining}개\n")

        if remaining <= 0:
            print("이미 100문제 완료되었습니다.")
            return

        # Get available words for the level range
        words_result = await db.execute(
            select(Word)
            .where(Word.level.between(config.level_range_min, config.level_range_max))
            .order_by(Word.level)
        )
        all_words = list(words_result.scalars().all())

        if len(all_words) < remaining:
            print(f"[WARNING] 단어 부족: {len(all_words)}개만 사용 가능")

        print(f"사용 가능한 단어: {len(all_words)}개")
        print(f"레벨 범위: Lv.{config.level_range_min}-{config.level_range_max}\n")

        # Simulate remaining questions
        # Strategy: Gradually increase difficulty, maintain ~70% accuracy
        current_level = session.current_level
        current_stage = session.current_stage
        current_combo = 0
        best_combo = session.best_combo

        # Get last answer time
        if existing_answers:
            last_time = existing_answers[-1].answered_at
        else:
            last_time = session.started_at or datetime.now(timezone.utc)

        print(f"시작 레벨: Lv.{current_level}")
        print(f"시작 스테이지: Stage {current_stage}\n")

        new_answers = []
        new_masteries = {}

        # Simulate questions in batches of 10
        for batch_idx in range((remaining + 9) // 10):
            batch_start = batch_idx * 10
            batch_end = min(batch_start + 10, remaining)
            batch_size = batch_end - batch_start

            # Adjust difficulty based on progress
            progress_ratio = (current_count + batch_start) / target_count

            # Determine target accuracy for this batch (decrease as progress increases)
            if progress_ratio < 0.3:
                target_acc = 0.85  # Easy start
            elif progress_ratio < 0.6:
                target_acc = 0.75  # Medium
            elif progress_ratio < 0.9:
                target_acc = 0.65  # Getting harder
            else:
                target_acc = 0.55  # Final stretch is tough

            # Select words for this batch
            # Prefer words around current level +/- 2
            level_min = max(config.level_range_min, current_level - 1)
            level_max = min(config.level_range_max, current_level + 2)

            batch_words_pool = [w for w in all_words if level_min <= w.level <= level_max]
            if len(batch_words_pool) < batch_size:
                batch_words_pool = all_words

            batch_words = random.sample(batch_words_pool, min(batch_size, len(batch_words_pool)))

            # Decide which are correct
            n_correct = round(batch_size * target_acc)
            correct_indices = set(random.sample(range(batch_size), n_correct))

            print(f"Batch {batch_idx + 1}: Q{current_count + batch_start + 1}-{current_count + batch_end}")
            print(f"  목표 정답률: {target_acc*100:.0f}% ({n_correct}/{batch_size})")

            for i, word in enumerate(batch_words):
                is_correct = i in correct_indices

                # Time varies by stage and correctness
                if current_stage <= 2:
                    time_range = (2.0, 5.0) if is_correct else (4.0, 8.0)
                elif current_stage <= 3:
                    time_range = (3.0, 7.0) if is_correct else (5.0, 10.0)
                else:
                    time_range = (4.0, 9.0) if is_correct else (6.0, 12.0)

                time_sec = round(random.uniform(*time_range), 1)

                # Update combo
                if is_correct:
                    current_combo += 1
                    best_combo = max(best_combo, current_combo)
                else:
                    current_combo = 0

                # Create or update WordMastery
                if word.id not in new_masteries:
                    # Check if exists
                    mastery_check = await db.execute(
                        select(WordMastery).where(
                            WordMastery.student_id == session.student_id,
                            WordMastery.word_id == word.id,
                        )
                    )
                    mastery = mastery_check.scalar_one_or_none()

                    if not mastery:
                        mastery = WordMastery(
                            id=str(uuid.uuid4()),
                            student_id=session.student_id,
                            word_id=word.id,
                            assignment_id=assignment.id,
                            stage=min(current_stage + (1 if is_correct else 0), 5),
                            stage_streak=1 if is_correct else 0,
                            total_attempts=1,
                            total_correct=1 if is_correct else 0,
                            combo_best=current_combo if is_correct else 0,
                            last_practiced_at=last_time,
                            created_at=last_time,
                            updated_at=last_time,
                        )
                        db.add(mastery)
                        await db.flush()

                    new_masteries[word.id] = mastery

                # Create answer
                correct_answer = word.korean
                if is_correct:
                    selected_answer = correct_answer
                else:
                    # Pick wrong answer from similar level
                    similar = [w for w in batch_words if w.level == word.level and w.id != word.id]
                    if similar:
                        selected_answer = random.choice(similar).korean
                    else:
                        selected_answer = "틀린답"

                answer = LearningAnswer(
                    id=str(uuid.uuid4()),
                    session_id=session.id,
                    word_mastery_id=new_masteries[word.id].id,
                    word_id=word.id,
                    stage=current_stage,
                    is_correct=is_correct,
                    selected_answer=selected_answer,
                    correct_answer=correct_answer,
                    time_taken_sec=time_sec,
                    answered_at=last_time,
                )
                db.add(answer)
                new_answers.append(answer)

                last_time += timedelta(seconds=time_sec + random.uniform(0.3, 1.5))

            # Update level/stage based on batch performance
            if n_correct >= batch_size * 0.8:
                # Good performance: advance
                if current_stage < 5:
                    current_stage += 1
                elif current_level < config.level_range_max:
                    current_level += 1
                    current_stage = 1
            elif n_correct < batch_size * 0.5:
                # Poor performance: regress
                if current_stage > 1:
                    current_stage -= 1
                elif current_level > config.level_range_min:
                    current_level -= 1
                    current_stage = 5

            print(f"  → Lv.{current_level} Stage {current_stage}, Combo: {current_combo}, Best: {best_combo}\n")

            await db.flush()

        # Update session
        total_answers = current_count + len(new_answers)
        session.current_level = current_level
        session.current_stage = current_stage
        session.best_combo = best_combo
        session.words_practiced = total_answers
        session.words_advanced = len([a for a in new_answers if a.is_correct])
        session.words_demoted = len([a for a in new_answers if not a.is_correct])
        session.completed_at = last_time

        # Update assignment status
        assignment.status = "completed"
        assignment.completed_at = last_time

        await db.commit()

        print("=" * 70)
        print("시뮬레이션 완료!")
        print("=" * 70)
        print(f"총 문제: {total_answers}")
        print(f"신규 생성: {len(new_answers)}문제")
        print(f"최종 레벨: Lv.{current_level}")
        print(f"최종 스테이지: Stage {current_stage}")
        print(f"최고 콤보: {best_combo}")

        all_correct = len([a for a in new_answers if a.is_correct])
        print(f"신규 정답: {all_correct}/{len(new_answers)} ({all_correct/len(new_answers)*100:.1f}%)")
        print("=" * 70)
        print()


if __name__ == "__main__":
    asyncio.run(main())
