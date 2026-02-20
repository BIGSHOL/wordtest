"""Listening engine - generates listen-to-word questions.

Students hear pronunciation via frontend TTS and pick the correct English word.
"""
import random

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.services.mastery_engine import _pick_english_distractors


def generate_listening_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    choice_count: int = 4,
    timer_seconds: int = 8,
) -> list[dict]:
    """Generate listen-to-word questions for all given mastery records.

    Each question: hear pronunciation → pick correct English word from choices.
    Returns list of question dicts in order (no shuffle).
    """
    if not masteries or not all_words:
        return []

    all_english = list({w.english for w in all_words})
    questions: list[dict] = []

    for idx, mastery in enumerate(masteries):
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Pick distractors (phrase-aware)
        distractors = _pick_english_distractors(
            word.english, all_english, count=choice_count - 1
        )
        choices = [word.english] + distractors
        random.shuffle(choices)

        questions.append({
            "word_mastery_id": mastery.id,
            "word_id": word.id,
            "english": word.english,
            "choices": choices,
            "question_index": idx,
            "timer_seconds": timer_seconds,
        })

    return questions
