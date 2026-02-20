"""Distractor (wrong answer) generation utilities.

Extracted from mastery_engine.py for shared use across all question engines.
"""
import random


def is_phrase(text: str) -> bool:
    """Check if a word entry is a phrase/idiom (contains spaces)."""
    return ' ' in text.strip()


def has_tilde(text: str) -> bool:
    """Check if Korean meaning starts with ~ (e.g. ~하다, ~을 먹다)."""
    return text.strip().startswith('~')


def pick_korean_distractors(
    correct: str, all_korean: list[str], count: int = 3,
) -> list[str]:
    """Pick Korean meaning distractors matching the correct answer's tilde pattern.

    If the correct answer starts with ~, prefer other ~ meanings so the
    ~ prefix doesn't give away the answer.
    """
    correct_has_tilde = has_tilde(correct)
    same_type = [k for k in all_korean if k != correct and has_tilde(k) == correct_has_tilde]
    if len(same_type) >= count:
        return random.sample(same_type, count)
    other_type = [k for k in all_korean if k != correct and has_tilde(k) != correct_has_tilde]
    pool = same_type + other_type
    return random.sample(pool, min(count, len(pool)))


def pick_english_distractors(
    correct: str, all_english: list[str], count: int = 3,
) -> list[str]:
    """Pick English word distractors matching phrase vs single-word pattern.

    If the correct answer is a phrase/idiom, prefer other phrases.
    Falls back to the full pool if not enough same-type distractors exist.
    """
    is_correct_phrase = is_phrase(correct)
    same_type = [e for e in all_english if e != correct and is_phrase(e) == is_correct_phrase]
    if len(same_type) >= count:
        return random.sample(same_type, count)
    other_type = [e for e in all_english if e != correct and is_phrase(e) != is_correct_phrase]
    pool = same_type + other_type
    return random.sample(pool, min(count, len(pool)))


def shuffle_choices(correct: str, distractors: list[str]) -> list[str]:
    """Combine correct answer with distractors and shuffle."""
    choices = [correct] + distractors
    random.shuffle(choices)
    return choices
