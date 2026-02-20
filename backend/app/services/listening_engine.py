"""Listening engine - generates listen-to-word questions.

Students hear pronunciation via frontend TTS and pick the correct English word.
Uses the modular listen_en engine for question generation.
"""
from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.services.question_engines import get_engine, build_pool


def generate_listening_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
    choice_count: int = 4,
    timer_seconds: int = 8,
) -> list[dict]:
    """Generate listen-to-word questions for all given mastery records.

    Each question: hear pronunciation -> pick correct English word from choices.
    Returns list of question dicts in order (no shuffle).
    """
    if not masteries or not all_words:
        return []

    pool = build_pool(all_words)
    engine = get_engine("listen_en")
    questions: list[dict] = []

    for idx, mastery in enumerate(masteries):
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        spec = engine.generate(word, pool, choice_count)

        questions.append({
            "word_mastery_id": mastery.id,
            "word_id": word.id,
            "english": word.english,
            "choices": spec.choices or [],
            "question_index": idx,
            "timer_seconds": timer_seconds,
        })

    return questions
