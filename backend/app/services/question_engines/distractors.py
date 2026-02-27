"""Distractor (wrong answer) generation utilities.

Smart distractor selection: picks wrong answers that are
1. From similar difficulty level and POS (tier-based)
2. Most confusing / similar to the correct answer (scored ranking)
"""
import random
from typing import TYPE_CHECKING, Callable

if TYPE_CHECKING:
    from app.models.word import Word
    from app.services.question_engines.base import DistractorPool


def is_phrase(text: str) -> bool:
    """Check if a word entry is a phrase/idiom (contains spaces)."""
    return ' ' in text.strip()


def has_tilde(text: str) -> bool:
    """Check if Korean meaning starts with ~ (e.g. ~하다, ~을 먹다)."""
    return text.strip().startswith('~')


# ── Confusion scoring ────────────────────────────────────────────────────

_EN_SUFFIXES = (
    'tion', 'sion', 'ment', 'ness', 'able', 'ible', 'ful', 'less',
    'ous', 'ive', 'ly', 'er', 'ed', 'ing', 'al', 'ty', 'ry', 'ity',
)

_KO_SUFFIXES = ('하다', '되다', '시키다', '적인', '적', '스럽다', '롭다')


def _english_confusion_score(candidate: str, correct: str) -> float:
    """Score how confusing an English distractor is. Higher = more confusing."""
    score = 0.0
    c, t = candidate.lower().strip(), correct.lower().strip()
    if not c or not t:
        return 0.0
    # Same first letter — very confusing at a glance
    if c[0] == t[0]:
        score += 3
    # Similar length (±1: +3, ±2: +1)
    len_diff = abs(len(c) - len(t))
    if len_diff <= 1:
        score += 3
    elif len_diff <= 2:
        score += 1
    # Same ending pattern (e.g. -tion, -ly, -ment)
    for sfx in _EN_SUFFIXES:
        if c.endswith(sfx) and t.endswith(sfx):
            score += 2
            break
    # Same last 2 characters (rhyme-like)
    if len(c) >= 2 and len(t) >= 2 and c[-2:] == t[-2:]:
        score += 1
    return score


def _korean_confusion_score(candidate: str, correct: str) -> float:
    """Score how confusing a Korean distractor is. Higher = more confusing."""
    score = 0.0
    c = candidate.strip()
    t = correct.strip()
    if not c or not t:
        return 0.0
    # Strip tilde for comparison
    c_clean = c.lstrip('~').strip()
    t_clean = t.lstrip('~').strip()
    # Similar length (±1: +3, ±2: +1)
    len_diff = abs(len(c_clean) - len(t_clean))
    if len_diff <= 1:
        score += 3
    elif len_diff <= 2:
        score += 1
    # Same ending pattern (verb/adj endings)
    for sfx in _KO_SUFFIXES:
        if c_clean.endswith(sfx) and t_clean.endswith(sfx):
            score += 3
            break
    # Same first syllable — similar semantic category feel
    if c_clean and t_clean and c_clean[0] == t_clean[0]:
        score += 2
    return score


def _pick_confusing(
    candidates: list[str],
    correct: str,
    count: int,
    scorer: Callable[[str, str], float],
) -> list[str]:
    """Pick most confusing distractors from candidates.

    Scores all candidates by confusion similarity, takes the top pool
    (2x needed), then random-samples from that pool for variety.
    """
    unique = list(dict.fromkeys(candidates))  # preserve order, deduplicate
    if len(unique) <= count:
        random.shuffle(unique)
        return unique
    scored = [(c, scorer(c, correct)) for c in unique]
    scored.sort(key=lambda x: -x[1])
    # Take top pool: 2x count or count+5, capped at available
    top_k = min(max(count * 2, count + 5), len(scored))
    top = [c for c, _ in scored[:top_k]]
    return random.sample(top, count)


def pick_korean_distractors(
    correct: str,
    pool: "DistractorPool",
    count: int = 3,
    *,
    source_word: "Word | None" = None,
) -> list[str]:
    """Pick Korean meaning distractors from similar level/POS words.

    Priority tiers (stops at first tier with enough candidates):
    1. Same level +/-1, same POS, same tilde pattern
    2. Same level +/-2, same tilde pattern
    3. Same level +/-3, same tilde pattern
    4. Any word with same tilde pattern (fallback)
    5. Any word (last resort)

    Within each tier, candidates are ranked by confusion similarity
    (similar length, same ending pattern, same first syllable).
    """
    correct_has_tilde = has_tilde(correct)
    scorer = _korean_confusion_score

    # No word info -> legacy flat behavior
    if not source_word or not pool.all_words:
        same_type = [k for k in pool.all_korean if k != correct and has_tilde(k) == correct_has_tilde]
        if len(same_type) >= count:
            return _pick_confusing(same_type, correct, count, scorer)
        other = [k for k in pool.all_korean if k != correct and has_tilde(k) != correct_has_tilde]
        combined = same_type + other
        return _pick_confusing(combined, correct, min(count, len(combined)), scorer)

    target_level = source_word.level
    target_pos = source_word.part_of_speech

    # Build base candidates: different word, same tilde pattern
    base = [
        w for w in pool.all_words
        if w.korean and w.korean != correct and has_tilde(w.korean) == correct_has_tilde
    ]

    # Tier 1: Same level +/-1, same POS
    if target_pos:
        tier1 = [w.korean for w in base
                 if abs(w.level - target_level) <= 1 and w.part_of_speech == target_pos]
        result = _pick_confusing(tier1, correct, count, scorer)
        if len(result) >= count:
            return result

    # Tier 2: Same level +/-2
    tier2 = [w.korean for w in base if abs(w.level - target_level) <= 2]
    result = _pick_confusing(tier2, correct, count, scorer)
    if len(result) >= count:
        return result

    # Tier 3: Same level +/-3
    tier3 = [w.korean for w in base if abs(w.level - target_level) <= 3]
    result = _pick_confusing(tier3, correct, count, scorer)
    if len(result) >= count:
        return result

    # Tier 4: Any word with same tilde pattern
    tier4 = [w.korean for w in base]
    result = _pick_confusing(tier4, correct, count, scorer)
    if len(result) >= count:
        return result

    # Tier 5: Any word (ignore tilde pattern)
    all_candidates = [w.korean for w in pool.all_words if w.korean and w.korean != correct]
    result = _pick_confusing(all_candidates, correct, count, scorer)
    return result


def pick_english_distractors(
    correct: str,
    pool: "DistractorPool",
    count: int = 3,
    *,
    source_word: "Word | None" = None,
) -> list[str]:
    """Pick English word distractors from similar level/POS words.

    Priority tiers (stops at first tier with enough candidates):
    1. Same level +/-1, same POS, same phrase pattern
    2. Same level +/-2, same phrase pattern
    3. Same level +/-3, same phrase pattern
    4. Any word with same phrase pattern (fallback)
    5. Any word (last resort)

    Within each tier, candidates are ranked by confusion similarity
    (same first letter, similar length, same suffix pattern).
    """
    is_correct_phrase = is_phrase(correct)
    scorer = _english_confusion_score

    # No word info -> legacy flat behavior
    if not source_word or not pool.all_words:
        same_type = [e for e in pool.all_english if e != correct and is_phrase(e) == is_correct_phrase]
        if len(same_type) >= count:
            return _pick_confusing(same_type, correct, count, scorer)
        other = [e for e in pool.all_english if e != correct and is_phrase(e) != is_correct_phrase]
        combined = same_type + other
        return _pick_confusing(combined, correct, min(count, len(combined)), scorer)

    target_level = source_word.level
    target_pos = source_word.part_of_speech

    # Build base candidates: different word, same phrase pattern
    base = [
        w for w in pool.all_words
        if w.english and w.english != correct and is_phrase(w.english) == is_correct_phrase
    ]

    # Tier 1: Same level +/-1, same POS
    if target_pos:
        tier1 = [w.english for w in base
                 if abs(w.level - target_level) <= 1 and w.part_of_speech == target_pos]
        result = _pick_confusing(tier1, correct, count, scorer)
        if len(result) >= count:
            return result

    # Tier 2: Same level +/-2
    tier2 = [w.english for w in base if abs(w.level - target_level) <= 2]
    result = _pick_confusing(tier2, correct, count, scorer)
    if len(result) >= count:
        return result

    # Tier 3: Same level +/-3
    tier3 = [w.english for w in base if abs(w.level - target_level) <= 3]
    result = _pick_confusing(tier3, correct, count, scorer)
    if len(result) >= count:
        return result

    # Tier 4: Any word with same phrase pattern
    tier4 = [w.english for w in base]
    result = _pick_confusing(tier4, correct, count, scorer)
    if len(result) >= count:
        return result

    # Tier 5: Any word (ignore phrase pattern)
    all_candidates = [w.english for w in pool.all_words if w.english and w.english != correct]
    result = _pick_confusing(all_candidates, correct, count, scorer)
    return result


def shuffle_choices(correct: str, distractors: list[str]) -> list[str]:
    """Combine correct answer with distractors and shuffle."""
    choices = [correct] + distractors
    random.shuffle(choices)
    return choices
