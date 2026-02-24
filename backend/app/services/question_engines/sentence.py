"""Engine: sentence - Show sentence with blank, pick English word.

Level test name : sentence_blank
Mastery name    : (used as overlay via apply_sentence_overlay)
Card            : SentenceCard

Also provides apply_sentence_overlay() for converting any QuestionSpec
into sentence mode (used by mastery engine).
"""
import re
import random
from app.models.word import Word
from app.services.question_engines.base import QuestionSpec, DistractorPool
from app.services.question_engines.distractors import pick_english_distractors, shuffle_choices


def make_sentence_blank(sentence: str, target_word: str) -> str | None:
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

    # Try matching common inflected forms
    inflect_pattern = re.compile(
        r'\b' + re.escape(target_word)
        + r'(?:s|es|ed|ing|d|er|est|ly|tion|ment|ness|ful|less|ous|ive|al|able|ible)?\b',
        re.IGNORECASE,
    )
    if inflect_pattern.search(sentence):
        return inflect_pattern.sub('____', sentence, count=1)

    return None


def _pick_example(word: Word) -> tuple[str, str] | None:
    """Pick an example sentence from word.examples or fall back to word.example_en/ko.

    Returns (example_en, example_ko) tuple or None if no usable example.
    """
    # Try word.examples first (1:N relationship)
    examples = getattr(word, 'examples', None)
    if examples:
        # Filter to examples where the word appears in the sentence
        usable = [
            ex for ex in examples
            if make_sentence_blank(ex.example_en, word.english) is not None
        ]
        if usable:
            chosen = random.choice(usable)
            return (chosen.example_en, chosen.example_ko)

    # Fallback to legacy columns
    if word.example_en and make_sentence_blank(word.example_en, word.english) is not None:
        return (word.example_en, word.example_ko or "")

    return None


class SentenceEngine:
    question_type = "sentence"

    def can_generate(self, word: Word) -> bool:
        return _pick_example(word) is not None

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        correct = word.english
        distractors = pick_english_distractors(correct, pool.all_english, n_choices - 1)

        example = _pick_example(word)
        ex_en = example[0] if example else word.example_en
        ex_ko = example[1] if example else (word.example_ko or "")
        blank = make_sentence_blank(ex_en, word.english)

        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=shuffle_choices(correct, distractors),
            context_mode="sentence",
            sentence_blank=blank,
            sentence_en=ex_en,
            sentence_ko=ex_ko,
        )


def apply_sentence_overlay(spec: QuestionSpec) -> QuestionSpec | None:
    """Convert an existing QuestionSpec into sentence mode.

    Returns a new QuestionSpec with context_mode="sentence" and sentence_blank set,
    or None if the word has no usable example sentence.
    Used by mastery engine to overlay sentence context onto choice questions.
    """
    word = spec.word
    example = _pick_example(word)
    if not example:
        return None

    ex_en, ex_ko = example
    blank = make_sentence_blank(ex_en, word.english)
    if not blank:
        return None

    return QuestionSpec(
        question_type=spec.question_type,
        word=spec.word,
        correct_answer=spec.correct_answer,
        choices=spec.choices,
        is_typing=spec.is_typing,
        context_mode="sentence",
        sentence_blank=blank,
        sentence_en=ex_en,
        sentence_ko=ex_ko,
        emoji=spec.emoji,
    )
