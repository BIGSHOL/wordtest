"""Engine: sentence - Show sentence with blank, pick English word.

Level test name : sentence_blank
Mastery name    : (used as overlay via apply_sentence_overlay)
Card            : SentenceCard

Also provides apply_sentence_overlay() for converting any QuestionSpec
into sentence mode (used by mastery engine).
"""
import re
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


class SentenceEngine:
    question_type = "sentence"

    def can_generate(self, word: Word) -> bool:
        if not word.example_en:
            return False
        return make_sentence_blank(word.example_en, word.english) is not None

    def generate(
        self,
        word: Word,
        pool: DistractorPool,
        n_choices: int = 4,
    ) -> QuestionSpec:
        correct = word.english
        distractors = pick_english_distractors(correct, pool.all_english, n_choices - 1)
        blank = make_sentence_blank(word.example_en, word.english)
        return QuestionSpec(
            question_type=self.question_type,
            word=word,
            correct_answer=correct,
            choices=shuffle_choices(correct, distractors),
            context_mode="sentence",
            sentence_blank=blank,
        )


def apply_sentence_overlay(spec: QuestionSpec) -> QuestionSpec | None:
    """Convert an existing QuestionSpec into sentence mode.

    Returns a new QuestionSpec with context_mode="sentence" and sentence_blank set,
    or None if the word has no usable example sentence.
    Used by mastery engine to overlay sentence context onto choice questions.
    """
    word = spec.word
    if not word.example_en:
        return None
    blank = make_sentence_blank(word.example_en, word.english)
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
        emoji=spec.emoji,
    )
