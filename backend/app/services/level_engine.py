"""Level test engine - question generation and level determination."""
import random
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.models.word import Word


async def generate_questions(
    db: AsyncSession, num_questions: int = 20
) -> list[dict]:
    """Generate test questions with 4-choice answers from the Word table.

    Selects words across multiple levels and creates multiple-choice questions
    where the correct answer is the Korean translation and 3 wrong answers
    are Korean translations of other words.
    """
    # Get all available words
    result = await db.execute(select(Word))
    all_words = list(result.scalars().all())

    if len(all_words) < 4:
        return []

    # Sample words for questions (spread across levels)
    num_questions = min(num_questions, len(all_words))
    question_words = random.sample(all_words, num_questions)

    questions = []
    for i, word in enumerate(question_words):
        # Get 3 wrong choices (different Korean translations)
        wrong_pool = [w for w in all_words if w.id != word.id]
        wrong_words = random.sample(wrong_pool, min(3, len(wrong_pool)))
        wrong_choices = [w.korean for w in wrong_words]

        # Build choices: 1 correct + 3 wrong, shuffled
        choices = [word.korean] + wrong_choices
        random.shuffle(choices)

        questions.append({
            "question_order": i + 1,
            "word": word,
            "correct_answer": word.korean,
            "choices": choices,
        })

    return questions


def determine_level(correct_count: int, total_questions: int) -> int:
    """Determine student level based on test score.

    Score ranges map to levels 1-15:
    - 90%+ → level 15
    - 80-89% → level 12-14
    - 60-79% → level 7-11
    - 40-59% → level 4-6
    - <40% → level 1-3
    """
    if total_questions == 0:
        return 1

    score_pct = (correct_count / total_questions) * 100

    if score_pct >= 90:
        return 15
    elif score_pct >= 80:
        return 12
    elif score_pct >= 70:
        return 9
    elif score_pct >= 60:
        return 7
    elif score_pct >= 50:
        return 5
    elif score_pct >= 40:
        return 4
    elif score_pct >= 20:
        return 2
    else:
        return 1


def calculate_score(correct_count: int, total_questions: int) -> int:
    """Calculate test score as percentage (0-100)."""
    if total_questions == 0:
        return 0
    return round((correct_count / total_questions) * 100)
