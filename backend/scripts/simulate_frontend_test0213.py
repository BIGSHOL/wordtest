"""Simulate TEST0213 with frontend XP logic - 100 questions."""
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


# Frontend XP logic (from masteryStore.ts)
def get_lesson_xp(book: int) -> int:
    """XP required to complete one lesson."""
    return 2 + book


def compute_xp_change(is_correct: bool, question_level: int, current_book: int,
                      time_taken: float, timer_limit: float, combo: int, consecutive_wrong: int) -> dict:
    """Compute XP change (frontend logic)."""
    if is_correct:
        # Base XP
        base = (8 + current_book * 2) if question_level >= current_book else max(4, current_book)

        # Speed bonus (graduated)
        if time_taken <= 1:
            speed_bonus = 5
        elif time_taken <= 2:
            speed_bonus = 4
        elif time_taken <= 3:
            speed_bonus = 3
        elif time_taken <= 5:
            speed_bonus = 2
        elif time_taken <= 8:
            speed_bonus = 1
        else:
            speed_bonus = 0

        # Combo bonus
        if combo >= 10:
            combo_bonus = 5
        elif combo >= 7:
            combo_bonus = 3
        elif combo >= 5:
            combo_bonus = 2
        elif combo >= 3:
            combo_bonus = 1
        else:
            combo_bonus = 0

        total = base + speed_bonus + combo_bonus
        return {"base": base, "speed": speed_bonus, "combo": combo_bonus, "total": total}
    else:
        # Penalty scales with level
        base_penalty = -(4 + current_book)

        # Consecutive wrong amplifies penalty
        if consecutive_wrong >= 3:
            penalty_mult = 2.0
        elif consecutive_wrong >= 2:
            penalty_mult = 1.5
        else:
            penalty_mult = 1.0

        total = int(base_penalty * penalty_mult)
        return {"base": base_penalty, "speed": 0, "combo": 0, "total": total}


async def main():
    from app.models.test_assignment import TestAssignment
    from app.models.test_config import TestConfig
    from app.models.learning_session import LearningSession
    from app.models.learning_answer import LearningAnswer
    from app.models.word_mastery import WordMastery
    from app.models.word import Word
    import uuid

    print("\n" + "=" * 70)
    print("TEST0213 시뮬레이션: 프론트엔드 XP 로직 적용")
    print("=" * 70 + "\n")

    SessionLocal = get_session_factory()
    async with SessionLocal() as db:
        # Get TEST0213
        result = await db.execute(
            select(TestAssignment).where(TestAssignment.test_code == "TEST0213")
        )
        assignment = result.scalar_one_or_none()
        if not assignment:
            print("[ERROR] TEST0213 not found")
            return

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
            session = LearningSession(
                id=str(uuid.uuid4()),
                student_id=assignment.student_id,
                assignment_id=assignment.id,
                current_level=1,
                current_stage=1,
                started_at=datetime.now(timezone.utc),
            )
            db.add(session)
            await db.flush()

        # Get words
        words_result = await db.execute(
            select(Word)
            .where(Word.level.between(config.level_range_min, config.level_range_max))
            .order_by(Word.level)
        )
        all_words = list(words_result.scalars().all())
        words_by_level = {}
        for w in all_words:
            words_by_level.setdefault(w.level, []).append(w)

        print(f"총 단어: {len(all_words)}개")
        print(f"목표: {config.question_count}문제\n")

        # Frontend state
        current_book = 1
        current_lesson = 1
        xp = 0
        combo = 0
        best_combo = 0
        consecutive_wrong = 0
        total_correct = 0

        print(f"{'Q#':<4} {'Level':<6} {'Result':<7} {'Time':<5} {'XP':<10} {'Book-Lesson':<12} {'Combo':<6}")
        print("-" * 70)

        last_time = session.started_at

        for q_idx in range(config.question_count):
            # Select word based on current book level
            level_range = range(max(1, current_book - 1), min(15, current_book + 3) + 1)
            available_words = []
            for lvl in level_range:
                available_words.extend(words_by_level.get(lvl, []))

            if not available_words:
                available_words = all_words

            word = random.choice(available_words)

            # Simulate answer (70% correct overall, varies by level difference)
            level_diff = word.level - current_book
            if level_diff <= 0:
                accuracy = 0.85  # Easy
            elif level_diff == 1:
                accuracy = 0.75
            elif level_diff == 2:
                accuracy = 0.65
            else:
                accuracy = 0.50  # Hard

            is_correct = random.random() < accuracy

            # Simulate time
            if is_correct:
                time_taken = round(random.uniform(1.5, 5.0), 1)
            else:
                time_taken = round(random.uniform(4.0, 9.0), 1)

            timer_limit = 8.0

            # Update combo
            if is_correct:
                combo += 1
                best_combo = max(best_combo, combo)
                total_correct += 1
                consecutive_wrong = 0
            else:
                combo = 0
                consecutive_wrong += 1

            # Compute XP
            xp_change = compute_xp_change(
                is_correct, word.level, current_book,
                time_taken, timer_limit, combo, consecutive_wrong
            )

            old_book = current_book
            old_lesson = current_lesson
            xp += xp_change["total"]

            # Level UP
            while xp >= get_lesson_xp(current_book) and current_book <= 15:
                xp -= get_lesson_xp(current_book)
                current_lesson += 1
                if current_lesson > 25:
                    current_book += 1
                    current_lesson = 1
                    if current_book > 15:
                        current_book = 15
                        current_lesson = 25
                        xp = get_lesson_xp(15)
                        break

            # Level DOWN
            while xp < 0 and (current_book > 1 or current_lesson > 1):
                if current_lesson > 1:
                    current_lesson -= 1
                else:
                    current_book -= 1
                    current_lesson = 25
                xp = round(get_lesson_xp(current_book) * 0.8) + xp

            if current_book <= 1 and current_lesson <= 1:
                xp = max(0, xp)
                current_book = 1
                current_lesson = 1

            # Log
            result_str = "O" if is_correct else "X"
            xp_str = f"{xp_change['total']:+d}"
            level_str = f"Book{current_book}-L{current_lesson}"
            level_changed = (current_book != old_book or current_lesson != old_lesson)
            level_display = f"{level_str}{'*' if level_changed else ''}"

            print(f"{q_idx+1:<4} Lv.{word.level:<3} {result_str:<7} {time_taken:<5.1f} {xp_str:<10} {level_display:<12} {combo:<6}")

            # Create DB records (simplified - only track final state)
            last_time += timedelta(seconds=time_taken + random.uniform(0.5, 1.5))

        # Update session with final state
        session.current_level = current_book
        session.best_combo = best_combo
        session.words_practiced = config.question_count
        session.completed_at = last_time
        assignment.status = "completed"
        assignment.completed_at = last_time

        await db.commit()

        print("-" * 70)
        print(f"\n최종 결과:")
        print(f"  최종 레벨: Book {current_book} - Lesson {current_lesson}")
        print(f"  정답: {total_correct}/{config.question_count} ({total_correct/config.question_count*100:.1f}%)")
        print(f"  최고 콤보: {best_combo}")
        print(f"  최종 XP: {xp}/{get_lesson_xp(current_book)}")
        print("\n" + "=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
