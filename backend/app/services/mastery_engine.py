"""Mastery engine - generates stage-specific questions for the 5-stage system."""
import re
import random
from collections import defaultdict

from app.models.word import Word
from app.models.word_mastery import WordMastery
from app.schemas.mastery import (
    MasteryQuestion, MasteryQuestionWord, STAGE_TIMERS, STAGE_QUESTION_TYPES,
)


# --- Level-based sentence probability ---
# Higher levels → more sentence/context-based questions

def _sentence_probability(word_level: int) -> float:
    """Return probability [0..1] of using sentence mode for a given word level."""
    if word_level <= 3:
        return 0.0
    elif word_level <= 5:
        return 0.2
    elif word_level <= 7:
        return 0.4
    elif word_level <= 9:
        return 0.6
    elif word_level <= 12:
        return 0.8
    else:  # 13-15
        return 1.0


def _make_sentence_blank(sentence: str, target_word: str) -> str | None:
    """Replace the target word in the sentence with ____.

    Handles case-insensitive matching and common suffixes (s, ed, ing, etc.).
    Returns None if the word is not found.
    """
    if not sentence or not target_word:
        return None

    # Try exact (case-insensitive) word boundary match first
    pattern = re.compile(r'\b' + re.escape(target_word) + r'\b', re.IGNORECASE)
    if pattern.search(sentence):
        return pattern.sub('____', sentence, count=1)

    # Try matching common inflected forms: target + (s|es|ed|ing|d|er|est|ly|tion|ment)
    inflect_pattern = re.compile(
        r'\b' + re.escape(target_word) + r'(?:s|es|ed|ing|d|er|est|ly|tion|ment|ness|ful|less|ous|ive|al|able|ible)?\b',
        re.IGNORECASE,
    )
    if inflect_pattern.search(sentence):
        return inflect_pattern.sub('____', sentence, count=1)

    return None


def _is_phrase(text: str) -> bool:
    """Check if a word entry is a phrase/idiom (contains spaces)."""
    return ' ' in text.strip()


def _pick_english_distractors(
    correct: str, all_english: list[str], count: int = 3,
) -> list[str]:
    """Pick distractors that match the correct answer's type (phrase vs single word).

    If the correct answer is a phrase/idiom, prefer other phrases as distractors.
    If the correct answer is a single word, prefer other single words.
    Falls back to the full pool if not enough same-type distractors exist.
    """
    is_correct_phrase = _is_phrase(correct)
    same_type = [e for e in all_english if e != correct and _is_phrase(e) == is_correct_phrase]
    if len(same_type) >= count:
        return random.sample(same_type, count)
    # Not enough same-type distractors: use what we have + fill from other type
    other_type = [e for e in all_english if e != correct and _is_phrase(e) != is_correct_phrase]
    pool = same_type + other_type
    return random.sample(pool, min(count, len(pool)))


def _word_response(word: Word) -> MasteryQuestionWord:
    return MasteryQuestionWord(
        id=word.id,
        english=word.english,
        korean=word.korean,
        example_en=word.example_en,
        example_ko=word.example_ko,
        level=word.level,
        lesson=word.lesson,
        part_of_speech=word.part_of_speech,
    )


def generate_stage_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    stage: int,
    all_words: list[Word],
) -> list[MasteryQuestion]:
    """Generate stage-appropriate questions for a batch of word masteries.

    Higher-level words get sentence/context-based questions more often.
    """
    if not masteries or not all_words:
        return []

    # Pre-compute distractor pools
    unique_korean = list({w.korean for w in all_words if w.korean})
    unique_english = list({w.english for w in all_words})

    question_type = STAGE_QUESTION_TYPES.get(stage, "word_to_meaning")
    timer = STAGE_TIMERS.get(stage, 5)

    questions: list[MasteryQuestion] = []

    for mastery in masteries:
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Decide context mode based on word level
        prob = _sentence_probability(word.level)
        has_example = bool(word.example_en and word.example_ko)
        use_sentence = has_example and (random.random() < prob)

        # Pre-compute sentence blank if using sentence mode
        sentence_blank = None
        if use_sentence and word.example_en:
            sentence_blank = _make_sentence_blank(word.example_en, word.english)
            if not sentence_blank:
                use_sentence = False  # fallback to word mode

        context_mode = "sentence" if use_sentence else "word"

        choices = None
        correct_answer = ""

        if stage == 1:
            if use_sentence:
                # Sentence blank → always English word choices
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # English → Korean meaning (4 choices)
                correct_answer = word.korean
                wrong = [k for k in unique_korean if k != word.korean]
                sampled = random.sample(wrong, min(3, len(wrong)))
                choices = [correct_answer] + sampled
                random.shuffle(choices)

        elif stage == 2:
            # Korean meaning → English word (4 choices)
            correct_answer = word.english
            sampled = _pick_english_distractors(word.english, unique_english)
            choices = [correct_answer] + sampled
            random.shuffle(choices)

        elif stage == 3:
            # Listen → Type English word
            correct_answer = word.english

        elif stage == 4:
            if use_sentence:
                # Sentence blank → always English word choices
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # Listen → Korean meaning (4 choices)
                correct_answer = word.korean
                wrong = [k for k in unique_korean if k != word.korean]
                sampled = random.sample(wrong, min(3, len(wrong)))
                choices = [correct_answer] + sampled
                random.shuffle(choices)

        elif stage == 5:
            # Korean meaning → Type English word
            correct_answer = word.english

        questions.append(MasteryQuestion(
            word_mastery_id=mastery.id,
            word=_word_response(word),
            stage=stage,
            question_type=question_type,
            choices=choices,
            correct_answer=correct_answer,
            timer_seconds=timer,
            context_mode=context_mode,
            sentence_blank=sentence_blank,
        ))

    return questions


def generate_mixed_questions(
    masteries: list[WordMastery],
    words_map: dict[str, Word],
    all_words: list[Word],
) -> list[MasteryQuestion]:
    """Generate mixed-type questions based on each word's internal mastery stage.

    Stages are internal only - not shown to user. Question types are mixed:
    - Stage 1-2: randomly word_to_meaning OR meaning_to_word (50:50), timer=5s
    - Stage 3: listen_and_type, timer=15s
    - Stage 4: listen_to_meaning, timer=10s
    - Stage 5: meaning_and_type, timer=15s

    Sentence mode based on word level (higher = more sentences).
    """
    if not masteries or not all_words:
        return []

    # Pre-compute distractor pools
    unique_korean = list({w.korean for w in all_words if w.korean})
    unique_english = list({w.english for w in all_words})

    questions: list[MasteryQuestion] = []

    for mastery in masteries:
        word = words_map.get(mastery.word_id)
        if not word:
            continue

        # Get internal stage from mastery
        stage = mastery.stage

        # Decide context mode based on word level
        prob = _sentence_probability(word.level)
        has_example = bool(word.example_en and word.example_ko)
        use_sentence = has_example and (random.random() < prob)

        # Pre-compute sentence blank if using sentence mode
        sentence_blank = None
        if use_sentence and word.example_en:
            sentence_blank = _make_sentence_blank(word.example_en, word.english)
            if not sentence_blank:
                use_sentence = False  # fallback to word mode

        context_mode = "sentence" if use_sentence else "word"

        choices = None
        correct_answer = ""
        question_type = ""
        timer = 5

        # Determine question type based on internal stage
        if stage == 1 or stage == 2:
            if use_sentence:
                # Sentence blank → always English word choices
                question_type = "meaning_to_word"
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            elif random.random() < 0.5:
                # word_to_meaning: English → Korean meaning (4 choices)
                question_type = "word_to_meaning"
                correct_answer = word.korean
                wrong = [k for k in unique_korean if k != word.korean]
                sampled = random.sample(wrong, min(3, len(wrong)))
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # meaning_to_word: Korean meaning → English word (4 choices)
                question_type = "meaning_to_word"
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            timer = 5

        elif stage == 3:
            # listen_and_type: Listen → Type English word
            question_type = "listen_and_type"
            correct_answer = word.english
            timer = 15

        elif stage == 4:
            if use_sentence:
                # Sentence blank → always English word choices
                question_type = "listen_to_meaning"
                correct_answer = word.english
                sampled = _pick_english_distractors(word.english, unique_english)
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            else:
                # listen_to_meaning: Listen → Korean meaning (4 choices)
                question_type = "listen_to_meaning"
                correct_answer = word.korean
                wrong = [k for k in unique_korean if k != word.korean]
                sampled = random.sample(wrong, min(3, len(wrong)))
                choices = [correct_answer] + sampled
                random.shuffle(choices)
            timer = 10

        elif stage == 5:
            # meaning_and_type: Korean meaning → Type English word
            question_type = "meaning_and_type"
            correct_answer = word.english
            timer = 15

        questions.append(MasteryQuestion(
            word_mastery_id=mastery.id,
            word=_word_response(word),
            stage=stage,
            question_type=question_type,
            choices=choices,
            correct_answer=correct_answer,
            timer_seconds=timer,
            context_mode=context_mode,
            sentence_blank=sentence_blank,
        ))

    return questions


def edit_distance(s1: str, s2: str) -> int:
    """Compute Levenshtein edit distance between two strings."""
    if len(s1) < len(s2):
        return edit_distance(s2, s1)

    if len(s2) == 0:
        return len(s1)

    prev_row = list(range(len(s2) + 1))

    for i, c1 in enumerate(s1):
        curr_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = prev_row[j + 1] + 1
            deletions = curr_row[j] + 1
            substitutions = prev_row[j] + (c1 != c2)
            curr_row.append(min(insertions, deletions, substitutions))
        prev_row = curr_row

    return prev_row[-1]


def check_typing_answer(submitted: str, correct: str) -> tuple[bool, bool]:
    """Check a typed answer against the correct answer.

    Returns:
        (is_correct, is_almost) tuple.
        is_correct: exact match (case-insensitive, trimmed).
        is_almost: edit distance == 1 (close but not exact).
    """
    submitted_clean = submitted.strip().lower()
    correct_clean = correct.strip().lower()

    if submitted_clean == correct_clean:
        return (True, False)

    dist = edit_distance(submitted_clean, correct_clean)
    if dist == 1 and len(correct_clean) >= 3:
        return (False, True)

    return (False, False)
